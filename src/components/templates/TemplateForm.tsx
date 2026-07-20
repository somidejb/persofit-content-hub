"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Plus, Bot } from "lucide-react";
import { ASPECT_RATIO_PRESETS } from "@/lib/aspect-ratio-presets";
import TemplateRunPreview from "./TemplateRunPreview";
import TemplateSlideEditor, {
  type TemplateSlideDraft,
  emptyTemplateSlideDraft,
} from "./TemplateSlideEditor";

const DAY_OPTIONS = [
  { code: "mon", label: "Mon" },
  { code: "tue", label: "Tue" },
  { code: "wed", label: "Wed" },
  { code: "thu", label: "Thu" },
  { code: "fri", label: "Fri" },
  { code: "sat", label: "Sat" },
  { code: "sun", label: "Sun" },
];

type Account = { id: string; name: string };

type StoredTemplateSlide = {
  id: string;
  order: number;
  imageMode: string;
  referenceImagePath: string | null;
  randomImagePool: string;
  customPrompt: string | null;
  variationDirection: string | null;
  textOverlayEnabled: boolean;
  overlayText: string | null;
  overlaySubtext: string | null;
  textPosition: string;
  textSize: string;
  textAlign: string;
  textColor: string;
  textAccentColor: string;
  textStyle: string;
  textShadow: boolean;
  textBoxEnabled: boolean;
  textBoxOpacity: number;
};

interface TemplateFormProps {
  accounts: Account[];
  /** Called after a successful save when in edit mode — receives fresh template data */
  onSaved?: (updatedId: string) => void;
  /** When provided, the form is in edit mode */
  initialValues?: {
    id: string;
    name: string;
    caption: string;
    hashtags: string;
    tiktokAccountId: string | null;
    concept: string;
    variables: string | null;
    slideCount: number;
    referenceImagePath: string | null;
    aspectRatio: string;
    outputWidth: number;
    outputHeight: number;
    postTime: string;
    scheduleDays: string[];
    autoPost: boolean;
    active: boolean;
    templateSlides?: StoredTemplateSlide[];
  };
}

