import { defineConfig, devices } from "@playwright/test";
const port = process.env.E2E_PORT || "5173";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROME_PATH
      ? {
          launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH },
        }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
