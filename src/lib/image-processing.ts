import sharp from "sharp";

/**
 * Resizes/crops an image buffer to exactly the requested output dimensions,
 * filling the frame (no letterboxing) by cropping toward the center of
 * whichever axis overflows.
 */
export async function normalizeToOutputSize(imageBuffer: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 95 })
    .toBuffer();
}
