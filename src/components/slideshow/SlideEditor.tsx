"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, GripVertical, Loader2, ChevronDown, ChevronUp, Sparkles, AlertCircle, CopyPlus, Minus, Plus, Shuffle, Wand2 } from "lucide-react";
import SlidePreview from "./SlidePreview";
import ColorField from "@/components/ui/ColorField";
import Toggle from "@/components/ui/Toggle";
import { TEXT_POSITIONS, TEXT_SIZES, TEXT_ALIGNMENTS, TEXT_STYLES } from "@/lib/text-overlay-options";
import { buildFinalPrompt } from "@/lib/prompt-builder";
import type { OverlaySettings } from "@/lib/types";

export type SlideDraft = OverlaySettings & {
  id: string;
  imageMode: "generate" | "random-pick";
  referenceImagePreviewUrl: string | null;
  referenceImagePath: string | null;
  // random-pick mode
  randomImagePool: string[];           // saved server paths
  randomImagePreviewUrls: string[];    // local blob URLs for display
  customPrompt: string;
  variationDirection: string;
  textOverlayEnabled: boolean;
};

export default function SlideEditor({
  slide,
  index,
  onChange,
  onRemove,
  onExpand,
  canRemove,
  outputWidth,
  outputHeight,
}: {
  slide: SlideDraft;
  index: number;
  onChange: (id: string, patch: Partial<SlideDraft>) => void;
  onRemove: (id: string) => void;
  onExpand: (id: string, count: number) => void;
  canRemove: boolean;
  outputWidth: number;
  outputHeight: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const poolInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandCount, setExpandCount] = useState(3);

  async function handleFile(file: File | null) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange(slide.id, { referenceImagePreviewUrl: previewUrl, referenceImagePath: null });

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { path } = await res.json();
        onChange(slide.id, { referenceImagePath: path });
      }
    } finally {
      setUploading(false);
    }
  }

  async function handlePoolFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const previewUrl = URL.createObjectURL(file);
      const currentPool = slide.randomImagePool ?? [];
      const currentPreviews = slide.randomImagePreviewUrls ?? [];
      const placeholderIdx = currentPool.length;
      onChange(slide.id, {
        randomImagePreviewUrls: [...currentPreviews, previewUrl],
        randomImagePool: [...currentPool, ""],
      });
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { path } = await res.json();
          const updatedPool = [...currentPool, ""];
          updatedPool[placeholderIdx] = path;
          onChange(slide.id, { randomImagePool: updatedPool.filter(Boolean) });
        }
      } catch { /* silent */ }
    }
  }

  function removePoolImage(idx: number) {
    onChange(slide.id, {
      randomImagePool: (slide.randomImagePool ?? []).filter((_, i) => i !== idx),
      randomImagePreviewUrls: (slide.randomImagePreviewUrls ?? []).filter((_, i) => i !== idx),
    });
  }

  async function handleTestGenerate() {
    if (!slide.referenceImagePath) return;
    setTestGenerating(true);
    setTestError(null);
    setTestImageUrl(null);
    try {
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImagePath: slide.referenceImagePath,
          customPrompt: slide.customPrompt,
          variationDirection: slide.variationDirection,
          outputWidth,
          outputHeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || "Generation failed");
      } else {
        setTestImageUrl(data.imagePath);
      }
    } catch {
      setTestError("Network error — check console");
    } finally {
      setTestGenerating(false);
    }
  }

  // Guard against slides created before pool fields existed
  const poolPaths = slide.randomImagePool ?? [];
  const poolPreviews = slide.randomImagePreviewUrls ?? [];

  const finalPrompt = buildFinalPrompt({
    customPrompt: slide.customPrompt,
    variationDirection: slide.variationDirection,
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-zinc-500">
          <GripVertical size={16} className="cursor-grab" />
          <span className="text-xs font-semibold text-zinc-400">Slide #{index + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Expand to N variations inline control */}
          {!expandOpen ? (
            <button
              type="button"
              onClick={() => setExpandOpen(true)}
              title="Create multiple variations of this slide"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-neon"
            >
              <CopyPlus size={13} /> Expand to variations
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-neon/30 bg-surface-200 px-2 py-1">
              <span className="text-[11px] text-zinc-400">Variations:</span>
              <button
                type="button"
                onClick={() => setExpandCount((c) => Math.max(2, c - 1))}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-white"
              >
                <Minus size={11} />
              </button>
              <span className="min-w-[16px] text-center text-xs font-semibold text-white">{expandCount}</span>
              <button
                type="button"
                onClick={() => setExpandCount((c) => Math.min(10, c + 1))}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-white"
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                onClick={() => { onExpand(slide.id, expandCount); setExpandOpen(false); }}
                className="ml-1 rounded bg-neon px-2 py-0.5 text-[11px] font-semibold text-black hover:bg-neon/80"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setExpandOpen(false)}
                className="text-zinc-600 hover:text-zinc-400"
              >
                <X size={11} />
              </button>
            </div>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(slide.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChange(slide.id, { imageMode: "generate" })}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            slide.imageMode === "generate"
              ? "border-neon/40 bg-neon/10 text-neon"
              : "border-surface-border bg-surface-200 text-zinc-400 hover:text-white"
          }`}
        >
          <Wand2 size={13} /> Generate with AI
        </button>
        <button
          type="button"
          onClick={() => onChange(slide.id, { imageMode: "random-pick" })}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            slide.imageMode === "random-pick"
              ? "border-neon/40 bg-neon/10 text-neon"
              : "border-surface-border bg-surface-200 text-zinc-400 hover:text-white"
          }`}
        >
          <Shuffle size={13} /> Random pick
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-3">
          {slide.imageMode === "generate" ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-border bg-surface-200 transition hover:border-neon/50"
              >
                {slide.referenceImagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.referenceImagePreviewUrl} alt="Reference" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-zinc-500 group-hover:text-neon">
                    <ImagePlus size={18} />
                    <span className="text-[10px]">Upload reference image</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size={16} className="animate-spin text-neon" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </button>
              <div>
                <p className="label-text mb-1.5">Live Preview</p>
                <SlidePreview
                  imageUrl={slide.referenceImagePreviewUrl}
                  overlay={slide.textOverlayEnabled ? slide : { ...slide, overlayText: null, overlaySubtext: null }}
                  outputWidth={outputWidth}
                  outputHeight={outputHeight}
                />
              </div>
            </>
          ) : (
            /* Random pick — pool upload */
            <div className="flex flex-col gap-2">
              <p className="label-text">Image Pool</p>
              <p className="text-[10px] text-zinc-500">
                Upload multiple images. At generation time one is picked at random for this slide.
              </p>
              {/* Thumbnails */}
              {poolPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {poolPreviews.map((url, idx) => (
                    <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Pool ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePoolImage(idx)}
                        className="absolute right-1 top-1 hidden rounded-full bg-black/70 p-0.5 text-white group-hover:flex"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => poolInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border bg-surface-200 py-2.5 text-xs text-zinc-500 transition hover:border-neon/50 hover:text-neon"
              >
                <ImagePlus size={14} />
                {poolPreviews.length === 0 ? "Upload images" : "Add more"}
              </button>
              <input
                ref={poolInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handlePoolFiles(e.target.files)}
              />
              {poolPreviews.length > 0 && (
                <p className="text-[10px] text-zinc-600">
                  {poolPreviews.length} image{poolPreviews.length !== 1 ? "s" : ""} in pool —
                  one will be randomly selected at generation time.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Middle column — prompt (only shown for generate mode) */}
        {slide.imageMode === "generate" ? (
        <div className="flex flex-col gap-3">
          <p className="label-text">Image Prompt</p>

          <div className="flex flex-col gap-1.5">
            <label className="label-text block">Prompt</label>
            <textarea
              value={slide.customPrompt}
              onChange={(e) => onChange(slide.id, { customPrompt: e.target.value })}
              placeholder="Describe exactly what you want this image to look like — style, mood, lighting, subject, text inside the image, etc."
              rows={7}
              className="input-field resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="label-text block">
              Variation Direction{" "}
              <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              value={slide.variationDirection}
              onChange={(e) => onChange(slide.id, { variationDirection: e.target.value })}
              placeholder="e.g. evening light, different outfit, zoomed out, high contrast"
              className="input-field"
            />
            <p className="text-[10px] text-zinc-600">
              Tells the AI how this slide should look different from others using the same reference image.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestGenerate}
            disabled={testGenerating || !slide.referenceImagePath || !slide.customPrompt.trim()}
            title={!slide.referenceImagePath ? "Upload a reference image first" : !slide.customPrompt.trim() ? "Write a prompt first" : "Test this prompt with OpenAI"}
            className="btn-primary disabled:opacity-40"
          >
            {testGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Test Generate
              </>
            )}
          </button>

          {testError && (
            <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-400">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{testError}</span>
            </div>
          )}

          {testImageUrl && (
            <div>
              <p className="label-text mb-1.5">Test Result</p>
              <div className="overflow-hidden rounded-lg border border-neon/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testImageUrl} alt="Test generation result" className="w-full object-cover" />
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">This is a preview — adjust your prompt and re-test before saving.</p>
            </div>
          )}

          <div>
            <label className="label-text mb-1.5 block">Final Prompt Preview</label>
            <p className="rounded-lg border border-surface-border bg-surface-200 p-2 text-[11px] leading-relaxed text-zinc-400">
              {finalPrompt}
            </p>
          </div>
        </div>
        ) : (
          /* Random pick middle column — empty placeholder so overlay stays in col 3 */
          <div className="hidden lg:block" />
        )}

        {/* Text Overlay System (opt-in) */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onChange(slide.id, { textOverlayEnabled: !slide.textOverlayEnabled })}
            className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-surface-200 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-neon/40 hover:text-white"
          >
            <span>Text Overlay{slide.textOverlayEnabled ? " (on)" : " (off)"}</span>
            {slide.textOverlayEnabled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {slide.textOverlayEnabled && (
            <>
              <div>
                <label className="label-text mb-1.5 block">Overlay Text</label>
                <input
                  value={slide.overlayText ?? ""}
                  onChange={(e) => onChange(slide.id, { overlayText: e.target.value })}
                  placeholder="Main text shown on the slide"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1.5 block">Subtext (optional)</label>
                <input
                  value={slide.overlaySubtext ?? ""}
                  onChange={(e) => onChange(slide.id, { overlaySubtext: e.target.value })}
                  placeholder="Smaller supporting line"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-text mb-1.5 block">Position</label>
                  <select
                    value={slide.textPosition}
                    onChange={(e) => onChange(slide.id, { textPosition: e.target.value })}
                    className="input-field"
                  >
                    {TEXT_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text mb-1.5 block">Size</label>
                  <select
                    value={slide.textSize}
                    onChange={(e) => onChange(slide.id, { textSize: e.target.value })}
                    className="input-field"
                  >
                    {TEXT_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text mb-1.5 block">Alignment</label>
                  <select
                    value={slide.textAlign}
                    onChange={(e) => onChange(slide.id, { textAlign: e.target.value })}
                    className="input-field"
                  >
                    {TEXT_ALIGNMENTS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text mb-1.5 block">Style</label>
                  <select
                    value={slide.textStyle}
                    onChange={(e) => onChange(slide.id, { textStyle: e.target.value })}
                    className="input-field"
                  >
                    {TEXT_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ColorField
                label="Text Color"
                value={slide.textColor}
                onChange={(v) => onChange(slide.id, { textColor: v })}
              />
              <ColorField
                label="Accent Color"
                value={slide.textAccentColor}
                onChange={(v) => onChange(slide.id, { textAccentColor: v })}
              />

              <Toggle
                label="Text shadow"
                checked={slide.textShadow}
                onChange={(v) => onChange(slide.id, { textShadow: v })}
              />
              <Toggle
                label="Dark translucent box"
                checked={slide.textBoxEnabled}
                onChange={(v) => onChange(slide.id, { textBoxEnabled: v })}
              />
              {slide.textBoxEnabled && (
                <div>
                  <label className="label-text mb-1.5 block">
                    Box Opacity — {Math.round(slide.textBoxOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={slide.textBoxOpacity}
                    onChange={(e) => onChange(slide.id, { textBoxOpacity: parseFloat(e.target.value) })}
                    className="w-full accent-neon"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
