import path from "path";
import { readFile } from "fs/promises";
import OpenAI, { toFile } from "openai";
import { pickOpenAIRequestSize } from "./aspect-ratio-presets";

export class OpenAIImageError extends Error {}

/**
 * Generates a slide image via OpenAI.
 * - If referenceImagePath is provided: uses images/edits (image-to-image)
 * - If referenceImagePath is null/undefined: uses images/generate (text-to-image)
 * Text overlays are always applied afterward by src/lib/overlay-renderer.ts.
 */
export async function generateSlideImage({
  apiKey,
  model,
  quality,
  referenceImagePath,
  prompt,
  outputWidth,
  outputHeight,
}: {
  apiKey: string;
  model: string;
  quality: string;
  referenceImagePath: string | null | undefined;
  prompt: string;
  outputWidth: number;
  outputHeight: number;
}): Promise<Buffer> {
  const client = new OpenAI({ apiKey });
  const size = pickOpenAIRequestSize(model, outputWidth, outputHeight);

  try {
    if (referenceImagePath) {
      // ── Image-to-image edit ──
      const absolutePath = path.join(process.cwd(), "public", referenceImagePath.replace(/^\//, ""));
      let imageBuffer: Buffer;
      try {
        imageBuffer = await readFile(absolutePath);
      } catch {
        throw new OpenAIImageError(`Reference image not found on disk: ${referenceImagePath}`);
      }

      const ext = path.extname(absolutePath).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      const mimeType = mimeTypeMap[ext] ?? "image/png";

      const response = await client.images.edit({
        model,
        prompt,
        image: await toFile(imageBuffer, path.basename(absolutePath), { type: mimeType }),
        size,
        quality: quality as "low" | "medium" | "high" | "auto",
        n: 1,
      });

      const item = response.data?.[0];
      if (!item?.b64_json) throw new OpenAIImageError("OpenAI response did not contain image data");
      return Buffer.from(item.b64_json, "base64");
    } else {
      // ── Text-to-image generation ──
      const response = await client.images.generate({
        model,
        prompt,
        size,
        quality: quality as "low" | "medium" | "high" | "auto",
        n: 1,
      });

      const item = response.data?.[0];
      if (!item?.b64_json) throw new OpenAIImageError("OpenAI response did not contain image data");
      return Buffer.from(item.b64_json, "base64");
    }
  } catch (err) {
    if (err instanceof OpenAIImageError) throw err;
    const message = err instanceof Error ? err.message : "Unknown OpenAI error";
    throw new OpenAIImageError(`OpenAI image generation failed: ${message}`);
  }
}
