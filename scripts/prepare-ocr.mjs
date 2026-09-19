import { mkdir, copyFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
await mkdir("public/ocr/core", { recursive: true });
await copyFile(
  require.resolve("tesseract.js/dist/worker.min.js"),
  "public/ocr/worker.min.js",
);
const core = dirname(require.resolve("tesseract.js-core/package.json"));
for (const file of await readdir(core)) {
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(join(core, file), join("public/ocr/core", file));
}
const language = dirname(
  require.resolve("@tesseract.js-data/eng/package.json"),
);
await copyFile(
  join(language, "4.0.0_best_int", "eng.traineddata.gz"),
  "public/ocr/eng.traineddata.gz",
);
