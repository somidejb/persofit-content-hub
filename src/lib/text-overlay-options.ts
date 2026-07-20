export const TEXT_POSITIONS = [
  { value: "top", label: "Top" },
  { value: "upper_center", label: "Upper Center" },
  { value: "center", label: "Center" },
  { value: "lower_center", label: "Lower Center" },
  { value: "bottom", label: "Bottom" },
] as const;

export const TEXT_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "extra_large", label: "Extra Large" },
] as const;

export const TEXT_ALIGNMENTS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

export const TEXT_STYLES = [
  { value: "bold", label: "Bold" },
  { value: "extra_bold", label: "Extra Bold" },
  { value: "condensed", label: "Condensed" },
  { value: "clean", label: "Clean" },
] as const;

export const TEXT_COLOR_SWATCHES = ["white", "black", "#00FF87", "#FFD400", "#FF3B30", "#3B82F6"];

// Vertical anchor as a fraction of image/preview height — the text block
// is centered on this line, then laid out top-down from there.
export const POSITION_Y_FACTOR: Record<string, number> = {
  top: 0.14,
  upper_center: 0.32,
  center: 0.5,
  lower_center: 0.68,
  bottom: 0.86,
};

// Font size as a fraction of image/preview width, used consistently by
// both the live CSS preview and the server-side SVG renderer.
export const SIZE_FACTOR: Record<string, number> = {
  small: 0.045,
  medium: 0.06,
  large: 0.075,
  extra_large: 0.095,
};

export const STYLE_FONT_WEIGHT: Record<string, number> = {
  bold: 700,
  extra_bold: 900,
  condensed: 700,
  clean: 500,
};

export const STYLE_LETTER_SPACING: Record<string, number> = {
  bold: 0,
  extra_bold: 0.5,
  condensed: -0.5,
  clean: 0.2,
};

export const STYLE_FONT_STRETCH: Record<string, "normal" | "condensed"> = {
  bold: "normal",
  extra_bold: "normal",
  condensed: "condensed",
  clean: "normal",
};
