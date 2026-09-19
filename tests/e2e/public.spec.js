import { test, expect } from "@playwright/test";
test("public checker explains access and never enables anonymous checks", async ({
  page,
}) => {
  await page.goto("/check");
  await expect(
    page.getByRole("heading", { name: "Something feel off?" }),
  ).toBeVisible();
  await page.getByRole("textbox").fill("Urgent: send your OTP immediately.");
  await expect(
    page.getByRole("button", { name: "Check message" }),
  ).toBeDisabled();
  await expect(page.getByText("A verified account is required")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("");
});
test("screenshot notice, deliberate mode switch and accessible keyboard tabs", async ({
  page,
}) => {
  await page.goto("/check");
  await page.getByRole("tab", { name: "Paste a message" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Upload screenshot" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText(/When you choose Extract text|Text is extracted on your device/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extract text" }),
  ).toBeDisabled();
});
test("320px and 200% text size have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/check");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
test("public guidance, privacy and auth routes render", async ({ page }) => {
  for (const [url, title] of [
    ["/help", "Help when something feels wrong."],
    ["/privacy", "Your message is yours."],
    ["/sign-up", "Create your account"],
    ["/verify-email", "Verify your email"],
    ["/account", "Your account"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
});
test("refresh does not retain the draft", async ({ page }) => {
  await page.goto("/check");
  await page.getByRole("textbox").fill("This is a confidential draft message");
  await page.reload();
  await expect(page.getByRole("textbox")).toHaveValue("");
});
