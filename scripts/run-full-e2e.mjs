import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RUN_FULL_E2E: "true",
      VITE_USE_EMULATORS: "true",
      VITE_FIREBASE_API_KEY: "demo-key",
      VITE_FIREBASE_PROJECT_ID: "demo-scam-shield",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-scam-shield.firebaseapp.com",
      VITE_FIREBASE_APP_ID: "demo-scam-shield",
    },
  },
);
process.exitCode = result.status ?? 1;
