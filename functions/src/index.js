import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { createStore } from "./security/store.js";
import { fail, parse } from "./security/errors.js";
import {
  analysisInput,
  imageInput,
  emptyInput,
  deleteInput,
} from "../shared/contracts.js";
import { analyze } from "./analysis/engine.js";
import { decodeImage, extractText } from "./providers/ocr.js";
initializeApp();
const db = getFirestore(),
  auth = getAuth();
const local =
  process.env.FUNCTIONS_EMULATOR === "true" &&
  (process.env.GCLOUD_PROJECT || "").startsWith("demo-");
const key = defineSecret("PAYLOAD_HMAC_KEY");
const region = defineString("FUNCTIONS_REGION", {
  description: "Approved deployment region. Set explicitly before deploying.",
  default: "us-central1",
});
const store = createStore(db, auth, {
  hmacKey: () => (local ? "emulator-only-nonproduction-key" : key.value()),
});
const options = {
  region,
  timeoutSeconds: 30,
  memory: "512MiB",
  concurrency: 4,
  maxInstances: 5,
  enforceAppCheck: !local,
  secrets: [key],
};
function callable(name, schema, handler, extra = {}) {
  return onCall({ ...options, ...extra }, async (request) => {
    const started = Date.now();
    let requestId;
    try {
      const uid = await store.identity(request, {
        recent: name === "deleteAccount",
        emulator: local,
      });
      if (request.rawRequest?.rawBody?.length > 6 * 1024 * 1024)
        fail("INVALID_INPUT");
      const input = parse(schema, request.data);
      requestId = input.requestId;
      const result = await handler(uid, input);
      logger.info("request", {
        function: name,
        requestId: requestId || null,
        duration: Date.now() - started,
        status: "ok",
        rulesVersion: "rules-1.0",
      });
      return result;
    } catch (e) {
      const typed = e instanceof HttpsError;
      const code = typed ? e.details?.code || "INTERNAL" : "INTERNAL";
      logger.warn("request", {
        function: name,
        requestId: requestId || null,
        duration: Date.now() - started,
        status: code,
        rulesVersion: "rules-1.0",
      });
      if (typed) throw e;
      fail("INTERNAL", requestId ? { requestId } : {});
    }
  });
}
export const ensureProfile = callable("ensureProfile", emptyInput, (uid) =>
  store.profile(uid),
);
export const analyzeMessage = callable(
  "analyzeMessage",
  analysisInput,
  async (uid, input) => {
    const reservation = await store.reserve(uid, "analysis", input);
    const result = analyze(input);
    await store.finish(reservation, "analysis");
    return result;
  },
);
export const extractScreenshot = callable(
  "extractScreenshot",
  imageInput,
  async (uid, input) => {
    const bytes = await decodeImage(input.imageBase64, input.mimeType);
    const reservation = await store.reserve(uid, "ocr", input);
    try {
      const text = await extractText(bytes, {
        mock: local && process.env.OCR_PROVIDER !== "vision",
      });
      await store.finish(reservation, "ocr");
      return {
        requestId: input.requestId,
        extractedText: text,
        reviewRequired: true,
        schemaVersion: "1.0",
      };
    } catch (e) {
      await store.finish(
        reservation,
        "ocr",
        e.details?.code || "PROVIDER_UNAVAILABLE",
      );
      throw e;
    }
  },
  { memory: "1GiB", concurrency: 1, maxInstances: 3 },
);
export const deleteAccount = callable("deleteAccount", deleteInput, (uid) =>
  store.startDeletion(uid),
);
export const processDeletion = onDocumentCreated(
  {
    document: "deletionJobs/{uid}",
    region,
    timeoutSeconds: 300,
    maxInstances: 2,
  },
  (event) => store.deleteUser(event.params.uid),
);
export const retryDeletions = onSchedule(
  {
    schedule: "every 15 minutes",
    region,
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const jobs = await db
      .collection("deletionJobs")
      .where("status", "in", ["pending", "processing"])
      .get();
    for (const j of jobs.docs) {
      if (Date.now() - j.data().requestedAt.toMillis() > 86400000)
        logger.error("deletion_overdue", { status: "overdue" });
      await store.deleteUser(j.id);
    }
  },
);
export const cleanupMetadata = onSchedule(
  {
    schedule: "every 60 minutes",
    region,
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const last = (await db.doc("operations/cleanup").get()).data();
    if (last && Date.now() - last.completedAt.toMillis() > 86400000)
      logger.error("cleanup_overdue", { status: "overdue" });
    await store.cleanup();
  },
);
