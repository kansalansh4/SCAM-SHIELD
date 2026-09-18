import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const contexts = [
  "none",
  "clicked",
  "shared_password",
  "shared_details",
  "sent_money",
];
const first = {
  none: "pause",
  clicked: "stop",
  shared_password: "secure-account",
  shared_details: "protect-details",
  sent_money: "bank",
};
const patterns = [
  ["R01", "This is urgent. Review the notice today.", "some_warning_signs"],
  [
    "R02",
    "Your account has been suspended. Contact the sender.",
    "some_warning_signs",
  ],
  [
    "R03",
    "Please share your verification code with us.",
    "significant_warning_signs",
  ],
  [
    "R04",
    "Please buy gift cards for this payment.",
    "significant_warning_signs",
  ],
  ["R05", "You won a prize. Pay the fee to claim it.", "some_warning_signs"],
  [
    "R06",
    "We offer guaranteed profit on your investment.",
    "significant_warning_signs",
  ],
  [
    "R07",
    "Please download TeamViewer for remote support.",
    "significant_warning_signs",
  ],
  [
    "R08",
    "Review the message at https://bit.ly/example today.",
    "some_warning_signs",
  ],
];
const prefixes = [
  "Hello. ",
  "Good morning. ",
  "Hi there. ",
  "Notice: ",
  "Message: ",
  "For your attention: ",
  "Update: ",
  "Dear reader, ",
  "A message for you: ",
  "Please read this: ",
];
const fixtures = [];
for (let r = 0; r < 8; r++)
  for (let n = 0; n < 10; n++) {
    const [id, text, assessment] = patterns[r],
      interaction = contexts[n % 5];
    fixtures.push({
      id: `positive-${r + 1}-${n + 1}`,
      group: "positive",
      text: prefixes[n] + text,
      language: "en",
      incomplete: false,
      interaction,
      expectedRules: [id],
      expectedAssessment: assessment,
      expectedFirstAction: first[interaction],
    });
  }
const benign = [
  "Team meeting tomorrow at 10 am. Bring the agenda.",
  "Read the agenda at https://example.com/meeting.",
  "Your library books are ready for collection.",
  "Your monthly statement is available in the official app.",
  "The school trip starts outside the main gate.",
  "We received your support ticket and will respond tomorrow.",
  "Your account preferences were updated successfully.",
  "The community newsletter is ready to read.",
  "Your appointment is on Wednesday at the usual clinic.",
];
for (let n = 0; n < 72; n++) {
  const interaction = contexts[n % 5];
  fixtures.push({
    id: `benign-${n + 1}`,
    group: "benign",
    text: prefixes[n % 10] + benign[n % 9],
    language: "en",
    incomplete: false,
    interaction,
    expectedRules: [],
    expectedAssessment: "no_listed_signs",
    expectedFirstAction: first[interaction],
  });
}
for (let n = 0; n < 8; n++)
  fixtures.push({
    id: `benign-advice-${n + 1}`,
    group: "benign",
    text:
      prefixes[n] +
      "Never share your OTP with anyone. This is security advice.",
    language: "en",
    interaction: "none",
    incomplete: false,
    expectedRules: ["R03"],
    expectedAssessment: "significant_warning_signs",
    expectedFirstAction: "pause",
    note: "Known false positive: negated security advice. Count this as benign significant, not a successful fraud classification.",
  });
for (let n = 0; n < 40; n++)
  fixtures.push({
    id: `insufficient-${n + 1}`,
    group: "ambiguous",
    text: prefixes[n % 10] + patterns[n % 8][1],
    language: n % 3 === 0 ? "other" : n % 3 === 1 ? "unsure" : "en",
    incomplete: n % 3 === 2,
    interaction: contexts[n % 5],
    expectedRules: [],
    expectedAssessment: "insufficient_information",
    expectedFirstAction: first[contexts[n % 5]],
  });
await mkdir("tests/fixtures/screenshots", { recursive: true });
await writeFile(
  "tests/fixtures/benchmark.json",
  JSON.stringify(
    {
      status: "developer-generated; independent review pending",
      reviewers: [],
      fixtures,
    },
    null,
    2,
  ) + "\n",
);
const images = [];
for (let n = 0; n < 30; n++) {
  const f = fixtures[n * 3],
    fontSize = [18, 24, 32][n % 3],
    foreground = n % 4 === 0 ? "#777" : "#122c44";
  const text = f.text;
  const lines = text.match(/.{1,44}(?:\s|$)/g) || [text];
  const escape = (t) => t.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240"><rect width="900" height="240" fill="white"/>${lines.map((l, i) => `<text x="${n % 2 ? 8 : 40}" y="${45 + i * (fontSize + 12)}" font-family="Arial" font-size="${fontSize}" fill="${foreground}">${escape(l)}</text>`).join("")}</svg>`;
  const file = `screenshot-${String(n + 1).padStart(2, "0")}.png`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`tests/fixtures/screenshots/${file}`);
  images.push({
    file,
    text,
    fixtureId: f.id,
    fontSize,
    contrast: n % 4 === 0 ? "reduced" : "normal",
    cropMargin: n % 2 ? 8 : 40,
  });
}
await writeFile(
  "tests/fixtures/screenshots/manifest.json",
  JSON.stringify(
    {
      status: "synthetic; real OCR and independent readability review pending",
      images,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Created ${fixtures.length} developer regression fixtures and ${images.length} synthetic screenshots.`,
);
