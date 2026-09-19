import { publicFirebaseConfig } from "./public-config.js";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserSessionPersistence,
  deleteUser,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
const env = import.meta.env;
export const emulator = env.VITE_USE_EMULATORS === "true";
export const freeDeployment =
  !emulator && (env.VITE_BACKEND || "browser") === "browser";
const defaults = freeDeployment ? publicFirebaseConfig : {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaults.apiKey,
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaults.projectId,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaults.authDomain,
  appId: env.VITE_FIREBASE_APP_ID || defaults.appId,
};
export const configured =
  emulator ||
  Boolean(
    config.apiKey &&
      config.projectId &&
      config.appId &&
      (freeDeployment || env.VITE_APPCHECK_SITE_KEY),
  );
const app = configured
  ? initializeApp({
      apiKey: config.apiKey || "demo-key",
      projectId: config.projectId || "demo-scam-shield",
      authDomain: config.authDomain || "demo-scam-shield.firebaseapp.com",
      appId: config.appId || "demo-scam-shield",
    })
  : null;
export const auth = app ? getAuth(app) : null;
const functions = app
  ? getFunctions(app, env.VITE_FUNCTIONS_REGION || "us-central1")
  : null;
if (emulator && app) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
if (app && !emulator && !freeDeployment)
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
export const authReady = auth
  ? setPersistence(auth, browserSessionPersistence)
  : Promise.resolve();
export async function call(name, data) {
  if (!configured) throw new Error("Service setup is pending.");
  if (freeDeployment) {
    const user = auth.currentUser;
    if (!user)
      throw Object.assign(new Error("Sign in again"), {
        details: { code: "UNAUTHENTICATED" },
      });
    await user.reload();
    if (!user.emailVerified)
      throw Object.assign(new Error("Verify your email"), {
        details: { code: "EMAIL_NOT_VERIFIED" },
      });
    if (name === "ensureProfile") return { status: "active" };
    if (name === "deleteAccount") {
      await deleteUser(user);
      return { status: "deleted" };
    }
    if (name === "analyzeMessage") {
      const { analyze } = await import("../../shared/engine.js");
      const { analysisInput } = await import("../../shared/contracts.js");
      const parsed = analysisInput.safeParse(data);
      if (!parsed.success)
        throw Object.assign(new Error("Invalid input"), {
          details: { code: "INVALID_INPUT" },
        });
      return analyze(parsed.data);
    }
    throw Object.assign(new Error("Unsupported operation"), {
      details: { code: "INVALID_INPUT" },
    });
  }
  return (await httpsCallable(functions, name, { timeout: 35000 })(data)).data;
}
export function errorMessage(error) {
  const code = error.details?.code;
  const messages = {
    INVALID_INPUT:
      "Check your input. Use 20–10,000 characters and complete the required fields.",
    UNSUPPORTED_IMAGE:
      "Choose one valid JPEG, PNG or WebP, no larger than 4 MiB and 20 megapixels.",
    UNAUTHENTICATED: "Your session has expired. Sign in again.",
    EMAIL_NOT_VERIFIED:
      "Verify your email, then refresh your verification status.",
    APP_CHECK_REQUIRED:
      "This browser could not be verified. Refresh the page and try again.",
    ACCOUNT_DELETING:
      "Your account is being deleted. New checks are unavailable.",
    REAUTH_REQUIRED: "Sign in again to confirm account deletion.",
    RATE_LIMITED: `You have reached a checking limit. Try again in ${error.details?.retryAfterSeconds || 60} seconds.`,
    REQUEST_IN_PROGRESS:
      "An extraction is already running. Wait before trying again.",
    REPEAT_OCR_REQUIRES_NEW_REQUEST:
      "That extraction cannot be retrieved because we do not store its text. Choose Extract text again for a new attempt; it counts toward your quota.",
    OCR_UNREADABLE:
      "We could not read text. Try a clearer crop or paste the message instead.",
    OCR_TIMEOUT:
      "Extraction timed out. Try a smaller, clearer image or paste the message text.",
    PROVIDER_UNAVAILABLE:
      "Text extraction is temporarily unavailable. Keep this tab open and retry, or paste text.",
    SERVICE_UNAVAILABLE:
      "Checking is temporarily unavailable. Please try again later.",
    INTERNAL: "Something went wrong. Keep this tab open and try again.",
  };
  if (messages[code]) return messages[code];
  if (error.code === "functions/deadline-exceeded")
    return "The response took too long. A screenshot request may still have been charged. Retry deliberately or paste text.";
  return navigator.onLine
    ? "We could not complete that request. Please try again."
    : "You are offline. Your draft stays in this tab. Reconnect and retry.";
}
