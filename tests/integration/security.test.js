import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import {
  initializeApp,
  deleteApp,
  getAuth,
  getFirestore,
  Timestamp,
} from "../../functions/src/security/admin.js";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { createStore } from "../../functions/src/security/store.js";
const projectId = "demo-scam-shield";
let app,
  db,
  auth,
  store,
  env,
  time = Date.now();
const payload = (id = crypto.randomUUID()) => ({
  requestId: id,
  text: "Urgent: send your OTP immediately.",
  source: "message",
  language: "en",
  interaction: "none",
  confirmed: true,
});
beforeAll(async () => {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
    throw Error("Run via npm run test:integration");
  app = initializeApp({ projectId }, "integration");
  db = getFirestore(app);
  auth = getAuth(app);
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  store = createStore(db, auth, { now: () => time, hmacKey: () => "test-key" });
});
beforeEach(async () => {
  await env.clearFirestore();
  time = Date.now();
  await db.doc("runtimeConfig/service").set({
    enabled: true,
    ocrEnabled: true,
    dailyOcrCap: 100,
    quotaPolicyVersion: "1",
  });
});
afterAll(async () => {
  await env?.cleanup();
  if (app) await deleteApp(app);
});
it("denies every client read/write, including authenticated owners", async () => {
  for (const ctx of [
    env.unauthenticatedContext(),
    env.authenticatedContext("u1"),
    env.authenticatedContext("u2"),
  ])
    for (const path of [
      "users/u1",
      "runtimeConfig/service",
      "deletionJobs/u1",
      "users/u1/requests/r1",
    ]) {
      await assertFails(getDoc(doc(ctx.firestore(), path)));
      await assertFails(
        setDoc(doc(ctx.firestore(), path), { text: "sensitive" }),
      );
    }
});
it("allows just one text reservation at the daily limit under concurrency", async () => {
  const day = new Date(time).toISOString().slice(0, 10);
  await db.doc(`users/u/usage/${day}`).set({ analysisCount: 19 });
  const results = await Promise.allSettled([
    store.reserve("u", "analysis", payload()),
    store.reserve("u", "analysis", payload()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (await db.doc(`users/u/usage/${day}`).get()).data().analysisCount,
  ).toBe(20);
});
it("recomputes same text request without charging and rejects modified payload", async () => {
  const p = payload();
  const first = await store.reserve("u", "analysis", p);
  await store.finish(first, "analysis");
  const duplicate = await store.reserve("u", "analysis", p);
  expect(duplicate.duplicate).toBe(true);
  await expect(
    store.reserve("u", "analysis", { ...p, text: "something else" }),
  ).rejects.toMatchObject({ details: { code: "INVALID_INPUT" } });
  const record = (await first.req.get()).data();
  expect(record.text).toBeUndefined();
  expect(record.payloadHmac).not.toContain(p.text);
});
it("never repeats OCR for a matching request, and counts failures", async () => {
  const p = payload();
  const r = await store.reserve("u", "ocr", p);
  await expect(store.reserve("u", "ocr", p)).rejects.toMatchObject({
    details: { code: "REQUEST_IN_PROGRESS" },
  });
  await store.finish(r, "ocr", "PROVIDER_UNAVAILABLE");
  await expect(store.reserve("u", "ocr", p)).rejects.toMatchObject({
    details: { code: "REPEAT_OCR_REQUIRES_NEW_REQUEST" },
  });
  expect((await r.usage.get()).data().ocrCount).toBe(1);
});
it("enforces global OCR cap atomically across users", async () => {
  await db.doc("runtimeConfig/service").update({ dailyOcrCap: 1 });
  const r = await Promise.allSettled([
    store.reserve("u1", "ocr", payload()),
    store.reserve("u2", "ocr", payload()),
  ]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
});
it("blocks parallel OCR and three-per-minute reservations across midnight", async () => {
  time = Date.parse("2026-09-18T23:59:59Z");
  await store.reserve("u", "ocr", payload());
  await store.reserve("u", "analysis", payload());
  await store.reserve("u", "analysis", payload());
  time += 2000;
  await expect(store.reserve("u", "analysis", payload())).rejects.toMatchObject(
    { details: { code: "RATE_LIMITED" } },
  );
  time += 60000;
  await expect(store.reserve("u", "ocr", payload())).rejects.toMatchObject({
    details: { code: "REQUEST_IN_PROGRESS" },
  });
});
it("fails closed when policy is missing", async () => {
  await db.doc("runtimeConfig/service").delete();
  await expect(store.reserve("u", "analysis", payload())).rejects.toMatchObject(
    { details: { code: "SERVICE_UNAVAILABLE" } },
  );
});
it("does not recreate profiles after deletion, including in-flight commits", async () => {
  const user = await auth.createUser({
    email: `delete-${crypto.randomUUID()}@example.com`,
    emailVerified: true,
    password: "a-long-password-123",
  });
  const r = await store.reserve(user.uid, "analysis", payload());
  await store.startDeletion(user.uid);
  await expect(store.finish(r, "analysis")).rejects.toMatchObject({
    details: { code: "ACCOUNT_DELETING" },
  });
  await store.deleteUser(user.uid);
  await store.deleteUser(user.uid);
  expect((await db.doc(`users/${user.uid}`).get()).exists).toBe(false);
  await expect(auth.getUser(user.uid)).rejects.toBeDefined();
  await expect(store.profile(user.uid)).rejects.toMatchObject({
    details: { code: "ACCOUNT_DELETING" },
  });
});
it("rejects auth, App Check, verification and old reauthentication", async () => {
  await expect(store.identity({})).rejects.toMatchObject({
    details: { code: "UNAUTHENTICATED" },
  });
  await expect(
    store.identity({ auth: { uid: "u", token: { email_verified: true } } }),
  ).rejects.toMatchObject({ details: { code: "APP_CHECK_REQUIRED" } });
  await expect(
    store.identity({
      auth: { uid: "u", token: { email_verified: false } },
      app: {},
    }),
  ).rejects.toMatchObject({ details: { code: "EMAIL_NOT_VERIFIED" } });
  await expect(
    store.identity(
      {
        auth: { uid: "u", token: { email_verified: true, auth_time: 1 } },
        app: {},
      },
      { recent: true },
    ),
  ).rejects.toMatchObject({ details: { code: "REAUTH_REQUIRED" } });
});
it("cleans expired metadata and preserves fresh records", async () => {
  await db
    .doc("users/u/requests/old")
    .set({ expiresAt: Timestamp.fromMillis(time - 1) });
  await db
    .doc("users/u/requests/new")
    .set({ expiresAt: Timestamp.fromMillis(time + 100000) });
  await store.cleanup();
  expect((await db.doc("users/u/requests/old").get()).exists).toBe(false);
  expect((await db.doc("users/u/requests/new").get()).exists).toBe(true);
});
it("reclaims stale OCR lease without repeating the paid request", async () => {
  const p = payload();
  const r = await store.reserve("stale", "ocr", p);
  time += 91000;
  await expect(store.reserve("stale", "ocr", p)).rejects.toMatchObject({
    details: { code: "REPEAT_OCR_REQUIRES_NEW_REQUEST" },
  });
  expect((await r.req.get()).data().status).toBe("failed");
  const fresh = await store.reserve("stale", "ocr", payload());
  expect(fresh.duplicate).toBe(false);
});
it("enforces the five OCR attempts per-user daily cap", async () => {
  for (let i = 0; i < 5; i++) {
    const r = await store.reserve("limited", "ocr", payload());
    await store.finish(r, "ocr");
    time += 61000;
  }
  await expect(
    store.reserve("limited", "ocr", payload()),
  ).rejects.toMatchObject({ details: { code: "RATE_LIMITED" } });
});
it("keeps per-user quota records isolated", async () => {
  await store.reserve("alice", "analysis", payload());
  await store.reserve("bob", "analysis", payload());
  const day = new Date(time).toISOString().slice(0, 10);
  for (const uid of ["alice", "bob"])
    expect(
      (await db.doc(`users/${uid}/usage/${day}`).get()).data().analysisCount,
    ).toBe(1);
});
