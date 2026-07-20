// Appended to every prompt to prevent generation artifacts.
// Text is intentionally NOT blocked here — include text instructions in your
// per-slide prompt if you want the AI to render text inside the image.
export const NEGATIVE_PROMPT_SUFFIX =
  "Do not include logos, watermarks, fake UI, distorted anatomy, extra fingers, or unreadable writing.";

export function buildFinalPrompt({
  customPrompt,
  variationDirection,
  siblingIndex,
  siblingTotal,
}: {
  customPrompt?: string | null;
  variationDirection?: string | null;
  /** 1-based position of this slide among slides sharing the same reference image. */
  siblingIndex?: number;
  siblingTotal?: number;
}): string {
  const hasVariationDirection = !!variationDirection?.trim();
  const isOneOfMany = siblingTotal && siblingTotal > 1 && siblingIndex && siblingIndex > 1;

  const uniquenessHint = hasVariationDirection
    ? `Variation direction: ${variationDirection!.trim()}. Ensure this image looks visually distinct from other slides using the same reference image — different composition, lighting, or mood as directed.`
    : isOneOfMany
    ? `This is variation ${siblingIndex} of ${siblingTotal} from the same reference image. Make it look noticeably different from the other variations — change the composition, lighting, color temperature, or framing.`
    : null;

  const segments = [
    customPrompt?.trim(),
    uniquenessHint,
    NEGATIVE_PROMPT_SUFFIX,
  ].filter((s): s is string => !!s && s.length > 0);

  return segments.join(" ");
}
