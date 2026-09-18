import { readFile, writeFile } from "node:fs/promises";
import { analyze } from "../functions/src/analysis/engine.js";
import { analysisInput } from "../shared/contracts.js";
const dataset = JSON.parse(
  await readFile("tests/fixtures/benchmark.json", "utf8"),
);
let positiveTotal = 0,
  positiveMatched = 0,
  benignTotal = 0,
  benignSignificant = 0,
  spanCount = 0;
const failures = [];
for (const f of dataset.fixtures) {
  const input = analysisInput.parse({
    requestId: crypto.randomUUID(),
    text: f.text,
    language: f.language,
    incomplete: f.incomplete,
    interaction: f.interaction,
    source: "message",
    confirmed: true,
  });
  const result = analyze(input); // Includes source and span validation.
  const ids = result.warnings.map((w) => w.ruleId);
  if (f.group === "positive") {
    positiveTotal += f.expectedRules.length;
    positiveMatched += f.expectedRules.filter((id) => ids.includes(id)).length;
  }
  if (f.group === "benign") {
    benignTotal++;
    if (result.assessment === "significant_warning_signs") benignSignificant++;
  }
  spanCount += result.warnings.flatMap((w) => w.evidence).length;
  if (
    JSON.stringify(ids) !== JSON.stringify(f.expectedRules) ||
    result.assessment !== f.expectedAssessment ||
    result.actions[0].id !== f.expectedFirstAction
  )
    failures.push(f.id);
}
const result = {
  status: "DEVELOPER REGRESSION ONLY — NOT RELEASE ACCEPTANCE",
  fixtures: dataset.fixtures.length,
  positivePatternRecall: positiveMatched / positiveTotal,
  benignSignificantRate: benignSignificant / benignTotal,
  validatedEvidenceSpans: spanCount,
  fixtureFailures: failures,
  independentReviewComplete: false,
  realOcrEvaluated: false,
  warning:
    "Templated fixtures are not independent held-out evidence or real-world scam detection accuracy. Eight benign advice examples intentionally expose false positives.",
};
await writeFile(
  "docs/benchmark-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
