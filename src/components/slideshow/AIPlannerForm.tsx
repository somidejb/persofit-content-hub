"use client";

import { useRef, useState } from "react";
import { Loader2, ImagePlus, Sparkles, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { SlideDraft } from "./SlideEditor";
import type { PlannedSlide } from "@/app/api/plan-slideshow/route";

function emptySlideDefaults() {
  return {
    imageMode: "generate" as const,
    randomImagePool: [] as string[],
    randomImagePreviewUrls: [] as string[],
    textOverlayEnabled: false as const,
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
  };
}

export default function AIPlannerForm({
  onPlanReady,
}: {
  onPlanReady: (slides: SlideDraft[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [concept, setConcept] = useState("");
  const [variables, setVariables] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [referenceImagePath, setReferenceImagePath] = useState<string | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plannedSlides, setPlannedSlides] = useState<PlannedSlide[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setReferencePreviewUrl(URL.createObjectURL(file));
    setReferenceImagePath(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { path } = await res.json();
        setReferenceImagePath(path);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handlePlan() {
    if (!concept.trim()) return;
    setPlanning(true);
    setError(null);
    setPlannedSlides([]);
    try {
      const res = await fetch("/api/plan-slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          variables: variables.trim() || null,
          slideCount,
          referenceImagePath,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Planning failed");
      } else {
        setPlannedSlides(data.slides);
        setExpandedIdx(0);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setPlanning(false);
    }
  }

  function handleUseThisPlan() {
    const drafts: SlideDraft[] = plannedSlides.map((s) => ({
      id: crypto.randomUUID(),
      referenceImagePreviewUrl: referencePreviewUrl,
      referenceImagePath: referenceImagePath,
      customPrompt: s.customPrompt,
      variationDirection: s.variationDirection,
      ...emptySlideDefaults(),
    }));
    onPlanReady(drafts);
  }

  function updatePlanned(idx: number, field: keyof PlannedSlide, value: string) {
    setPlannedSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Reference image */}
      <div>
        <label className="label-text mb-1.5 block">Reference Image (optional)</label>
        <p className="mb-2 text-[11px] text-zinc-500">
          Upload the visual format you want replicated across all slides.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-24 w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-border bg-surface-200 transition hover:border-neon/50"
        >
          {referencePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={referencePreviewUrl} alt="Reference" className="h-full w-full object-cover" />
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
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Concept */}
      <div>
        <label className="label-text mb-1.5 block">Content Concept</label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder={`Describe what this slideshow is about and the visual format.\n\ne.g. "Macro breakdown card for high-protein foods. Each card shows a food photo, the food name, and its calories, protein, carbs and fat per 100g. Clean, bold layout on a dark background."`}
          rows={5}
          className="input-field resize-none"
        />
      </div>

      {/* Variables */}
      <div>
        <label className="label-text mb-1.5 block">
          Variables <span className="text-zinc-600">(what changes per slide)</span>
        </label>
        <input
          value={variables}
          onChange={(e) => setVariables(e.target.value)}
          placeholder="e.g. food name, calories, protein, carbs, fat — or: country name, landmark, travel tip"
          className="input-field"
        />
        <p className="mt-1 text-[10px] text-zinc-600">
          The AI will fill these in with real, unique values for each slide.
        </p>
      </div>

      {/* Slide count */}
      <div>
        <label className="label-text mb-1.5 block">Number of slides: {slideCount}</label>
        <input
          type="range"
          min={2}
          max={15}
          step={1}
          value={slideCount}
          onChange={(e) => setSlideCount(parseInt(e.target.value))}
          className="w-full max-w-xs accent-neon"
        />
        <p className="mt-0.5 text-[10px] text-zinc-600">2 – 15 slides</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handlePlan}
        disabled={planning || !concept.trim()}
        className="btn-primary self-start disabled:opacity-40"
      >
        {planning ? (
          <><Loader2 size={14} className="animate-spin" /> Planning slides…</>
        ) : (
          <><Sparkles size={14} /> Plan with AI</>
        )}
      </button>

      {/* Planned slides review */}
      {plannedSlides.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              AI Plan — {plannedSlides.length} slides{" "}
              <span className="text-xs font-normal text-zinc-500">Review and edit before using</span>
            </h3>
            <button
              type="button"
              onClick={handlePlan}
              disabled={planning}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-neon"
            >
              {planning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Regenerate plan
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {plannedSlides.map((slide, i) => (
              <div key={i} className="rounded-lg border border-surface-border bg-surface-200">
                <button
                  type="button"
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-zinc-600">#{i + 1}</span>
                    <span className="text-xs font-medium text-zinc-200">{slide.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pencil size={11} className="text-zinc-600" />
                    {expandedIdx === i ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
                  </div>
                </button>

                {expandedIdx === i && (
                  <div className="flex flex-col gap-3 border-t border-surface-border px-3 py-3">
                    <div>
                      <label className="label-text mb-1 block">Image Prompt</label>
                      <textarea
                        value={slide.customPrompt}
                        onChange={(e) => updatePlanned(i, "customPrompt", e.target.value)}
                        rows={4}
                        className="input-field resize-none text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="label-text mb-1 block">Variation Direction</label>
                      <input
                        value={slide.variationDirection}
                        onChange={(e) => updatePlanned(i, "variationDirection", e.target.value)}
                        className="input-field text-[11px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUseThisPlan}
            className="btn-primary self-start"
          >
            Use this plan →
          </button>
        </div>
      )}
    </div>
  );
}
