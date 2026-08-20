import path from "path";
import { readFile } from "fs/promises";
import OpenAI, { toFile } from "openai";
import { pickOpenAIRequestSize } from "./aspect-ratio-presets";

export class OpenAIImageError extends Error {}

/**
 * OpenAI's moderation pass on image generation appears to have some
 * non-determinism — the exact same prompt + reference image sometimes gets
 * rejected and sometimes doesn't. Rather than failing the slide outright on
 * the first rejection, retry a few times before giving up.
 */
function isSafetySystemRejection(err: unknown): boolean {
  if (!(err instanceof OpenAI.APIError)) return false;
  if (err.status !== 400) return false;
  if (err.code === "content_policy_violation") return true;
  return /safety system/i.test(err.message ?? "");
}

const SAFETY_REJECTION_MAX_ATTEMPTS = 4; // 1 initial try + 3 retries

/**
 * Per-request ceiling. The SDK's default is 10 minutes, which is longer than
 * the generation staleness window in src/lib/generation.ts — a throttled
 * request would sit unserved long enough for the run to be reported "stalled"
 * without any error ever being recorded. Failing at 2 minutes instead means
 * the slide records a real reason. Worst case with retries stays under the
 * staleness window.
 */
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

async function callWithSafetyRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SAFETY_REJECTION_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isSafetySystemRejection(err) || attempt === SAFETY_REJECTION_MAX_ATTEMPTS) throw err;
      console.warn(
        `[openaiImageService] ${label}: safety-system rejection on attempt ${attempt}/${SAFETY_REJECTION_MAX_ATTEMPTS}, retrying…`
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

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
  const client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  const size = pickOpenAIRequestSize(model, outputWidth, outputHeight);

  try {
    if (referenceImagePath) {
      // ── Image-to-image edit ──
      let imageBuffer: Buffer;
      let ext: string;

      if (referenceImagePath.startsWith("http://") || referenceImagePath.startsWith("https://")) {
        // Blob URL — fetch over HTTP
        try {
          const res = await fetch(referenceImagePath);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          imageBuffer = Buffer.from(await res.arrayBuffer());
          ext = path.extname(new URL(referenceImagePath).pathname).toLowerCase() || ".jpg";
        } catch {
          console.warn(`[openaiImageService] Could not fetch blob reference image: ${referenceImagePath} — falling back to text-to-image`);
          imageBuffer = Buffer.alloc(0); // triggers fallback below
          ext = ".jpg";
        }
      } else {
        // Local path
        const absolutePath = path.join(process.cwd(), "public", referenceImagePath.replace(/^\//, ""));
        ext = path.extname(absolutePath).toLowerCase();
        try {
          imageBuffer = await readFile(absolutePath);
        } catch {
          console.warn(`[openaiImageService] Reference image not found on disk: ${referenceImagePath} — falling back to text-to-image`);
          imageBuffer = Buffer.alloc(0); // triggers fallback below
        }
      }

      // If image couldn't be loaded, fall back to text-to-image
      if (imageBuffer.length === 0) {
        const response = await callWithSafetyRetry(
          () =>
            client.images.generate({
              model,
              prompt,
              size,
              quality: quality as "low" | "medium" | "high" | "auto",
              n: 1,
            }),
          "text-to-image (fallback)"
        );
        const fallbackItem = response.data?.[0];
        const fallbackB64 = fallbackItem?.b64_json ?? (fallbackItem as { url?: string } | undefined)?.url;
        if (!fallbackB64) throw new OpenAIImageError("OpenAI fallback response did not contain image data");
        if (fallbackB64.startsWith("http")) {
          const fetched = await fetch(fallbackB64);
          return Buffer.from(await fetched.arrayBuffer());
        }
        return Buffer.from(fallbackB64, "base64");
      }
      const mimeTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      const mimeType = mimeTypeMap[ext] ?? "image/png";

      const imageFile = await toFile(imageBuffer, `reference${ext}`, { type: mimeType });
      const response = await callWithSafetyRetry(
        () =>
          client.images.edit({
            model,
            prompt,
            image: imageFile,
            size,
            quality: quality as "low" | "medium" | "high" | "auto",
            n: 1,
          }),
        "image-to-image edit"
      );

      const item = response.data?.[0];
      if (!item?.b64_json) throw new OpenAIImageError("OpenAI response did not contain image data");
      return Buffer.from(item.b64_json, "base64");
    } else {
      // ── Text-to-image generation ──
      const response = await callWithSafetyRetry(
        () =>
          client.images.generate({
            model,
            prompt,
            size,
            quality: quality as "low" | "medium" | "high" | "auto",
            n: 1,
          }),
        "text-to-image"
      );

      const item = response.data?.[0];
      if (!item?.b64_json) throw new OpenAIImageError("OpenAI response did not contain image data");
      return Buffer.from(item.b64_json, "base64");
    }
  } catch (err) {
    if (err instanceof OpenAIImageError) throw err;
    throw new OpenAIImageError(describeOpenAIFailure(err));
  }
}

/**
 * Turns an OpenAI SDK error into something that explains itself when it lands
 * in Slide.errorMessage and gets shown in the UI. Rate limiting and timeouts
 * are the two failures that look identical from the outside (a run that just
 * sits there), so they're called out explicitly.
 */
function describeOpenAIFailure(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return (
        "OpenAI rate limit reached — too many image requests at once. " +
        "Fewer templates generating simultaneously, or a higher OpenAI tier, will clear this. " +
        "Use Resume to pick up the slides that didn't finish."
      );
    }
    if (err.status === 401) return "OpenAI rejected the API key. Check it in Settings.";
    if (err.status === 400 && err.code === "content_policy_violation") {
      return "OpenAI's safety system rejected this prompt after several attempts. Try rewording the slide prompt.";
    }
    if (err.status && err.status >= 500) {
      return `OpenAI server error (${err.status}). This is transient — Resume to retry.`;
    }
    return `OpenAI error (${err.status ?? "unknown"}): ${err.message}`;
  }

  const message = err instanceof Error ? err.message : "Unknown OpenAI error";
  if (/timed? ?out|ETIMEDOUT|aborted/i.test(message)) {
    return (
      `OpenAI did not respond within ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s, ` +
      "usually because too many image requests are queued at once. Use Resume to retry the unfinished slides."
    );
  }
  return `OpenAI image generation failed: ${message}`;
}