export default function TemplateForm({ accounts, initialValues, onSaved }: TemplateFormProps) {
  const router = useRouter();
  const isEdit = !!initialValues;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [caption, setCaption] = useState(initialValues?.caption ?? "");
  const [hashtags, setHashtags] = useState(initialValues?.hashtags ?? "");
  const [tiktokAccountId, setTiktokAccountId] = useState(initialValues?.tiktokAccountId ?? "");
  const [concept, setConcept] = useState(initialValues?.concept ?? "");
  const [variables, setVariables] = useState(initialValues?.variables ?? "");
  const [slideCount, setSlideCount] = useState(initialValues?.slideCount ?? 7);
  const [referenceImagePath, setReferenceImagePath] = useState(
    initialValues?.referenceImagePath ?? null
  );
  const [aspectRatio, setAspectRatio] = useState(initialValues?.aspectRatio ?? "9:16");
  const [outputWidth, setOutputWidth] = useState(initialValues?.outputWidth ?? 1080);
  const [outputHeight, setOutputHeight] = useState(initialValues?.outputHeight ?? 1920);
  const [postTime, setPostTime] = useState(initialValues?.postTime ?? "09:00");
  const [scheduleDays, setScheduleDays] = useState<string[]>(
    initialValues?.scheduleDays ?? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  );
  const [autoPost, setAutoPost] = useState(initialValues?.autoPost ?? false);
  const [active, setActive] = useState(initialValues?.active ?? true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Slide definitions — empty means "let AI plan all slides automatically"
  const [useManualSlides, setUseManualSlides] = useState(
    () => (initialValues?.templateSlides?.length ?? 0) > 0
  );
  const [slideDrafts, setSlideDrafts] = useState<TemplateSlideDraft[]>(() => {
    const stored = initialValues?.templateSlides ?? [];
    if (stored.length === 0) return [];
    return stored.map((s) => ({
      id: crypto.randomUUID(),
      imageMode: (s.imageMode as TemplateSlideDraft["imageMode"]) ?? "ai-auto",
      referenceImagePath: s.referenceImagePath,
      referenceImagePreviewUrl: s.referenceImagePath,
      randomImagePool: (() => { try { return JSON.parse(s.randomImagePool); } catch { return []; } })(),
      randomImagePreviewUrls: (() => { try { return JSON.parse(s.randomImagePool); } catch { return []; } })(),
      customPrompt: s.customPrompt ?? "",
      variationDirection: s.variationDirection ?? "",
      textOverlayEnabled: s.textOverlayEnabled,
      overlayText: s.overlayText ?? "",
      overlaySubtext: s.overlaySubtext ?? "",
      textPosition: s.textPosition,
      textSize: s.textSize,
      textAlign: s.textAlign,
      textColor: s.textColor,
      textAccentColor: s.textAccentColor,
      textStyle: s.textStyle,
      textShadow: s.textShadow,
      textBoxEnabled: s.textBoxEnabled,
      textBoxOpacity: s.textBoxOpacity,
    }));
  });

  function toggleDay(code: string) {
    setScheduleDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    );
  }

  function handleAspectRatioChange(value: string) {
    setAspectRatio(value);
    const preset = ASPECT_RATIO_PRESETS.find((p) => p.value === value);
    if (preset && preset.value !== "custom") {
      setOutputWidth(preset.width);
      setOutputHeight(preset.height);
    }
  }

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "reference");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setReferenceImagePath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!concept.trim()) { setError("Content concept is required"); return; }
    if (scheduleDays.length === 0) { setError("Select at least one schedule day"); return; }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      caption: caption.trim(),
      hashtags: hashtags.trim(),
      tiktokAccountId: tiktokAccountId || null,
      concept: concept.trim(),
      variables: variables.trim() || null,
      slideCount,
      referenceImagePath,
      aspectRatio,
      outputWidth,
      outputHeight,
      postTime,
      scheduleDays,
      autoPost,
      active,
      // If manual mode is on, send slide definitions; otherwise empty array clears them
      templateSlides: useManualSlides
        ? slideDrafts.map((s, i) => ({
            order: i + 1,
            imageMode: s.imageMode,
            referenceImagePath: s.referenceImagePath,
            randomImagePool: s.randomImagePool,
            customPrompt: s.customPrompt || null,
            variationDirection: s.variationDirection || null,
            textOverlayEnabled: s.textOverlayEnabled,
            overlayText: s.overlayText || null,
            overlaySubtext: s.overlaySubtext || null,
            textPosition: s.textPosition,
            textSize: s.textSize,
            textAlign: s.textAlign,
            textColor: s.textColor,
            textAccentColor: s.textAccentColor,
            textStyle: s.textStyle,
            textShadow: s.textShadow,
            textBoxEnabled: s.textBoxEnabled,
            textBoxOpacity: s.textBoxOpacity,
          }))
        : [],
    };

    try {
      const url = isEdit ? `/api/templates/${initialValues!.id}` : "/api/templates";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (onSaved) {
        // Embedded edit mode: let the parent reset editing state and refresh
        onSaved(data.id);
        router.refresh();
      } else {
        // Standalone new-template page: navigate to the created template
        router.push(`/templates/${data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? "Edit Template" : "New Template"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Templates auto-generate a fresh slideshow on each scheduled run.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Basic info */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Basic Info</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Template Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Macro Meals"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Caption</label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="TikTok caption for each generated post"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Hashtags</label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#fitness #nutrition #macros"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">TikTok Account</label>
            <select
              value={tiktokAccountId}
              onChange={(e) => setTiktokAccountId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Content concept */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Content Concept</h2>
        <p className="text-xs text-zinc-500">
          Describe what you want GPT-4o to generate each day. Be specific about format, style and
          what should vary.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Concept Prompt</label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={5}
              placeholder="e.g. A 7-slide TikTok carousel about high-protein foods. Each slide shows one food (chicken, tuna, eggs…) with its macros per 100g in a clean infographic style…"
              className="input-field w-full resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Variables to change each run{" "}
              <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="e.g. food type, meal timing, calorie range"
              className="input-field w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Number of Slides</label>
              <input
                type="number"
                min={1}
                max={20}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="input-field w-24"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Reference image */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Reference Image</h2>
        <p className="text-xs text-zinc-500">
          Used as the visual style template for all generated slides.
        </p>
        {referenceImagePath ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenceImagePath}
              alt="Reference"
              className="h-32 w-auto rounded-lg border border-surface-border object-cover"
            />
            <button
              onClick={() => setReferenceImagePath(null)}
              className="absolute -right-2 -top-2 rounded-full bg-zinc-800 p-1 text-zinc-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-dashed border-surface-border px-4 py-3 text-sm text-zinc-400 hover:border-zinc-500 hover:text-white transition"
          >
            <Upload size={16} />
            {uploading ? "Uploading…" : "Upload reference image"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
      </section>

      {/* Output size */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Output Size</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => handleAspectRatioChange(e.target.value)}
              className="input-field w-full"
            >
              {ASPECT_RATIO_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {aspectRatio === "custom" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Width (px)</label>
                <input
                  type="number"
                  value={outputWidth}
                  onChange={(e) => setOutputWidth(Number(e.target.value))}
                  className="input-field w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Height (px)</label>
                <input
                  type="number"
                  value={outputHeight}
                  onChange={(e) => setOutputHeight(Number(e.target.value))}
                  className="input-field w-full"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Schedule */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Schedule</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Post Time</label>
            <input
              type="time"
              value={postTime}
              onChange={(e) => setPostTime(e.target.value)}
              className="input-field w-32"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAY_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => toggleDay(code)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    scheduleDays.includes(code)
                      ? "border-neon/50 bg-neon/10 text-neon"
                      : "border-surface-border bg-surface-200 text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() =>
                  setScheduleDays(
                    scheduleDays.length === 7
                      ? []
                      : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
                  )
                }
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-500 hover:text-white transition"
              >
                {scheduleDays.length === 7 ? "Clear all" : "All days"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Posting behaviour */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Posting Behaviour</h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-neon"
            />
            <div>
              <p className="text-sm font-medium text-white">Auto-post (no approval)</p>
              <p className="text-xs text-zinc-500">
                Generated slideshows will post to TikTok immediately. Leave unchecked to review
                before posting.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-neon"
            />
            <div>
              <p className="text-sm font-medium text-white">Active</p>
              <p className="text-xs text-zinc-500">Uncheck to pause this template.</p>
            </div>
          </label>
        </div>
      </section>

      {/* Slide Definitions */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300">Slides</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Define slides manually, or let AI plan them all automatically from your concept.
            </p>
          </div>
          <button
            onClick={() => {
              const next = !useManualSlides;
              setUseManualSlides(next);
              if (next && slideDrafts.length === 0) {
                setSlideDrafts([emptyTemplateSlideDraft(1)]);
              }
            }}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              useManualSlides
                ? "border-neon/50 bg-neon/10 text-neon"
                : "border-surface-border text-zinc-400 hover:text-white"
            }`}
          >
            {useManualSlides ? "Manual (custom slides)" : "Auto (AI plans all)"}
          </button>
        </div>

        {!useManualSlides && (
          <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-200 px-3 py-3 text-xs text-zinc-500">
            <Bot size={14} className="shrink-0 mt-0.5 text-zinc-600" />
            <span>
              GPT-4o will plan all {slideCount} slides from your concept and variables on each
              scheduled run. Use the Preview panel below to see what it would generate.
            </span>
          </div>
        )}

        {useManualSlides && (
          <div className="space-y-2">
            {slideDrafts.map((s, i) => (
              <TemplateSlideEditor
                key={s.id}
                slide={s}
                index={i}
                onChange={(id, patch) =>
                  setSlideDrafts((prev) =>
                    prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
                  )
                }
                onRemove={(id) =>
                  setSlideDrafts((prev) => prev.filter((d) => d.id !== id))
                }
                canRemove={slideDrafts.length > 1}
                outputWidth={outputWidth}
                outputHeight={outputHeight}
                templateReferenceImagePath={referenceImagePath}
                siblingSlides={slideDrafts}
              />
            ))}
            <button
              onClick={() =>
                setSlideDrafts((prev) => [...prev, emptyTemplateSlideDraft(prev.length + 1)])
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border py-2.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-white transition"
            >
              <Plus size={13} />
              Add Slide
            </button>
            <p className="text-[11px] text-zinc-600">
              {slideDrafts.length} slide{slideDrafts.length !== 1 ? "s" : ""} defined —{" "}
              {slideDrafts.filter((s) => s.imageMode === "ai-auto").length} AI Auto,{" "}
              {slideDrafts.filter((s) => s.imageMode === "generate").length} Generate with AI,{" "}
              {slideDrafts.filter((s) => s.imageMode === "random-pick").length} Random Pick
            </p>
          </div>
        )}
      </section>

      {/* Preview a run */}
      <TemplateRunPreview
        concept={concept}
        variables={variables}
        slideCount={slideCount}
        referenceImagePath={referenceImagePath}
        outputWidth={outputWidth}
        outputHeight={outputHeight}
      />

      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-surface-border px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
        >
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Template"}
        </button>
      </div>
    </div>
  );
}
