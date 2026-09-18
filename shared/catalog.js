export const SCHEMA_VERSION = "1.0";
export const RULES_VERSION = "rules-1.0";
export const SOURCES = Object.freeze({
  S5: {
    id: "S5",
    title: "FTC: Recognize and avoid phishing scams (US)",
    url: "https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams",
  },
  S6: {
    id: "S6",
    title: "FTC: How to avoid a scam (US)",
    url: "https://consumer.ftc.gov/articles/how-avoid-scam",
  },
  S11: {
    id: "S11",
    title: "FTC: Investment scams (US)",
    url: "https://consumer.ftc.gov/articles/investment-scams",
  },
  S12: {
    id: "S12",
    title: "FTC: Tech support scams (US)",
    url: "https://consumer.ftc.gov/articles/how-spot-avoid-and-report-tech-support-scams",
  },
});
export const ASSESSMENTS = {
  significant_warning_signs: "Significant warning signs",
  some_warning_signs: "Some warning signs",
  no_listed_signs: "No listed signs",
  insufficient_information: "Insufficient information",
};
export const INTERACTIONS = {
  none: "I have not responded",
  clicked: "I clicked a link",
  shared_password: "I shared a password or code",
  shared_details: "I shared identity or payment details",
  sent_money: "I sent money",
};
export const LIMITATIONS = [
  "This checks a limited set of English text patterns. Missing signs do not mean a message is safe.",
  "We did not verify the sender, check link reputation, or open any supplied link.",
  "For screenshots, only the text you confirmed is assessed. Logos, QR codes and image authenticity are not checked.",
  "Quoted advice, negation and mixed languages can trigger or hide warning signs. Verify independently.",
];
const action = (id, title, detail, sourceIds = ["S6"]) => ({
  id,
  title,
  detail,
  sourceIds,
});
export function actionsFor(ruleIds, interaction = "none") {
  const first =
    {
      none: action(
        "pause",
        "Pause and verify independently",
        "Do not share credentials or pay in response to this message. Use an official app, a website you locate independently, or a phone number you already trust.",
      ),
      sent_money: action(
        "bank",
        "Contact your bank or payment provider now",
        "Use independently verified contact details. Ask about stopping or disputing the transfer. Save evidence and do not pay a recovery fee.",
      ),
      shared_password: action(
        "secure-account",
        "Secure the affected account",
        "Use the genuine service to change the password, review active sessions and enable MFA. Contact official support if you cannot sign in.",
        ["S5"],
      ),
      shared_details: action(
        "protect-details",
        "Contact the relevant institution",
        "Follow its account-protection process. Use an official identity-theft or fraud-reporting service for your country.",
      ),
      clicked: action(
        "stop",
        "Stop interacting with the message",
        "Do not install software or enter information. If you installed software, use trusted device-security support.",
        ["S5", "S12"],
      ),
    }[interaction] || null;
  if (!first) throw new Error("Unknown interaction");
  const extras = [];
  if (ruleIds.includes("R03"))
    extras.push(
      action(
        "codes",
        "Do not share passwords or security codes",
        "Verify the request through the service’s official app or a contact you already trust.",
        ["S5"],
      ),
    );
  if (ruleIds.some((x) => ["R04", "R05"].includes(x)))
    extras.push(
      action(
        "payment",
        "Do not make a requested payment",
        "Do not pay to claim a prize or buy gift cards for a stranger. Verify requests independently.",
      ),
    );
  if (ruleIds.includes("R07"))
    extras.push(
      action(
        "remote",
        "Refuse unexpected remote access",
        "Do not install remote-support software at an unknown sender’s request.",
        ["S12"],
      ),
    );
  if (ruleIds.includes("R08"))
    extras.push(
      action(
        "link",
        "Leave the supplied link unopened",
        "Find the service’s genuine site independently; a link’s appearance cannot establish trust.",
        ["S5"],
      ),
    );
  const end = action(
    "evidence",
    "Save evidence and consider reporting",
    "Keep a copy privately. Report through the platform or an official local fraud service. The FTC guidance below is US-specific.",
  );
  return [...new Map([first, ...extras].map((a) => [a.id, a])).values()]
    .slice(0, 4)
    .concat(end)
    .map((a, i) => ({ ...a, priority: i + 1 }));
}
