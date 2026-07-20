"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  Sparkles,
  Bot,
  Image,
  Shuffle,
  Link,
} from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import ColorField from "@/components/ui/ColorField";
import { TEXT_POSITIONS, TEXT_SIZES, TEXT_ALIGNMENTS, TEXT_STYLES } from "@/lib/text-overlay-options";
import type { OverlaySettings } from "@/lib/types";

export type TemplateSlideDraft = OverlaySettings & {
  id: string;
  imageMode: "ai-auto" | "generate" | "random-pick";
  referenceImagePath: string | null;
  referenceImagePreviewUrl: string | null;
  randomImagePool: string[];
  randomImagePreviewUrls: string[];
  customPrompt: string;
  variationDirection: string;
  textOverlayEnabled: boolean;
};

const MODE_OPTIONS: { value: TemplateSlideDraft["imageMode"]; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "ai-auto",
    label: "AI Auto",
    icon: <Bot size={14} />,
    description: "GPT-4o plans this slide fresh every run — content changes daily",
  },
  {
    value: "generate",
    label: "Generate with AI",
    icon: <Sparkles size={14} />,
    description: "Your fixed prompt, generates a new image each run",
  },
  {
    value: "random-pick",
    label: "Random Pick",
    icon: <Shuffle size={14} />,
    description: "Upload a pool — randomly picks one image each run",
  },
];

export function emptyTemplateSlideDraft(_order?: number): TemplateSlideDraft {
  return {
    id: crypto.randomUUID(),
    imageMode: "ai-auto",
    referenceImagePath: null,
    referenceImagePreviewUrl: null,
    randomImagePool: [],
    randomImagePreviewUrls: [],
    customPrompt: "",
    variationDirection: "",
    textOverlayEnabled: false,
    overlayText: "",
    overlaySubtext: "",
    textPosition: "center",
    textSize: "large",
    textAlign: "center",
    textColor: "white",
    textAccentColor: "#00FF87",
    textStyle: "bold",
    textShadow: true,
    textBoxEnabled: false,
    textBoxOpacity: 0.45,
    // OverlaySettings required fields satisfied above
  } as TemplateSlideDraft;
}

/** Returns true if this referenceImagePath is a slide-chaining reference */
export function isSlideChainRef(path: string | null): boolean {
  return !!path?.startsWith("@slide:");
}
/** Extracts the 1-based order from a slide-chain ref like "@slide:2" → 2 */
export function parseSlideChainOrder(path: string): number {
  return parseInt(path.replace("@slide:", ""), 10);
}

