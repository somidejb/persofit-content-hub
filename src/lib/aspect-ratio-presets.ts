export type AspectRatioPreset = {
  value: string;
  label: string;
  width: number;
  height: number;
};

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { value: "9:16", label: "9:16 Vertical (TikTok default)", width: 1080, height: 1920 },
  { value: "1:1", label: "1:1 Square", width: 1080, height: 1080 },
  { value: "4:5", label: "4:5 Portrait", width: 1080, height: 1350 },
  { value: "16:9", label: "16:9 Horizontal", width: 1920, height: 1080 },
  { value: "custom", label: "Custom size", width: 1080, height: 1920 },
];

export const DEFAULT_ASPECT_RATIO = "9:16";

export function findAspectRatioPreset(value: string): AspectRatioPreset | undefined {
  return ASPECT_RATIO_PRESETS.find((p) => p.value === value);
}

/**
 * gpt-image-2 supports arbitrary WIDTHxHEIGHT sizes (multiples of 16,
 * aspect ratio between 1:3 and 3:1, capped at 3840x2160), so we can request
 * something very close to the real output dimensions directly — post-
 * processing then only needs to make minor adjustments. Older models
 * (gpt-image-1, dall-e-2, etc.) only support a handful of fixed sizes, so
 * we fall back to whichever fixed size is closest to the target ratio.
 */
export function pickOpenAIRequestSize(model: string, width: number, height: number): string {
  if (!model.startsWith("gpt-image-2")) {
    const ratio = width / height;
    if (ratio > 1.15) return "1536x1024";
    if (ratio < 0.87) return "1024x1536";
    return "1024x1024";
  }

  const roundTo16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  let w = roundTo16(Math.min(width, 3840));
  let h = roundTo16(Math.min(height, 2160));

  const minRatio = 1 / 3;
  const maxRatio = 3;
  const ratio = w / h;
  if (ratio > maxRatio) w = roundTo16(h * maxRatio);
  if (ratio < minRatio) h = roundTo16(w / minRatio);

  return `${w}x${h}`;
}
