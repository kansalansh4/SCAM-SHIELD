import sharp from "sharp";
import { fail } from "../security/errors.js";
export async function decodeImage(imageBase64, mimeType) {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      imageBase64,
    )
  )
    fail("UNSUPPORTED_IMAGE");
  const bytes = Buffer.from(imageBase64, "base64");
  if (bytes.length > 4 * 1024 * 1024 || !bytes.length)
    fail("UNSUPPORTED_IMAGE");
  const signature = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : null;
  if (signature !== mimeType) fail("UNSUPPORTED_IMAGE");
  try {
    const pipeline = sharp(bytes, {
      limitInputPixels: 20000000,
      failOn: "warning",
    });
    const meta = await pipeline.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 20000000 ||
      (meta.pages || 1) > 1 ||
      !["png", "jpeg", "webp"].includes(meta.format)
    )
      fail("UNSUPPORTED_IMAGE");
    return await pipeline.rotate().png().toBuffer();
  } catch {
    fail("UNSUPPORTED_IMAGE");
  }
}
export async function extractText(bytes, { mock = false } = {}) {
  if (mock) return "Urgent: send your OTP immediately.";
  try {
    const { ImageAnnotatorClient } = await import("@google-cloud/vision");
    const client = new ImageAnnotatorClient();
    const [result] = await client.documentTextDetection(
      { image: { content: bytes } },
      { timeout: 20000, retry: null },
    );
    if (result.error?.code) fail("PROVIDER_UNAVAILABLE");
    const text = result.fullTextAnnotation?.text || "";
    if (!text.trim()) fail("OCR_UNREADABLE");
    return text;
  } catch (e) {
    if (e.details?.code) throw e;
    fail(e.code === 4 ? "OCR_TIMEOUT" : "PROVIDER_UNAVAILABLE");
  }
}