export default function TemplateSlideEditor({
  slide,
  index,
  onChange,
  onRemove,
  canRemove,
  outputWidth,
  outputHeight,
  templateReferenceImagePath,
  siblingSlides = [],
}: {
  slide: TemplateSlideDraft;
  index: number;
  onChange: (id: string, patch: Partial<TemplateSlideDraft>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  outputWidth: number;
  outputHeight: number;
  templateReferenceImagePath: string | null;
  /** Other slides in the template so this slide can chain from their output */
  siblingSlides?: TemplateSlideDraft[];
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const poolRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [chainPreviewStatus, setChainPreviewStatus] = useState<string | null>(null);

  const isChained = isSlideChainRef(slide.referenceImagePath);
  const chainedOrder = isChained ? parseSlideChainOrder(slide.referenceImagePath!) : null;
  // For non-chained slides, derive the effective reference image normally
  const effectiveRefImage = isChained ? null : (slide.referenceImagePath ?? templateReferenceImagePath);

  async function handleRefUpload(file: File) {
    onChange(slide.id, { referenceImagePreviewUrl: URL.createObjectURL(file), referenceImagePath: null });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { path } = await res.json();
        onChange(slide.id, { referenceImagePath: path });
      }
    } finally {
      setUploading(false);
    }
  }

  async function handlePoolFiles(files: FileList) {
    // Track pool/previews locally to avoid stale closure reads across async iterations
    let currentPool = [...(slide.randomImagePool ?? [])];
    let currentPreviews = [...(slide.randomImagePreviewUrls ?? [])];

    for (const file of Array.from(files)) {
      const previewUrl = URL.createObjectURL(file);
      currentPool = [...currentPool, ""];
      currentPreviews = [...currentPreviews, previewUrl];
      onChange(slide.id, { randomImagePool: currentPool, randomImagePreviewUrls: currentPreviews });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "reference");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { path } = await res.json();
        const idx = currentPool.lastIndexOf("");
        currentPool = [...currentPool];
        currentPool[idx] = path;
        onChange(slide.id, { randomImagePool: currentPool });
      }
    }
  }

  function removePoolImage(idx: number) {
    const pool = [...(slide.randomImagePool ?? [])];
    const previews = [...(slide.randomImagePreviewUrls ?? [])];
    pool.splice(idx, 1);
    previews.splice(idx, 1);
    onChange(slide.id, { randomImagePool: pool, randomImagePreviewUrls: previews });
  }

  /** Recursively resolves a slide's reference image, generating previews up the chain */
  async function resolveRefImageForPreview(
    s: TemplateSlideDraft,
    w: number,
    h: number,
    depth = 0
  ): Promise<string | null> {
    if (depth > 10) throw new Error("Circular or excessively deep slide chain detected");

    if (isSlideChainRef(s.referenceImagePath)) {
      const refOrder = parseSlideChainOrder(s.referenceImagePath!);
      const refSlide = siblingSlides?.find((_, i) => i + 1 === refOrder);
      if (!refSlide) throw new Error(`Slide ${refOrder} not found`);

      setChainPreviewStatus(`Generating Slide ${refOrder} preview…`);
      // Recursively resolve the ref slide's own reference
      const refRefImage = await resolveRefImageForPreview(refSlide, w, h, depth + 1);

      const refPrompt = buildClientPrompt(refSlide.customPrompt, refSlide.variationDirection);
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImagePath: refRefImage, customPrompt: refPrompt, outputWidth: w, outputHeight: h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upstream slide generation failed");
      return data.imagePath as string;
    }

    // Not a chain ref — return the uploaded/template reference image directly
    return s.referenceImagePath ?? templateReferenceImagePath ?? null;
  }

  function buildClientPrompt(prompt: string | null | undefined, variation: string | null | undefined) {
    return [prompt?.trim(), variation?.trim() ? `Variation: ${variation.trim()}` : null]
      .filter(Boolean)
      .join(" ");
  }

  async function generateChainPreview() {
    if (!slide.customPrompt?.trim()) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setChainPreviewStatus("Resolving slide chain…");
    try {
      const resolvedRef = await resolveRefImageForPreview(slide, outputWidth, outputHeight);
      setChainPreviewStatus(`Generating Slide ${index + 1} preview…`);
      const prompt = buildClientPrompt(slide.customPrompt, slide.variationDirection);
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImagePath: resolvedRef, customPrompt: prompt, outputWidth, outputHeight }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPreviewUrl(data.imagePath);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Chain preview failed");
    } finally {
      setPreviewLoading(false);
      setChainPreviewStatus(null);
    }
  }

  async function generatePreview() {
    if (!slide.customPrompt?.trim() || isChained) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImagePath: effectiveRefImage ?? null,
          customPrompt: slide.customPrompt,
          variationDirection: slide.variationDirection,
          outputWidth,
          outputHeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPreviewUrl(data.imagePath);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  const modeOption = MODE_OPTIONS.find((m) => m.value === slide.imageMode)!;

  return (
    <div className="rounded-lg border border-surface-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical size={14} className="text-zinc-600 shrink-0" />
        <span className="text-[11px] font-semibold text-zinc-600 w-5 shrink-0">#{index + 1}</span>

        {/* Mode pill */}
        <span className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-200 px-2 py-0.5 text-[10px] text-zinc-400">
          {modeOption.icon}
          {modeOption.label}
        </span>

        {slide.imageMode === "generate" && slide.customPrompt && (
          <span className="flex-1 truncate text-[11px] text-zinc-500">{slide.customPrompt}</span>
        )}
        {slide.imageMode === "ai-auto" && (
          <span className="flex-1 text-[11px] text-zinc-600 italic">GPT-4o plans this each run</span>
        )}
        {slide.imageMode === "random-pick" && (
          <span className="flex-1 text-[11px] text-zinc-500">{(slide.randomImagePool ?? []).length} images in pool</span>
        )}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          {canRemove && (
            <button
              onClick={() => onRemove(slide.id)}
              className="rounded p-1 text-zinc-600 hover:text-red-400 transition"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-zinc-500 hover:text-white transition"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-border px-4 py-4 space-y-4">
          {/* Mode selector */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Slide Type</label>
            <div className="flex gap-2 flex-wrap">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => onChange(slide.id, { imageMode: m.value })}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    slide.imageMode === m.value
                      ? "border-neon/50 bg-neon/10 text-neon"
                      : "border-surface-border text-zinc-400 hover:text-white"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-600">{modeOption.description}</p>
          </div>

          {/* AI Auto: no additional inputs needed */}
          {slide.imageMode === "ai-auto" && (
            <div className="rounded-lg border border-surface-border bg-surface-200 px-3 py-3 text-xs text-zinc-500 flex items-start gap-2">
              <Bot size={14} className="shrink-0 mt-0.5 text-zinc-600" />
              <span>
                GPT-4o will use your template concept + variables to generate a unique prompt for this
                slide on each run. No setup needed.
              </span>
            </div>
          )}

          {/* Generate with AI */}
          {slide.imageMode === "generate" && (
            <div className="space-y-3">
              {/* Reference image */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Reference Image{" "}
                  {templateReferenceImagePath && !slide.referenceImagePath && (
                    <span className="text-zinc-600">(using template reference)</span>
                  )}
                  {!slide.referenceImagePath && !templateReferenceImagePath && (
                    <span className="text-zinc-600">(optional — omit to use text-to-image)</span>
                  )}
                </label>

                {/* Chained reference badge */}
                {isChained && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                    <Link size={12} className="text-blue-400 shrink-0" />
                    <span className="text-xs text-blue-300">
                      Using output of <strong>Slide {chainedOrder}</strong> as reference
                    </span>
                    <button
                      onClick={() => onChange(slide.id, { referenceImagePath: null, referenceImagePreviewUrl: null })}
                      className="ml-auto text-zinc-500 hover:text-white"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {!isChained && (
                  <div className="flex items-start gap-2 flex-wrap">
                    {(slide.referenceImagePreviewUrl ?? effectiveRefImage) ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide.referenceImagePreviewUrl ?? effectiveRefImage!}
                          alt="Ref"
                          className="h-16 w-auto rounded border border-surface-border object-cover"
                        />
                        {slide.referenceImagePath && (
                          <button
                            onClick={() => onChange(slide.id, { referenceImagePath: null, referenceImagePreviewUrl: null })}
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-800 p-0.5 text-zinc-400 hover:text-white"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ) : null}
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-white transition"
                    >
                      <ImagePlus size={13} />
                      {uploading ? "Uploading…" : slide.referenceImagePath ? "Change" : "Upload reference"}
                    </button>
                    {/* Chain from another slide */}
                    {siblingSlides.filter((_, j) => j !== index).length > 0 && (
                      <div className="relative group">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500 hover:border-blue-500/50 hover:text-blue-400 transition"
                        >
                          <Link size={13} />
                          Use slide output
                        </button>
                        {/* Dropdown */}
                        <div className="absolute left-0 top-full z-20 mt-1 hidden group-focus-within:block group-hover:block min-w-[140px] rounded-lg border border-surface-border bg-surface-200 py-1 shadow-xl">
                          {siblingSlides
                            .map((s, j) => ({ s, j }))
                            .filter(({ j }) => j !== index)
                            .map(({ s, j }) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() =>
                                  onChange(slide.id, {
                                    referenceImagePath: `@slide:${j + 1}`,
                                    referenceImagePreviewUrl: null,
                                  })
                                }
                                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-surface-300 hover:text-white transition"
                              >
                                Slide {j + 1} output
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleRefUpload(e.target.files[0])}
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Image Prompt</label>
                <textarea
                  value={slide.customPrompt}
                  onChange={(e) => onChange(slide.id, { customPrompt: e.target.value })}
                  rows={4}
                  placeholder="Describe the image to generate for this slide. This same prompt runs every time — the AI generates a new image each run."
                  className="input-field w-full resize-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Variation Direction <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  value={slide.variationDirection}
                  onChange={(e) => onChange(slide.id, { variationDirection: e.target.value })}
                  placeholder="e.g. warm lighting, wide angle shot, high contrast colors"
                  className="input-field w-full text-xs"
                />
              </div>

              {/* Live preview */}
              <div>
                {previewUrl && (
                  <div className="mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full max-w-[180px] rounded-lg border border-surface-border"
                    />
                  </div>
                )}
                {previewError && <p className="mb-2 text-xs text-red-400">{previewError}</p>}
                {slide.customPrompt?.trim() && !isChained && (
                  <button
                    onClick={generatePreview}
                    disabled={previewLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition disabled:opacity-50"
                  >
                    {previewLoading ? (
                      <><Loader2 size={12} className="animate-spin" /> Generating…</>
                    ) : previewUrl ? (
                      <><Image size={12} /> Regenerate preview</>
                    ) : (
                      <><Image size={12} /> Generate live preview</>
                    )}
                  </button>
                )}
                {isChained && slide.customPrompt?.trim() && (
                  <div className="space-y-2">
                    {previewUrl && (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Chain preview"
                          className="w-full max-w-[180px] rounded-lg border border-surface-border"
                        />
                      </div>
                    )}
                    {previewError && <p className="text-xs text-red-400">{previewError}</p>}
                    <button
                      onClick={generateChainPreview}
                      disabled={previewLoading}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 transition disabled:opacity-50"
                    >
                      {previewLoading ? (
                        <><Loader2 size={12} className="animate-spin" /> {chainPreviewStatus ?? "Generating…"}</>
                      ) : previewUrl ? (
                        <><Link size={12} /> Regenerate chain preview</>
                      ) : (
                        <><Link size={12} /> Generate chain preview (generates Slide {chainedOrder} first)</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Random Pick */}
          {slide.imageMode === "random-pick" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Image Pool</label>
                <p className="text-[11px] text-zinc-600 mb-2">
                  Upload multiple images — one is picked at random each run.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(slide.randomImagePreviewUrls ?? []).map((url, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Pool ${i + 1}`}
                        className="h-16 w-16 rounded border border-surface-border object-cover"
                      />
                      <button
                        onClick={() => removePoolImage(i)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-800 p-0.5 text-zinc-400 hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => poolRef.current?.click()}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded border border-dashed border-surface-border text-zinc-600 hover:border-zinc-500 hover:text-white transition"
                  >
                    <ImagePlus size={16} />
                    <span className="mt-0.5 text-[9px]">Add</span>
                  </button>
                </div>
                <input
                  ref={poolRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handlePoolFiles(e.target.files)}
                />
              </div>
            </div>
          )}

          {/* Text Overlay (for generate + random-pick) */}
          {slide.imageMode !== "ai-auto" && (
            <div className="border-t border-surface-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Text Overlay</label>
                <Toggle
                  checked={slide.textOverlayEnabled}
                  onChange={(v) => onChange(slide.id, { textOverlayEnabled: v })}
                  label=""
                />
              </div>

              {slide.textOverlayEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Headline</label>
                      <input
                        value={slide.overlayText ?? ""}
                        onChange={(e) => onChange(slide.id, { overlayText: e.target.value })}
                        className="input-field w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Subtext</label>
                      <input
                        value={slide.overlaySubtext ?? ""}
                        onChange={(e) => onChange(slide.id, { overlaySubtext: e.target.value })}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Position</label>
                      <select value={slide.textPosition} onChange={(e) => onChange(slide.id, { textPosition: e.target.value })} className="input-field w-full text-xs">
                        {TEXT_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Size</label>
                      <select value={slide.textSize} onChange={(e) => onChange(slide.id, { textSize: e.target.value })} className="input-field w-full text-xs">
                        {TEXT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Alignment</label>
                      <select value={slide.textAlign} onChange={(e) => onChange(slide.id, { textAlign: e.target.value })} className="input-field w-full text-xs">
                        {TEXT_ALIGNMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Style</label>
                      <select value={slide.textStyle} onChange={(e) => onChange(slide.id, { textStyle: e.target.value })} className="input-field w-full text-xs">
                        {TEXT_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Text Color" value={slide.textColor} onChange={(v) => onChange(slide.id, { textColor: v })} />
                    <ColorField label="Accent Color" value={slide.textAccentColor} onChange={(v) => onChange(slide.id, { textAccentColor: v })} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
