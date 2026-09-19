import {
  RULES_VERSION,
  SCHEMA_VERSION,
  SOURCES,
  LIMITATIONS,
  actionsFor,
} from "./catalog.js";
import { validateReport } from "./contracts.js";
const rules = [
  [
    "R01",
    1,
    "Pressure to act quickly",
    "Pressure can reduce the time you have to verify a request.",
    "S6",
    ["urgent", "immediately", "act now", "within 24 hours", "final warning"],
  ],
  [
    "R02",
    2,
    "Threatened account access",
    "Threatened loss of access may prompt hurried action.",
    "S5",
    ["accounts?", "access"],
    ["suspended", "locked", "closed", "disabled"],
  ],
  [
    "R03",
    3,
    "Request for a password or code",
    "A request to disclose credentials or security codes deserves strong caution.",
    "S5",
    ["send", "share", "reply with", "give"],
    ["passwords?", "OTPs?", "one-time codes?", "verification codes?", "PINs?"],
  ],
  [
    "R04",
    3,
    "Hard-to-reverse payment request",
    "The requested payment method may be difficult to reverse.",
    "S6",
    ["pay", "send", "buy", "transfer"],
    [
      "gift cards?",
      "bitcoins?",
      "cryptocurrenc(?:y|ies)",
      "cryptos?",
      "wire transfers?",
    ],
  ],
  [
    "R05",
    2,
    "Payment to claim a reward",
    "Payment to claim a reward is a common warning pattern.",
    "S6",
    ["won", "prizes?", "lotter(?:y|ies)", "rewards?"],
    ["fees?", "pay", "deposits?", "tax(?:es)?"],
  ],
  [
    "R06",
    3,
    "Guaranteed investment claim",
    "Claims of certainty about an investment deserve scrutiny.",
    "S11",
    ["guaranteed", "risk-free"],
    ["returns?", "profits?", "investments?"],
  ],
  [
    "R07",
    2,
    "Request for device access",
    "A request for device access can expose your information.",
    "S12",
    ["install", "download", "remote access"],
    ["AnyDesk", "TeamViewer", "remote support", "remote access"],
  ],
];
function matchingView(text) {
  let view = "",
    starts = [],
    ends = [];
  for (let i = 0; i < text.length; ) {
    const cp = String.fromCodePoint(text.codePointAt(i));
    let end = i + cp.length;
    if (/\s/u.test(cp)) {
      while (end < text.length && /\s/u.test(text[end])) end++;
      view += " ";
      starts.push(i);
      ends.push(end);
    } else {
      view += cp;
      for (let j = 0; j < cp.length; j++) {
        starts.push(i + j);
        ends.push(i + j + 1);
      }
    }
    i = end;
  }
  return { view, starts, ends };
}
function hits(view, vocabulary) {
  return [
    ...view.matchAll(new RegExp(`\\b(?:${vocabulary.join("|")})\\b`, "gi")),
  ].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}
function smallest(a, b, mapping, text) {
  let best;
  for (const x of a)
    for (const y of b || [x]) {
      const start = mapping.starts[Math.min(x.start, y.start)],
        end = mapping.ends[Math.max(x.end, y.end) - 1];
      if (
        end - start <= 160 &&
        (!best ||
          end - start < best.end - best.start ||
          (end - start === best.end - best.start && start < best.start))
      )
        best = { start, end, quote: text.slice(start, end) };
    }
  return best;
}
export function analyze(input, now = new Date()) {
  const { text, requestId, language, interaction, incomplete } = input;
  const warnings = [];
  let weight = 0;
  if (language === "en" && !incomplete) {
    const mapping = matchingView(text);
    for (const [ruleId, score, title, explanation, source, a, b] of rules) {
      const evidence = smallest(
        hits(mapping.view, a),
        b ? hits(mapping.view, b) : null,
        mapping,
        text,
      );
      if (evidence) {
        weight += score;
        warnings.push({
          ruleId,
          title,
          explanation,
          evidence: [evidence],
          sourceIds: [source],
        });
      }
    }
    const urlHits = [];
    for (const m of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi)) {
      const raw = m[0].replace(/[.,;!?\])}]+$/g, "");
      try {
        const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
        const properties = [];
        if (
          ["bit.ly", "tinyurl.com", "t.co", "is.gd"].includes(
            url.hostname.toLowerCase(),
          )
        )
          properties.push("a shortened-link hostname");
        if (url.username || url.password)
          properties.push("user information before the hostname");
        if (url.hostname.split(".").some((p) => p.startsWith("xn--")))
          properties.push("an internationalized (punycode) hostname");
        if (properties.length) {
          const authority = raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
          const at = authority.lastIndexOf("@");
          const hostPart = authority.slice(at + 1).replace(/:\d+$/, "");
          // Quote only the host, or the user-info delimiter plus host, not a private URL path/query.
          const fragment =
            url.username || url.password ? authority.slice(at) : hostPart;
          const offset =
            raw.indexOf(authority) +
            (url.username || url.password ? at : at + 1);
          if (fragment.length <= 160)
            urlHits.push({
              e: {
                start: m.index + offset,
                end: m.index + offset + fragment.length,
                quote: fragment,
              },
              properties,
            });
        }
      } catch {
        /* A malformed URL is not a reputation verdict. */
      }
    }
    if (urlHits.length) {
      const h = urlHits.sort(
        (a, b) => a.e.quote.length - b.e.quote.length || a.e.start - b.e.start,
      )[0];
      weight++;
      warnings.push({
        ruleId: "R08",
        title: "A link needs closer inspection",
        explanation: `This link contains ${h.properties.join(" and ")}. The destination is not verified; this alone is not proof of fraud.`,
        evidence: [h.e],
        sourceIds: ["S5"],
      });
    }
  }
  const assessment =
    language !== "en" || incomplete
      ? "insufficient_information"
      : warnings.some((w) => ["R03", "R04", "R06", "R07"].includes(w.ruleId)) ||
          weight >= 4
        ? "significant_warning_signs"
        : weight
          ? "some_warning_signs"
          : "no_listed_signs";
  const summaries = {
    significant_warning_signs:
      "This message contains warning patterns that deserve strong caution. Pause and verify independently.",
    some_warning_signs:
      "This message contains warning signs worth checking before you respond.",
    no_listed_signs:
      "None of our listed patterns matched. This does not establish that the message or sender is genuine.",
    insufficient_information:
      "There is not enough supported information to assess this text. Supply a complete, readable English version; translations can lose context.",
  };
  const actions = actionsFor(
    warnings.map((w) => w.ruleId),
    interaction,
  );
  const sourceIds = [
    ...new Set([...warnings, ...actions].flatMap((w) => w.sourceIds)),
  ];
  return validateReport(
    {
      requestId,
      schemaVersion: SCHEMA_VERSION,
      rulesVersion: RULES_VERSION,
      assessment,
      summary: summaries[assessment],
      analyzedAt: now.toISOString(),
      warnings,
      actions,
      limitations: LIMITATIONS,
      sources: sourceIds.map((id) => SOURCES[id]),
    },
    text,
  );
}
