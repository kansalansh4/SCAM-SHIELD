import { HttpsError } from "firebase-functions/v2/https";
const codes = {
  INVALID_INPUT: "invalid-argument",
  UNSUPPORTED_IMAGE: "invalid-argument",
  UNAUTHENTICATED: "unauthenticated",
  EMAIL_NOT_VERIFIED: "permission-denied",
  APP_CHECK_REQUIRED: "unauthenticated",
  ACCOUNT_DELETING: "failed-precondition",
  RATE_LIMITED: "resource-exhausted",
  REQUEST_IN_PROGRESS: "already-exists",
  REPEAT_OCR_REQUIRES_NEW_REQUEST: "failed-precondition",
  OCR_UNREADABLE: "failed-precondition",
  OCR_TIMEOUT: "deadline-exceeded",
  PROVIDER_UNAVAILABLE: "unavailable",
  SERVICE_UNAVAILABLE: "unavailable",
  REAUTH_REQUIRED: "failed-precondition",
  INTERNAL: "internal",
};
export function fail(code, extra = {}) {
  throw new HttpsError(codes[code] || "internal", code, { code, ...extra });
}
export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success)
    fail("INVALID_INPUT", {
      fields: [...new Set(r.error.issues.map((i) => i.path[0] || "input"))],
    });
  return r.data;
}
