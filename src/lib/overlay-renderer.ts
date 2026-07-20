import sharp from "sharp";
import { POSITION_Y_FACTOR, SIZE_FACTOR, STYLE_FONT_WEIGHT, STYLE_LETTER_SPACING, STYLE_FONT_STRETCH } from "./text-overlay-options";
import type { OverlaySettings } from "./types";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, fontSize: number, maxWidthPx: number): string[] {
  const approxCharWidth = fontSize * 0.56;
  const maxChars = Math.max(4, Math.floor(maxWidthPx / approxCharWidth));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Line = { text: string; fontSize: number; fill: string };

function buildOverlaySvg(width: number, height: number, options: OverlaySettings): string {
  const padding = width * 0.08;
  const maxTextWidth = width - padding * 2;

  const mainSize = SIZE_FACTOR[options.textSize] * width;
  const subSize = mainSize * 0.55;
  const mainLineHeight = mainSize * 1.25;
  const subLineHeight = subSize * 1.3;
  const gapBetween = options.overlayText && options.overlaySubtext ? mainSize * 0.4 : 0;

  const lines: Line[] = [];
  if (options.overlayText?.trim()) {
    for (const l of wrapText(options.overlayText, mainSize, maxTextWidth)) {
      lines.push({ text: l, fontSize: mainSize, fill: options.textColor });
    }
  }
  if (options.overlaySubtext?.trim()) {
    for (const l of wrapText(options.overlaySubtext, subSize, maxTextWidth)) {
      lines.push({ text: l, fontSize: subSize, fill: options.textAccentColor });
    }
  }
  if (lines.length === 0) return "";

  const mainLineCount = options.overlayText?.trim() ? wrapText(options.overlayText, mainSize, maxTextWidth).length : 0;
  const totalHeight =
    mainLineCount * mainLineHeight + gapBetween + (lines.length - mainLineCount) * subLineHeight;

  const anchorY = POSITION_Y_FACTOR[options.textPosition] * height;
  let blockTop = anchorY - totalHeight / 2;
  blockTop = Math.max(height * 0.04, Math.min(blockTop, height * 0.96 - totalHeight));

  const fontWeight = STYLE_FONT_WEIGHT[options.textStyle];
  const letterSpacing = STYLE_LETTER_SPACING[options.textStyle];
  const fontStretch = STYLE_FONT_STRETCH[options.textStyle];

  const textAnchor = options.textAlign === "left" ? "start" : options.textAlign === "right" ? "end" : "middle";
  const x = options.textAlign === "left" ? padding : options.textAlign === "right" ? width - padding : width / 2;

  let cursorY = blockTop;
  const textElements: string[] = [];
  let mainRendered = 0;

  for (const line of lines) {
    const isSub = mainRendered >= mainLineCount;
    const lineHeight = isSub ? subLineHeight : mainLineHeight;
    if (isSub && mainRendered === mainLineCount && gapBetween > 0) cursorY += gapBetween;

    const baselineY = cursorY + lineHeight * 0.8;
    const safeText = escapeXml(line.text);
    const sharedAttrs = `font-size="${line.fontSize}" font-weight="${fontWeight}" font-stretch="${fontStretch}" letter-spacing="${letterSpacing}" text-anchor="${textAnchor}" font-family="Arial, 'Helvetica Neue', sans-serif"`;

    if (options.textShadow) {
      const offset = Math.max(2, line.fontSize * 0.04);
      textElements.push(
        `<text x="${x + offset}" y="${baselineY + offset}" ${sharedAttrs} fill="black" fill-opacity="0.55">${safeText}</text>`
      );
    }
    textElements.push(`<text x="${x}" y="${baselineY}" ${sharedAttrs} fill="${line.fill}">${safeText}</text>`);

    cursorY += lineHeight;
    if (!isSub) mainRendered++;
  }

  let boxRect = "";
  if (options.textBoxEnabled) {
    const boxPadY = mainSize * 0.5;
    const boxTop = blockTop - boxPadY;
    const boxHeight = totalHeight + boxPadY * 2;
    boxRect = `<rect x="${padding * 0.5}" y="${boxTop}" width="${width - padding}" height="${boxHeight}" rx="14" fill="black" fill-opacity="${options.textBoxOpacity}" />`;
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${boxRect}${textElements.join("")}</svg>`;
}

/**
 * Composites overlayText/overlaySubtext onto an image buffer according to
 * the slide's overlay settings. Returns the original buffer unchanged if
 * there's no overlay text configured.
 */
export async function renderTextOverlay(imageBuffer: Buffer, options: OverlaySettings): Promise<Buffer> {
  if (!options.overlayText?.trim() && !options.overlaySubtext?.trim()) {
    return imageBuffer;
  }

  const base = sharp(imageBuffer);
  const metadata = await base.metadata();
  const width = metadata.width ?? 1080;
  const height = metadata.height ?? 1920;

  const svg = buildOverlaySvg(width, height, options);
  if (!svg) return imageBuffer;

  return base
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
