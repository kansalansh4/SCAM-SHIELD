import { it, expect } from "vitest";
import {
  textSchema,
  analysisInput,
  validateReport,
} from "../shared/contracts.js";
import { analyze } from "../functions/src/analysis/engine.js";
const base = {
  requestId: "11111111-1111-4111-8111-111111111111",
  text: "Team meeting tomorrow at 10 am.",
  source: "message",
  language: "en",
  interaction: "none",
  confirmed: true,
};
it.each([
  [19, false],
  [20, true],
  [10000, true],
  [10001, false],
])("code point length %s", (n, valid) =>
  expect(textSchema.safeParse("😀".repeat(n)).success).toBe(valid),
);
it("trims before validation", () =>
  expect(textSchema.parse("  " + "x".repeat(20) + "  ")).toBe("x".repeat(20)));
it("rejects extra fields and forged result input", () =>
  expect(analysisInput.safeParse({ ...base, verdict: "safe" }).success).toBe(
    false,
  ));
it("requires explicit confirmation", () =>
  expect(analysisInput.safeParse({ ...base, confirmed: false }).success).toBe(
    false,
  ));
it("rejects invented source URL", () => {
  const r = analyze(base);
  r.sources[0].url = "https://evil.example";
  expect(() => validateReport(r, base.text)).toThrow("Invalid source");
});
it("rejects invented evidence", () => {
  const text = "Urgent: send your OTP immediately.";
  const r = analyze({ ...base, text });
  r.warnings[0].evidence[0].start = 1;
  expect(() => validateReport(r, text)).toThrow();
});
