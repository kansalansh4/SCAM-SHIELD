import { createWorker } from "tesseract.js";
let running = false;
export async function extractLocal(file) {
  if (running)
    throw Object.assign(new Error("Extraction in progress"), {
      details: { code: "REQUEST_IN_PROGRESS" },
    });
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw Object.assign(new Error("Unsupported image"), {
      details: { code: "UNSUPPORTED_IMAGE" },
    });
  running = true;
  let worker, bitmap, timer;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 20000000)
      throw Object.assign(new Error("Image too large"), {
        details: { code: "UNSUPPORTED_IMAGE" },
      });
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    bitmap = null;
    // Local worker, WASM and English model: screenshots never leave this browser.
    worker = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr",
      cacheMethod: "none",
    });
    const result = await Promise.race([
      worker.recognize(canvas),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("OCR timeout"), {
                details: { code: "OCR_TIMEOUT" },
              }),
            ),
          90000,
        );
      }),
    ]);
    return result.data.text;
  } finally {
    clearTimeout(timer);
    bitmap?.close();
    if (worker) await worker.terminate();
    running = false;
  }
}
