"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
} from "lucide-react";

type PlannedSlide = {
  label: string;
  customPrompt: string;
  variationDirection: string;
  previewImagePath?: string;
  previewLoading?: boolean;
  previewError?: string;
};

interface TemplateRunPreviewProps {
  concept: string;
  variables: string | null | undefined;
  slideCount: number;
  referenceImagePath: string | null | undefined;
  outputWidth: number;
  outputHeight: number;
}

export default function TemplateRunPreview({
  concept,
  variables,
  slideCount,
  referenceImagePath,
  outputWidth,
  outputHeight,
}: TemplateRunPreviewProps) {
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [slides, setSlides] = useState<PlannedSlide[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const canPreview = !!concept?.trim();

  async function handlePlan() {
    if (!canPreview) return;
    setPlanning(true);
    setPlanError(null);
    setSlides([]);
    try {
      const res = await fetch("/api/plan-slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          variables: variables?.trim() || null,
          slideCount,
          referenceImagePath: referenceImagePath || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Planning failed");
      setSlides(
        (data.slides as { label: string; customPrompt: string; variationDirection: string }[]).map(
          (s) => ({ ...s, previewImagePath: undefined, previewLoading: false, previewError: undefined })
        )
      );
      setExpandedIdx(0);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function generatePreview(idx: number) {
    if (!referenceImagePath) return;
    setSlides((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, previewLoading: true, previewError: undefined } : s
      )
    );
    try {
      const slide = slides[idx];
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImagePath,
          customPrompt: slide.customPrompt,
          variationDirection: slide.variationDirection,
          outputWidth,
          outputHeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setSlides((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, previewLoading: false, previewImagePath: data.imagePath } : s
        )
      );
    } catch (err) {
      setSlides((prev) =>
        prev.map((s, i) =>
          i === idx
            ? {
                ...s,
                previewLoading: false,
                previewError: err instanceof Error ? err.message : "Failed",
              }
            : s
        )
      );
    }
  }

  async function generateAll() {
    if (!referenceImagePath || slides.length === 0) return;
    setGeneratingAll(true);
    for (let i = 0; i < slides.length; i++) {
      await generatePreview(i);
    }
    setGeneratingAll(false);
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface-200 transition"
      >
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-300">Preview a Run</span>
          <span className="text-xs text-zinc-600">See what GPT-4o would generate</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-zinc-500" />
        ) : (
          <ChevronDown size={16} className="text-zinc-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-surface-border px-5 pb-5 pt-4 space-y-4">
          {!canPreview && (
            <p className="text-xs text-zinc-500">
              Fill in a concept prompt above first, then come back here to preview.
            </p>
          )}

          {canPreview && slides.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                This will run GPT-4o on your concept to plan {slideCount} slides — same as what
                happens on each scheduled run. Each preview is a fresh generation.
              </p>
              <button
                type="button"
                onClick={handlePlan}
                disabled={planning}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {planning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Planning slides…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Plan {slideCount} slides
                  </>
                )}
              </button>
              {planError && (
                <p className="text-xs text-red-400">{planError}</p>
              )}
            </div>
          )}

          {slides.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  {slides.length} slides planned
                </p>
                <div className="flex items-center gap-2">
                  {referenceImagePath && (
                    <button
                      type="button"
                      onClick={generateAll}
                      disabled={generatingAll}
                      className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition disabled:opacity-50"
                    >
                      {generatingAll ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ImagePlus size={12} />
                      )}
                      Generate all images
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePlan}
                    disabled={planning}
                    className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition disabled:opacity-50"
                  >
                    {planning ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Re-plan
                  </button>
                </div>
              </div>

              {!referenceImagePath && (
                <p className="text-xs text-amber-400/80 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  Add a reference image above to generate image previews.
                </p>
              )}

              <div className="space-y-2">
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-surface-border bg-surface-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-200 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-semibold text-zinc-600 shrink-0">
                          #{i + 1}
                        </span>
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {slide.label}
                        </span>
                        {slide.previewImagePath && (
                          <span className="shrink-0 rounded-full bg-neon/10 px-1.5 py-0.5 text-[10px] text-neon">
                            Generated
                          </span>
                        )}
                        {slide.previewLoading && (
                          <Loader2 size={11} className="shrink-0 animate-spin text-zinc-500" />
                        )}
                      </div>
                      {expandedIdx === i ? (
                        <ChevronUp size={13} className="text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronDown size={13} className="text-zinc-500 shrink-0" />
                      )}
                    </button>

                    {expandedIdx === i && (
                      <div className="border-t border-surface-border px-3 py-3 space-y-3">
                        {/* Prompt details */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-400">Image Prompt</p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-4">
                            {slide.customPrompt}
                          </p>
                        </div>
                        {slide.variationDirection && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-zinc-400">
                              Variation Direction
                            </p>
                            <p className="text-[11px] text-zinc-500">{slide.variationDirection}</p>
                          </div>
                        )}

                        {/* Preview image */}
                        {slide.previewImagePath ? (
                          <div className="space-y-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={slide.previewImagePath}
                              alt={`Preview of slide ${i + 1}`}
                              className="w-full max-w-[220px] rounded-lg border border-surface-border object-contain"
                            />
                            {referenceImagePath && (
                              <button
                                type="button"
                                onClick={() => generatePreview(i)}
                                disabled={slide.previewLoading}
                                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition"
                              >
                                <RefreshCw size={11} />
                                Regenerate
                              </button>
                            )}
                          </div>
                        ) : slide.previewError ? (
                          <div className="space-y-2">
                            <p className="text-xs text-red-400">{slide.previewError}</p>
                            {referenceImagePath && (
                              <button
                                type="button"
                                onClick={() => generatePreview(i)}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
                              >
                                <RefreshCw size={11} />
                                Retry
                              </button>
                            )}
                          </div>
                        ) : referenceImagePath ? (
                          <button
                            type="button"
                            onClick={() => generatePreview(i)}
                            disabled={slide.previewLoading || generatingAll}
                            className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition disabled:opacity-50"
                          >
                            {slide.previewLoading ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Generating…
                              </>
                            ) : (
                              <>
                                <ImagePlus size={12} />
                                Generate preview image
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
