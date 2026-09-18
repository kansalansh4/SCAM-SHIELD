import { access, copyFile, writeFile } from "node:fs/promises";
import "./sync-shared.mjs";
for (const [file, content] of [
  ["functions/.env.local", "FUNCTIONS_REGION=us-central1\nOCR_PROVIDER=mock\n"],
  [
    "functions/.secret.local",
    "PAYLOAD_HMAC_KEY=emulator-only-nonproduction-key\n",
  ],
]) {
  try {
    await access(file);
  } catch {
    await writeFile(file, content);
  }
}
