import { z } from "zod";
import { INTERACTIONS, SOURCES } from "./catalog.js";
export const codePoints = (s) => Array.from(s).length;
export const textSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => codePoints(s) >= 20 && codePoints(s) <= 10000, {
    message: "Enter 20–10,000 characters.",
  });
export const analysisInput = z
  .object({
    requestId: z.uuid(),
    text: textSchema,
    source: z.enum(["message", "screenshot"]),
    language: z.enum(["en", "other", "unsure"]),
    interaction: z.enum(Object.keys(INTERACTIONS)),
    confirmed: z.literal(true),
    incomplete: z.boolean().optional().default(false),
  })
  .strict();
export const imageInput = z
  .object({
    requestId: z.uuid(),
    imageBase64: z.string().min(4).max(5592408),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();
export const emptyInput = z.object({}).strict();
export const deleteInput = z.object({ requestId: z.uuid() }).strict();
const sourceIds = z.array(z.enum(Object.keys(SOURCES))).min(1);
export const resultSchema = z.object({
  requestId: z.uuid(),
  schemaVersion: z.literal("1.0"),
  rulesVersion: z.literal("rules-1.0"),
  assessment: z.enum([
    "significant_warning_signs",
    "some_warning_signs",
    "no_listed_signs",
    "insufficient_information",
  ]),
  summary: z.string(),
  analyzedAt: z.iso.datetime(),
  warnings: z.array(
    z.object({
      ruleId: z.enum(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"]),
      title: z.string(),
      explanation: z.string(),
      evidence: z
        .array(
          z.object({
            start: z.number().int().nonnegative(),
            end: z.number().int().positive(),
            quote: z.string().min(1).max(160),
          }),
        )
        .min(1),
      sourceIds,
    }),
  ),
  actions: z
    .array(
      z.object({
        id: z.string(),
        priority: z.number().int().positive(),
        title: z.string(),
        detail: z.string(),
        sourceIds,
      }),
    )
    .min(1)
    .max(5),
  limitations: z.array(z.string()).min(1),
  sources: z.array(
    z.object({
      id: z.enum(Object.keys(SOURCES)),
      title: z.string(),
      url: z.url(),
    }),
  ),
});
export function validateReport(result, text) {
  resultSchema.parse(result);
  if (
    new Set(result.warnings.map((w) => w.ruleId)).size !==
    result.warnings.length
  )
    throw new Error("Duplicate warning");
  for (const warning of result.warnings)
    for (const e of warning.evidence)
      if (text.slice(e.start, e.end) !== e.quote || e.end <= e.start)
        throw new Error("Invalid evidence");
  for (const s of result.sources)
    if (SOURCES[s.id].url !== s.url || SOURCES[s.id].title !== s.title)
      throw new Error("Invalid source");
  const ids = new Set(result.sources.map((s) => s.id));
  for (const item of [...result.warnings, ...result.actions])
    if (item.sourceIds.some((id) => !ids.has(id)))
      throw new Error("Missing source");
  return result;
}
