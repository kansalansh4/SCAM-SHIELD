import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile("dist/deployment-metadata.json", "utf8"),
);
if (
  config.emulator ||
  !config.configured ||
  !config.projectId ||
  config.projectId.startsWith("demo-") ||
  !config.region
)
  throw Error(
    "Refusing to deploy an emulator/unconfigured build. Build with approved Firebase web config, App Check key, region, and VITE_USE_EMULATORS=false.",
  );
if (
  !process.env.GCLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT !== config.projectId
)
  throw Error(
    "Build project does not match the Firebase CLI deployment target. Rebuild for the selected project.",
  );
console.log(
  "Build configuration matches deployment target. Owner release sign-off is still required.",
);
