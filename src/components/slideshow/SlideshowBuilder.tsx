"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, User, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import MusicField, { extractMusicId } from "@/components/ui/MusicField";
import SlideEditor, { SlideDraft } from "./SlideEditor";
import AIPlannerForm from "./AIPlannerForm";
import ScheduleEditor from "./ScheduleEditor";
import { ASPECT_RATIO_PRESETS, findAspectRatioPreset, DEFAULT_ASPECT_RATIO } from "@/lib/aspect-ratio-presets";
import type { MockAccount } from "@/lib/types";

// Meaningful variation directions for auto-filling cloned slides.
// Index 0 is reserved for the original slide (no direction).
const AUTO_VARIATION_DIRECTIONS = [
  "Different angle and tighter crop — shift the camera perspective",
  "Contrasting lighting — warm golden hour tones",
  "Zoomed out, more environmental context in frame",
  "Close-up crop, intimate and detailed feel",
  "High contrast, bold moody atmosphere",
  "Soft, airy and bright — light and minimal",
  "Dynamic diagonal composition, energetic framing",
  "Minimal background, subject fully centered",
  "Rich saturated colors, vibrant energy",
  "Desaturated or muted palette, calm and subtle",
];

function emptySlide(): SlideDraft {
  return {
    id: crypto.randomUUID(),
    imageMode: "generate",
    referenceImagePreviewUrl: null,
    referenceImagePath: null,
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
  };
}

export default function SlideshowBuilder({ initialSlides }: { initialSlides?: SlideDraft[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<MockAccount[]>([]);
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [slides, setSlides] = useState<SlideDraft[]>(initialSlides ?? [emptySlide()]);
  const [postTime, setPostTime] = useState("09:00");
  const [dates, setDates] = useState<string[]>([]);
  const [musicRaw, setMusicRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);

  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [outputWidth, setOutputWidth] = useState(1080);
  const [outputHeight, setOutputHeight] = useState(1920);
  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.defaultAspectRatio) {
          setAspectRatio(data.defaultAspectRatio);
          setOutputWidth(data.defaultOutputWidth ?? 1080);
          setOutputHeight(data.defaultOutputHeight ?? 1920);
        }
      })
      .catch(() => {});
  }, []);

  function handleAspectRatioChange(value: string) {
    setAspectRatio(value);
    const preset = findAspectRatioPreset(value);
    if (preset && value !== "custom") {
      setOutputWidth(preset.width);
      setOutputHeight(preset.height);
    }
  }

  function updateSlide(id: string, patch: Partial<SlideDraft>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlide(id: string) {
    setSlides((prev) => prev.filter((s) => s.id !== id));
  }

  function addSlide() {
    setSlides((prev) => [...prev, emptySlide()]);
  }

  function appendSlides(newSlides: SlideDraft[]) {
    setSlides((prev) => [...prev, ...newSlides]);
    setAiPlannerOpen(false);
  }

  function expandSlide(id: string, count: number) {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const source = prev[idx];
      const clones: SlideDraft[] = Array.from({ length: count }, (_, i) => ({
        ...source,
        id: crypto.randomUUID(),
        variationDirection: AUTO_VARIATION_DIRECTIONS[i % AUTO_VARIATION_DIRECTIONS.length],
      }));
      const next = [...prev];
      next.splice(idx + 1, 0, ...clones);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (slides.some((s) => !s.referenceImagePath)) {
      setError("Every slide needs a reference image (wait for uploads to finish).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/slideshows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          caption,
          hashtags,
          tiktokAccountId: accountId || null,
          tiktokMusicId: extractMusicId(musicRaw) || null,
          aspectRatio,
          outputWidth,
          outputHeight,
          slides: slides.map((s, i) => ({
            order: i + 1,
            imageMode: s.imageMode,
            referenceImagePath: s.referenceImagePath,
            randomImagePool: JSON.stringify(s.randomImagePool.filter(Boolean)),
            customPrompt: s.customPrompt,
            variationDirection: s.variationDirection,
            textOverlayEnabled: s.textOverlayEnabled,
            overlayText: s.overlayText,
            overlaySubtext: s.overlaySubtext,
            textPosition: s.textPosition,
            textSize: s.textSize,
            textAlign: s.textAlign,
            textColor: s.textColor,
            textAccentColor: s.textAccentColor,
            textStyle: s.textStyle,
            textShadow: s.textShadow,
            textBoxEnabled: s.textBoxEnabled,
            textBoxOpacity: s.textBoxOpacity,
          })),
          schedule: dates.length ? { postTime, dates } : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to save slideshow.");
        return;
      }
      const created = await res.json();
      router.push(`/slideshows/${created.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="card flex flex-col gap-4 p-5">
        <div>
          <label className="label-text mb-1.5 block">Slideshow name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 30-Day Glow Up Transformation"
            className="input-field"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text mb-1.5 block">Caption</label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption shown on the TikTok post"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Hashtags</label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#fitness #transformation"
              className="input-field"
            />
          </div>
        </div>
        <div>
          <label className="label-text mb-1.5 block">TikTok account</label>
          <div className="relative">
            <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input-field appearance-none pl-9"
            >
              <option value="">Select an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.connected}>
                  {a.name} {!a.connected ? "(disconnected)" : ""}
                </option>
              ))}
            </select>
          </div>
          {accounts.length === 0 && (
            <p className="mt-1.5 text-[11px] text-zinc-500">
              No accounts connected yet — add one from the Accounts page.
            </p>
          )}
        </div>
        <MusicField value={musicRaw} onChange={setMusicRaw} />
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold text-white">Output Format</h2>
        <div>
          <label className="label-text mb-1.5 block">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => handleAspectRatioChange(e.target.value)}
            className="input-field"
          >
            {ASPECT_RATIO_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text mb-1.5 block">Output Width</label>
            <input
              type="number"
              value={outputWidth}
              disabled={aspectRatio !== "custom"}
              onChange={(e) => setOutputWidth(parseInt(e.target.value) || 0)}
              className="input-field disabled:opacity-50"
            />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Output Height</label>
            <input
              type="number"
              value={outputHeight}
              disabled={aspectRatio !== "custom"}
              onChange={(e) => setOutputHeight(parseInt(e.target.value) || 0)}
              className="input-field disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            Slides <span className="text-zinc-500">({slides.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiPlannerOpen((o) => !o)}
              className="btn-secondary"
            >
              <Sparkles size={15} />
              AI Plan
              {aiPlannerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button type="button" onClick={addSlide} className="btn-secondary">
              <Plus size={15} /> Add slide
            </button>
          </div>
        </div>

        {/* Inline AI planner panel */}
        {aiPlannerOpen && (
          <div className="card mb-3 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">AI-Planned Slides</h3>
                <p className="text-xs text-zinc-500">
                  Describe your concept — AI writes the prompts, you review them, then they get added to your slideshow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiPlannerOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Close
              </button>
            </div>
            <AIPlannerForm onPlanReady={appendSlides} />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {slides.map((slide, i) => (
            <SlideEditor
              key={slide.id}
              slide={slide}
              index={i}
              onChange={updateSlide}
              onRemove={removeSlide}
              onExpand={expandSlide}
              canRemove={slides.length > 1}
              outputWidth={outputWidth}
              outputHeight={outputHeight}
            />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Schedule</h2>
        <ScheduleEditor postTime={postTime} dates={dates} onChangeTime={setPostTime} onChangeDates={setDates} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/slideshows")} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={!name || saving} className="btn-primary">
          <Save size={15} />
          {saving ? "Saving…" : "Save Slideshow"}
        </button>
      </div>
    </div>
  );
}
