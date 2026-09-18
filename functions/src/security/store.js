import { createHmac } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { fail } from "./errors.js";
const stamp = (ms) => Timestamp.fromMillis(ms);
const millis = (t) => t?.toMillis?.() || 0;
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",")}}`;
  return JSON.stringify(value);
}
export function createStore(
  db,
  auth,
  { now = () => Date.now(), hmacKey = () => process.env.PAYLOAD_HMAC_KEY } = {},
) {
  async function identity(request, { recent = false, emulator = false } = {}) {
    if (!request.auth?.uid) fail("UNAUTHENTICATED");
    if (!emulator && !request.app) fail("APP_CHECK_REQUIRED");
    if (!request.auth.token.email_verified) fail("EMAIL_NOT_VERIFIED");
    if (
      recent &&
      (now() / 1000 - Number(request.auth.token.auth_time) > 300 ||
        !request.auth.token.auth_time)
    )
      fail("REAUTH_REQUIRED");
    let user;
    try {
      user = await auth.getUser(request.auth.uid);
    } catch {
      fail("UNAUTHENTICATED");
    }
    if (user.disabled || !user.emailVerified) fail("UNAUTHENTICATED");
    const issued = Number(request.auth.token.auth_time);
    if (
      user.tokensValidAfterTime &&
      issued < Math.floor(Date.parse(user.tokensValidAfterTime) / 1000)
    )
      fail("UNAUTHENTICATED");
    return request.auth.uid;
  }
  async function profile(uid) {
    return db.runTransaction(async (tx) => {
      const ref = db.doc(`users/${uid}`),
        job = db.doc(`deletionJobs/${uid}`);
      const [p, j] = await Promise.all([tx.get(ref), tx.get(job)]);
      if (j.exists || p.data()?.status === "deleting") fail("ACCOUNT_DELETING");
      if (!p.exists)
        tx.create(ref, {
          createdAt: stamp(now()),
          privacyNoticeVersion: "1.0",
          status: "active",
        });
      return { status: "active" };
    });
  }
  async function reserve(uid, kind, payload) {
    const key = hmacKey();
    if (!key) fail("SERVICE_UNAVAILABLE");
    const payloadHmac =
      "v1:" +
      createHmac("sha256", key).update(canonical(payload)).digest("hex");
    const time = now(),
      day = new Date(time).toISOString().slice(0, 10),
      retryAfterSeconds = Math.ceil((Date.parse(day) + 86400000 - time) / 1000);
    const user = db.doc(`users/${uid}`),
      job = db.doc(`deletionJobs/${uid}`),
      usage = db.doc(`users/${uid}/usage/${day}`),
      req = db.doc(`users/${uid}/requests/${payload.requestId}`),
      global = db.doc(`serviceUsage/${day}`),
      config = db.doc("runtimeConfig/service");
    const outcome = await db.runTransaction(async (tx) => {
      const [p, j, u, r, g, c] = await Promise.all(
        [user, job, usage, req, global, config].map((x) => tx.get(x)),
      );
      if (j.exists || p.data()?.status === "deleting") fail("ACCOUNT_DELETING");
      const policy = c.data();
      if (
        !policy?.enabled ||
        !Number.isInteger(policy.dailyOcrCap) ||
        policy.dailyOcrCap < 0 ||
        !policy.quotaPolicyVersion ||
        (kind === "ocr" && !policy.ocrEnabled)
      )
        fail("SERVICE_UNAVAILABLE");
      if (r.exists) {
        const prior = r.data();
        if (prior.payloadHmac !== payloadHmac || prior.kind !== kind)
          fail("INVALID_INPUT");
        if (kind === "analysis" && time - millis(prior.createdAt) < 86400000)
          return { duplicate: true, req, usage, user, job };
        if (
          kind === "ocr" &&
          prior.status === "processing" &&
          millis(prior.leaseUntil) > time
        )
          fail("REQUEST_IN_PROGRESS");
        if (kind === "ocr" && prior.status === "processing") {
          tx.update(req, { status: "failed", errorCode: "OCR_TIMEOUT" });
          return { repeat: true };
        }
        fail(
          kind === "ocr" ? "REPEAT_OCR_REQUIRES_NEW_REQUEST" : "INVALID_INPUT",
        );
      }
      const data = u.data() || {},
        recent = (data.recentReservations || []).filter(
          (t) => t > time - 60000,
        );
      if (recent.length >= 3)
        fail("RATE_LIMITED", {
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((recent[0] + 60000 - time) / 1000),
          ),
        });
      const counter = kind === "ocr" ? "ocrCount" : "analysisCount",
        max = kind === "ocr" ? 5 : 20;
      if ((data[counter] || 0) >= max)
        fail("RATE_LIMITED", { retryAfterSeconds });
      // Scan only the two day-key usage documents across a UTC boundary to enforce the active OCR lease and rolling minute limit.
      const previousDay = new Date(time - 86400000).toISOString().slice(0, 10);
      const previous = await tx.get(
        db.doc(`users/${uid}/usage/${previousDay}`),
      );
      const older = previous.data() || {},
        combined = [
          ...recent,
          ...(older.recentReservations || []).filter((t) => t > time - 60000),
        ].sort((a, b) => a - b);
      if (combined.length >= 3)
        fail("RATE_LIMITED", {
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((combined[0] + 60000 - time) / 1000),
          ),
        });
      if (
        kind === "ocr" &&
        (millis(data.activeOcrLeaseUntil) > time ||
          millis(older.activeOcrLeaseUntil) > time)
      )
        fail("REQUEST_IN_PROGRESS");
      if (
        kind === "ocr" &&
        (g.data()?.globalOcrReservations || 0) >= policy.dailyOcrCap
      )
        fail("RATE_LIMITED", { retryAfterSeconds });
      if (!p.exists)
        tx.create(user, {
          createdAt: stamp(time),
          privacyNoticeVersion: "1.0",
          status: "active",
        });
      tx.set(
        usage,
        {
          analysisCount: data.analysisCount || 0,
          ocrCount: data.ocrCount || 0,
          [counter]: (data[counter] || 0) + 1,
          recentReservations: [...recent, time],
          expiresAt: stamp(time + 7 * 86400000 - 3600000),
          ...(kind === "ocr"
            ? {
                activeOcrRequestId: payload.requestId,
                activeOcrLeaseUntil: stamp(time + 90000),
              }
            : {}),
        },
        { merge: true },
      );
      tx.create(req, {
        kind,
        payloadHmac,
        status: "processing",
        createdAt: stamp(time),
        leaseUntil: stamp(time + 90000),
        expiresAt: stamp(time + 47 * 3600000),
        rulesVersion: "rules-1.0",
      });
      if (kind === "ocr")
        tx.set(global, {
          globalOcrReservations: (g.data()?.globalOcrReservations || 0) + 1,
          expiresAt: stamp(time + 7 * 86400000 - 3600000),
        });
      return { duplicate: false, req, usage, user, job };
    });
    if (outcome.repeat) fail("REPEAT_OCR_REQUIRES_NEW_REQUEST");
    return outcome;
  }
  async function finish(reservation, kind, errorCode = null) {
    await db.runTransaction(async (tx) => {
      const { user, job, req, usage } = reservation;
      const [p, j, r, u] = await Promise.all(
        [user, job, req, usage].map((x) => tx.get(x)),
      );
      if (!p.exists || p.data().status !== "active" || j.exists)
        fail("ACCOUNT_DELETING");
      if (!r.exists) fail("INTERNAL");
      tx.update(req, {
        status: errorCode ? "failed" : "completed",
        ...(errorCode ? { errorCode } : {}),
      });
      if (kind === "ocr" && u.exists && u.data().activeOcrRequestId === req.id)
        tx.update(usage, {
          activeOcrRequestId: null,
          activeOcrLeaseUntil: stamp(0),
        });
    });
  }
  async function startDeletion(uid) {
    await db.runTransaction(async (tx) => {
      const p = db.doc(`users/${uid}`),
        j = db.doc(`deletionJobs/${uid}`);
      const existing = await tx.get(j);
      if (existing.exists) return;
      tx.set(p, { status: "deleting" }, { merge: true });
      tx.create(j, {
        status: "pending",
        requestedAt: stamp(now()),
        attemptCount: 0,
        nextAttemptAt: stamp(now()),
      });
    });
    return { status: "deleting" };
  }
  async function deleteUser(uid) {
    const job = db.doc(`deletionJobs/${uid}`);
    const leased = await db.runTransaction(async (tx) => {
      const snap = await tx.get(job);
      if (!snap.exists) return false;
      const data = snap.data();
      if (
        data.status === "completed" ||
        millis(data.nextAttemptAt) > now() ||
        millis(data.leaseUntil) > now()
      )
        return false;
      tx.update(job, {
        status: "processing",
        leaseUntil: stamp(now() + 300000),
        attemptCount: data.attemptCount + 1,
      });
      return true;
    });
    if (!leased) return;
    try {
      try {
        await auth.revokeRefreshTokens(uid);
      } catch (e) {
        if (e.code !== "auth/user-not-found") throw e;
      }
      for (const name of ["requests", "usage"]) {
        let batch;
        do {
          batch = await db.collection(`users/${uid}/${name}`).limit(400).get();
          if (batch.size) {
            const b = db.batch();
            batch.docs.forEach((d) => b.delete(d.ref));
            await b.commit();
          }
        } while (batch.size === 400);
      }
      await db.doc(`users/${uid}`).delete();
      try {
        await auth.deleteUser(uid);
      } catch (e) {
        if (e.code !== "auth/user-not-found") throw e;
      }
      // Content-free completion fence outlives every previously issued ID token.
      await job.update({
        status: "completed",
        leaseUntil: stamp(0),
        expiresAt: stamp(now() + 7 * 86400000),
      });
    } catch {
      const current = (await job.get()).data();
      await job.update({
        status: "pending",
        lastErrorCode: "DELETION_RETRY",
        leaseUntil: stamp(0),
        nextAttemptAt: stamp(
          now() +
            Math.min(86400000, 60000 * 2 ** Math.min(current.attemptCount, 10)),
        ),
      });
    }
  }
  async function cleanup() {
    const expiry = stamp(now());
    let deleted = 0;
    for (const group of ["requests", "usage"]) {
      let snap;
      do {
        snap = await db
          .collectionGroup(group)
          .where("expiresAt", "<=", expiry)
          .limit(400)
          .get();
        if (snap.size) {
          const b = db.batch();
          snap.docs.forEach((d) => b.delete(d.ref));
          await b.commit();
          deleted += snap.size;
        }
      } while (snap.size === 400);
    }
    for (const group of ["serviceUsage", "deletionJobs"]) {
      let snap;
      do {
        snap = await db
          .collection(group)
          .where("expiresAt", "<=", expiry)
          .limit(400)
          .get();
        if (snap.size) {
          const b = db.batch();
          snap.docs.forEach((d) => b.delete(d.ref));
          await b.commit();
          deleted += snap.size;
        }
      } while (snap.size === 400);
    }
    await db.doc("operations/cleanup").set({ completedAt: expiry, deleted });
    return deleted;
  }
  return {
    identity,
    profile,
    reserve,
    finish,
    startDeletion,
    deleteUser,
    cleanup,
  };
}
