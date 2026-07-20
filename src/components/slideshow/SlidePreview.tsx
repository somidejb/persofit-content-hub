"use client";

import { ImageIcon } from "lucide-react";
import {
  POSITION_Y_FACTOR,
  SIZE_FACTOR,
  STYLE_FONT_WEIGHT,
  STYLE_LETTER_SPACING,
  STYLE_FONT_STRETCH,
} from "@/lib/text-overlay-options";
import type { OverlaySettings } from "@/lib/types";

export default function SlidePreview({
  imageUrl,
  overlay,
  outputWidth = 1080,
  outputHeight = 1920,
}: {
  imageUrl: string | null;
  overlay: OverlaySettings;
  outputWidth?: number;
  outputHeight?: number;
}) {
  const anchorPct = POSITION_Y_FACTOR[overlay.textPosition] * 100;
  const mainSizeCqw = SIZE_FACTOR[overlay.textSize] * 100;
  const subSizeCqw = mainSizeCqw * 0.55;
  const fontWeight = STYLE_FONT_WEIGHT[overlay.textStyle];
  const letterSpacingEm = STYLE_LETTER_SPACING[overlay.textStyle] * 0.02;
  const fontStretch = STYLE_FONT_STRETCH[overlay.textStyle];
  const hasText = !!overlay.overlayText?.trim() || !!overlay.overlaySubtext?.trim();

  const align = overlay.textAlign === "left" ? "flex-start" : overlay.textAlign === "right" ? "flex-end" : "center";

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-surface-300"
      style={{ containerType: "inline-size", aspectRatio: `${outputWidth} / ${outputHeight}` }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Slide preview" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-600">
          <ImageIcon size={22} />
          <span className="text-[11px]">No image yet</span>
        </div>
      )}

      {hasText && (
        <div
          className="absolute flex flex-col gap-1"
          style={{
            top: `${anchorPct}%`,
            left: "8%",
            right: "8%",
            transform: "translateY(-50%)",
            alignItems: align,
            textAlign: overlay.textAlign as React.CSSProperties["textAlign"],
          }}
        >
          {overlay.textBoxEnabled ? (
            <div
              className="flex flex-col gap-1 rounded-lg px-3 py-2"
              style={{
                backgroundColor: `rgba(0,0,0,${overlay.textBoxOpacity})`,
                alignItems: align,
                width: "100%",
              }}
            >
              <OverlayLines
                overlay={overlay}
                mainSizeCqw={mainSizeCqw}
                subSizeCqw={subSizeCqw}
                fontWeight={fontWeight}
                letterSpacingEm={letterSpacingEm}
                fontStretch={fontStretch}
              />
            </div>
          ) : (
            <OverlayLines
              overlay={overlay}
              mainSizeCqw={mainSizeCqw}
              subSizeCqw={subSizeCqw}
              fontWeight={fontWeight}
              letterSpacingEm={letterSpacingEm}
              fontStretch={fontStretch}
            />
          )}
        </div>
      )}
    </div>
  );
}

function OverlayLines({
  overlay,
  mainSizeCqw,
  subSizeCqw,
  fontWeight,
  letterSpacingEm,
  fontStretch,
}: {
  overlay: OverlaySettings;
  mainSizeCqw: number;
  subSizeCqw: number;
  fontWeight: number;
  letterSpacingEm: number;
  fontStretch: string;
}) {
  return (
    <>
      {overlay.overlayText?.trim() && (
        <span
          className="whitespace-pre-wrap break-words"
          style={{
            fontSize: `${mainSizeCqw}cqw`,
            fontWeight,
            letterSpacing: `${letterSpacingEm}em`,
            fontStretch,
            color: overlay.textColor,
            textShadow: overlay.textShadow ? "0.06em 0.06em 0.12em rgba(0,0,0,0.55)" : "none",
            lineHeight: 1.2,
          }}
        >
          {overlay.overlayText}
        </span>
      )}
      {overlay.overlaySubtext?.trim() && (
        <span
          className="whitespace-pre-wrap break-words"
          style={{
            fontSize: `${subSizeCqw}cqw`,
            fontWeight,
            letterSpacing: `${letterSpacingEm}em`,
            fontStretch,
            color: overlay.textAccentColor,
            textShadow: overlay.textShadow ? "0.06em 0.06em 0.12em rgba(0,0,0,0.55)" : "none",
            lineHeight: 1.25,
          }}
        >
          {overlay.overlaySubtext}
        </span>
      )}
    </>
  );
}
