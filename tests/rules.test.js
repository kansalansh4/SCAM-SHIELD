import { describe, it, expect } from "vitest";
import { analyze } from "../functions/src/analysis/engine.js";
import { actionsFor } from "../shared/catalog.js";
const input = (text, extra = {}) => ({
  requestId: "11111111-1111-4111-8111-111111111111",
  text,
  language: "en",
  source: "message",
  confirmed: true,
  interaction: "none",
  ...extra,
});
export const run = (text, extra) => analyze(input(text, extra));
describe("SDD rule fixtures", () => {
  it.each([
    [
      "Urgent: send your OTP immediately.",
      ["R01", "R03"],
      "significant_warning_signs",
    ],
    ["Your account will be suspended.", ["R02"], "some_warning_signs"],
    [
      "You won a prize. Pay the fee to claim it.",
      ["R05"],
      "some_warning_signs",
    ],
    [
      "Please buy gift cards for this payment.",
      ["R04"],
      "significant_warning_signs",
    ],
    ["Team meeting tomorrow at 10 am.", [], "no_listed_signs"],
    ["Read the agenda at https://example.com.", [], "no_listed_signs"],
    [
      "Please review https://bit.ly/example today.",
      ["R08"],
      "some_warning_signs",
    ],
    ["Never share your OTP with anyone.", ["R03"], "significant_warning_signs"],
    [
      "This is a risk-free investment opportunity.",
      ["R06"],
      "significant_warning_signs",
    ],
    [
      "Please install AnyDesk on your computer.",
      ["R07"],
      "significant_warning_signs",
    ],
    [
      "There is remote access on your machine.",
      ["R07"],
      "significant_warning_signs",
    ],
    ["My accounts were locked yesterday.", ["R02"], "some_warning_signs"],
    ["Read https://bit.ly.evil.example/ today.", [], "no_listed_signs"],
    ["Read https://example.com/path?x=bit.ly today.", [], "no_listed_signs"],
    [
      "Read https://trusted.example@evil.example/ now.",
      ["R08"],
      "some_warning_signs",
    ],
    ["Read https://xn--pple-43d.com/ tomorrow.", ["R08"], "some_warning_signs"],
    ["Unurgently sharing vocabulary in a meeting.", [], "no_listed_signs"],
  ])("%s", (text, ids, assessment) => {
    const r = run(text);
    expect(r.warnings.map((w) => w.ruleId)).toEqual(ids);
    expect(r.assessment).toBe(assessment);
    for (const w of r.warnings)
      for (const e of w.evidence)
        expect(text.slice(e.start, e.end)).toBe(e.quote);
  });
  it("uses the worked example offsets", () => {
    const r = run("Urgent: send your OTP immediately.");
    expect(r.warnings[0].evidence).toEqual([
      { start: 0, end: 6, quote: "Urgent" },
    ]);
    expect(r.warnings[1].evidence).toEqual([
      { start: 8, end: 21, quote: "send your OTP" },
    ]);
  });
  it("preserves UTF-16 offsets and whitespace", () => {
    const text = "😀 Please share\n\t your OTP with us.";
    const e = run(text).warnings[0].evidence[0];
    expect(e.quote).toBe("share\n\t your OTP");
    expect(text.slice(e.start, e.end)).toBe(e.quote);
  });
  it("does not join phrases more than 160 code units apart", () =>
    expect(
      run("send " + "x".repeat(161) + " OTP please.").warnings,
    ).toHaveLength(0));
  it("uses shortest matching span and counts each rule once", () => {
    const r = run(
      "Urgent urgent immediately. Please send your password and send OTP.",
    );
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[1].evidence[0].quote).toBe("send OTP");
  });
  it("upgrades four low-weight points", () =>
    expect(
      run("Urgent! Your account is suspended. Read https://bit.ly/a")
        .assessment,
    ).toBe("significant_warning_signs"));
  it.each([
    { language: "other" },
    { language: "unsure" },
    { incomplete: true },
  ])("handles unsupported or incomplete input %j", (extra) => {
    const r = run("Urgent: send your OTP immediately.", extra);
    expect(r.assessment).toBe("insufficient_information");
    expect(r.warnings).toHaveLength(0);
  });
  it.each([
    ["sent_money", "bank"],
    ["shared_password", "secure-account"],
    ["shared_details", "protect-details"],
    ["clicked", "stop"],
    ["none", "pause"],
  ])("prioritizes context %s", (context, id) =>
    expect(actionsFor(["R03", "R04", "R05", "R07", "R08"], context)[0].id).toBe(
      id,
    ),
  );
  it("caps actions, deduplicates payment and preserves final evidence action", () => {
    const a = actionsFor(["R03", "R04", "R05", "R07", "R08"]);
    expect(a).toHaveLength(5);
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    expect(a.at(-1).id).toBe("evidence");
  });
  it("changing context does not change assessment", () =>
    expect(
      run("Urgent: send your OTP immediately.", { interaction: "sent_money" })
        .assessment,
    ).toBe(run("Urgent: send your OTP immediately.").assessment));
});
it("quotes only the URL property rather than private query data", () => {
  const r = run(
    "Please see https://bit.ly/a?private=personal-information for details.",
  );
  expect(r.warnings[0].evidence[0].quote).toBe("bit.ly");
});
it("detects shorteners even with a very long path", () => {
  const r = run("See https://tinyurl.com/" + "a".repeat(500));
  expect(r.warnings[0].ruleId).toBe("R08");
  expect(r.warnings[0].evidence[0].quote).toBe("tinyurl.com");
});
