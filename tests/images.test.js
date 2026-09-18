import { it, expect } from "vitest";
import sharp from "sharp";
import { decodeImage, extractText } from "../functions/src/providers/ocr.js";
it.each([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
])("accepts and sanitizes %s", async (format, mime) => {
  const b = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "white" },
  })
    .toFormat(format)
    .withMetadata({ exif: { IFD0: { Artist: "private" } } })
    .toBuffer();
  const clean = await decodeImage(b.toString("base64"), mime);
  const meta = await sharp(clean).metadata();
  expect(meta.exif).toBeUndefined();
  expect(meta.width).toBe(50);
});
it("rejects mismatched signatures", async () => {
  const b = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await expect(
    decodeImage(b.toString("base64"), "image/jpeg"),
  ).rejects.toMatchObject({ details: { code: "UNSUPPORTED_IMAGE" } });
});
it.each(["not base64!", "PHN2Zz48L3N2Zz4=", "AAAA"])(
  "rejects malformed/unsupported image",
  async (b) => await expect(decodeImage(b, "image/png")).rejects.toBeDefined(),
);
it("rejects decoded oversize", async () =>
  await expect(
    decodeImage(
      Buffer.alloc(4 * 1024 * 1024 + 1).toString("base64"),
      "image/png",
    ),
  ).rejects.toBeDefined());
it("rejects over 20 megapixels", async () => {
  const b = await sharp({
    create: { width: 5000, height: 4001, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await expect(
    decodeImage(b.toString("base64"), "image/png"),
  ).rejects.toBeDefined();
});
it("mock provider is deterministic", async () =>
  expect(await extractText(Buffer.alloc(0), { mock: true })).toBe(
    "Urgent: send your OTP immediately.",
  ));
