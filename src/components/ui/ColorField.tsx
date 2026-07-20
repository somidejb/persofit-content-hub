"use client";

import { TEXT_COLOR_SWATCHES } from "@/lib/text-overlay-options";

export default function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="label-text mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        {TEXT_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            className={`h-6 w-6 flex-shrink-0 rounded-full border-2 transition ${
              value.toLowerCase() === swatch.toLowerCase() ? "border-neon" : "border-surface-border"
            }`}
            style={{ backgroundColor: swatch }}
            aria-label={swatch}
          />
        ))}
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 flex-shrink-0 cursor-pointer rounded border border-surface-border bg-transparent"
          title="Custom color"
        />
      </div>
    </div>
  );
}
