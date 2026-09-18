import { test, expect } from "@playwright/test";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
test.describe("full emulator journeys", () => {
  test.skip(
    process.env.RUN_FULL_E2E !== "true",
    "Start Auth, Firestore and Functions emulators and set RUN_FULL_E2E=true.",
  );
  let auth, db;
  test.beforeAll(async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    const app = initializeApp(
      { projectId: "demo-scam-shield" },
      `browser-${Date.now()}`,
    );
    auth = getAuth(app);
    db = getFirestore(app);
    await db.doc("runtimeConfig/service").set({
      enabled: true,
      ocrEnabled: true,
      dailyOcrCap: 100,
      quotaPolicyVersion: "1",
    });
  });
  async function signIn(page) {
    const email = `browser-${crypto.randomUUID()}@example.com`,
      password = "test-password-long-123";
    const user = await auth.createUser({
      email,
      password,
      emailVerified: true,
    });
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Check message" }),
    ).toBeEnabled();
    return { user, email, password };
  }
  test("sign up, verify, analyze and reorder recovery guidance", async ({
    page,
  }) => {
    const email = `new-${crypto.randomUUID()}@example.com`;
    await page.goto("/sign-up");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("a-password-at-least-12");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Verify your email" }),
    ).toBeVisible();
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { emailVerified: true });
    await page
      .getByRole("button", { name: "I have verified my email" })
      .click();
    await page.getByRole("link", { name: "Continue to checker" }).click();
    await page.getByRole("textbox").fill("Urgent: send your OTP immediately.");
    await page.getByRole("button", { name: "Check message" }).click();
    await expect(
      page.getByRole("heading", { name: "Significant warning signs" }),
    ).toBeVisible();
    await expect(
      page.getByText("send your OTP", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Already responded?").selectOption("sent_money");
    await expect(
      page.getByRole("heading", {
        name: "Contact your bank or payment provider now",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Check message" }),
    ).toBeDisabled();
  });
  test("screenshot requires review before trusted analysis", async ({
    page,
  }) => {
    await signIn(page);
    await page.getByRole("tab", { name: "Upload screenshot" }).click();
    await page
      .getByLabel("Choose screenshot", { exact: true })
      .setInputFiles("tests/fixtures/screenshots/screenshot-01.png");
    await page
      .getByRole("button", { name: "Extract text", exact: true })
      .click();
    await expect(page.getByRole("textbox")).toHaveValue(
      "Urgent: send your OTP immediately.",
      { timeout: 30000 },
    );
    await expect(
      page.getByRole("button", { name: "Check message" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Significant warning signs" }),
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", {
        name: "I reviewed this text and confirmed its language.",
      })
      .check();
    await page.getByRole("button", { name: "Check message" }).click();
    await expect(
      page.getByRole("heading", { name: "Significant warning signs" }),
    ).toBeVisible();
  });
  test("reauthenticated deletion blocks checks and removes account", async ({
    page,
  }) => {
    const { user, password } = await signIn(page);
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await page.getByLabel("Confirm your password").fill(password);
    await page
      .getByRole("checkbox", {
        name: "I understand this deletion is permanent.",
      })
      .check();
    await page
      .getByRole("button", { name: "Permanently delete account" })
      .click();
    await expect(
      page.getByText("Deletion has started.", { exact: false }),
    ).toBeVisible();
    await expect
      .poll(
        async () => {
          try {
            await auth.getUser(user.uid);
            return false;
          } catch {
            return true;
          }
        },
        { timeout: 30000 },
      )
      .toBe(true);
  });
});
