"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Trash2, Eye, Heart, User, Calendar, Pencil, RefreshCw, Loader2, Download, X, ZoomIn } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { MockSlideshow, MockScheduleEntry, MockHistoryEntry } from "@/lib/types";

type Account = { id: string; name: string };

export default function SlideshowDetailClient({
  slideshow,
  schedule,
  history,
  accounts = [],
}: {
  slideshow: MockSlideshow;
  schedule: MockScheduleEntry[];
  history: MockHistoryEntry[];
  accounts?: Account[];
}) {
  const router = useRouter();
  const [slides, setSlides] = useState(slideshow.slides);
  const [status, setStatus] = useState(slideshow.status);
  // True while a generate-all stream is active in this session
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [individuallyGenerating, setIndividuallyGenerating] = useState<Set<string>>(new Set());

  // Derive progress counts from slide states (works even if stream started elsewhere)
  const generatingCount = slides.filter((s) => s.status === "generating").length;

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ src: string; index: number } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setLightbox(null); return; }
      if (e.key === "ArrowLeft") {
        const prev = slides.slice(0, lightbox.index).reverse().find((s) => s.finalImagePath);
        const prevIdx = prev ? slides.indexOf(prev) : -1;
        if (prev && prevIdx >= 0) setLightbox({ src: prev.finalImagePath!, index: prevIdx });
      }
      if (e.key === "ArrowRight") {
        const next = slides.slice(lightbox.index + 1).find((s) => s.finalImagePath);
        const nextIdx = next ? slides.indexOf(next) : -1;
        if (next && nextIdx >= 0) setLightbox({ src: next.finalImagePath!, index: nextIdx });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, slides]);

  // Edit modal state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(slideshow.name);
  const [editCaption, setEditCaption] = useState(slideshow.caption ?? "");
  const [editHashtags, setEditHashtags] = useState(slideshow.hashtags ?? "");
  const [editAccountId, setEditAccountId] = useState(slideshow.tiktokAccountId ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const doneCount = slides.filter((s) => s.status === "done").length;
  const progressPct = slides.length ? Math.round((doneCount / slides.length) * 100) : 0;
  const allGenerated = slides.length > 0 && slides.every((s) => s.status === "done");

  async function handleGenerateAll() {
    setActionError(null);
    setGenerating(true);
    setStatus("GENERATING");

    let completedNormally = false;

    try {
      const res = await fetch(`/api/slideshows/${slideshow.id}/generate`, { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Generation request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: !done });
        if (done) break;

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: Record<string, unknown>;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.type === "slide_start") {
            setSlides((prev) =>
              prev.map((s) => (s.id === data.slideId ? { ...s, status: "generating", errorMessage: null } : s))
            );
          } else if (data.type === "slide_done") {
            setSlides((prev) =>
              prev.map((s) =>
                s.id === data.slideId
                  ? { ...s, status: "done", finalImagePath: data.finalImagePath as string, errorMessage: null }
                  : s
              )
            );
          } else if (data.type === "slide_failed") {
            setSlides((prev) =>
              prev.map((s) => (s.id === data.slideId ? { ...s, status: "failed", errorMessage: data.message as string } : s))
            );
          } else if (data.type === "error") {
            setActionError(data.message as string);
            setStatus("FAILED");
            completedNormally = true;
          } else if (data.type === "complete") {
            setStatus((data.failed as boolean) ? "FAILED" : "DRAFT");
            completedNormally = true;
          }
        }
      }

      // Flush any remaining buffer after stream closes
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (data.type === "complete") {
              setStatus((data.failed as boolean) ? "FAILED" : "DRAFT");
              completedNormally = true;
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Generation failed");
      setStatus("FAILED");
    } finally {
      // Always stop the spinner — even if the complete event was lost
      setGenerating(false);
      if (!completedNormally) {
        // Stream closed without a complete event — derive status from slide results
        setSlides((prev) => {
          const anyFailed = prev.some((s) => s.status === "failed");
          setStatus(anyFailed ? "FAILED" : "DRAFT");
          return prev;
        });
      }
    }
  }

  async function handlePostNow() {
    setActionError(null);
    setPosting(true);
    try {
      const res = await fetch(`/api/slideshows/${slideshow.id}/post`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body.error || "Failed to post to TikTok");
        setStatus("FAILED");
      } else {
        setStatus("POSTED");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleGenerateSlide(slideId: string) {
    setIndividuallyGenerating((prev) => new Set(prev).add(slideId));
    setSlides((prev) => prev.map((s) => (s.id === slideId ? { ...s, status: "generating", errorMessage: null } : s)));
    try {
      const res = await fetch(`/api/slideshows/${slideshow.id}/slides/${slideId}/generate`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setSlides((prev) =>
          prev.map((s) => (s.id === slideId ? { ...s, status: "failed", errorMessage: body.error } : s))
        );
      } else {
        setSlides((prev) =>
          prev.map((s) =>
            s.id === slideId ? { ...s, status: "done", finalImagePath: body.finalImagePath, errorMessage: null } : s
          )
        );
      }
    } finally {
      setIndividuallyGenerating((prev) => {
        const next = new Set(prev);
        next.delete(slideId);
        return next;
      });
    }
  }

  async function handleSaveEdit() {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/slideshows/${slideshow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          caption: editCaption.trim(),
          hashtags: editHashtags.trim(),
          tiktokAccountId: editAccountId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Save failed");
      }
      router.refresh();
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this slideshow? This cannot be undone.")) return;
    await fetch(`/api/slideshows/${slideshow.id}`, { method: "DELETE" });
    router.push("/slideshows");
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">{slideshow.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-zinc-400">{slideshow.caption}</p>
          <p className="mt-1 text-xs text-neon/80">{slideshow.hashtags}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <User size={13} /> {slideshow.tiktokAccountName ?? "No account assigned"}
            </span>
            {slideshow.nextPostDate && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} /> Next post {slideshow.nextPostDate} at {slideshow.postTime}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye size={13} /> {slideshow.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <Heart size={13} /> {slideshow.likes.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary">
            <Pencil size={15} /> Edit
          </button>
          <button onClick={handleGenerateAll} disabled={generating} className="btn-primary">
            <Sparkles size={15} /> {generating ? "Generating…" : "Generate All"}
          </button>
          <button
            onClick={handlePostNow}
            disabled={posting || !allGenerated || !slideshow.tiktokAccountId}
            className="btn-secondary"
            title={!allGenerated ? "Generate all slides first" : !slideshow.tiktokAccountId ? "Assign a TikTok account first" : ""}
          >
            <Send size={15} /> {posting ? "Posting…" : "Post Now"}
          </button>
          {allGenerated && (
            <a
              href={`/api/slideshows/${slideshow.id}/download`}
              download
              className="btn-secondary flex items-center gap-1.5"
            >
              <Download size={15} /> Download
            </a>
          )}
          <button onClick={handleDelete} className="btn-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="card border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">{actionError}</div>
      )}

      {(generating || generatingCount > 0) && (
        <div className="card p-4 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-neon" />
              Generating slides…
            </span>
            <span className="tabular-nums">{doneCount} / {slides.length} done</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-300">
            <div className="h-full rounded-full bg-neon transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {slides.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-200 px-2 py-1.5">
                {s.status === "done" && <span className="h-2 w-2 rounded-full bg-neon shrink-0" />}
                {s.status === "generating" && <Loader2 size={10} className="animate-spin text-yellow-400 shrink-0" />}
                {s.status === "failed" && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                {(s.status === "draft") && <span className="h-2 w-2 rounded-full border border-zinc-600 shrink-0" />}
                <span className="text-[11px] text-zinc-400 truncate">Slide {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">
          Slides <span className="text-zinc-500">({slides.length})</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {slides.map((slide, i) => {
            const thumb = slide.finalImagePath || slide.generatedImagePath || slide.referenceImagePath;
            const isGeneratingThis = individuallyGenerating.has(slide.id) || slide.status === "generating";
            return (
              <div key={slide.id} className="card overflow-hidden p-3">
                <div className="mb-2 flex h-32 w-full items-center justify-center overflow-hidden rounded-lg bg-surface-200 text-zinc-600">
                  {thumb ? (
                    <button
                      onClick={() => slide.finalImagePath && setLightbox({ src: slide.finalImagePath, index: i })}
                      className={`group relative h-full w-full ${slide.finalImagePath ? "cursor-zoom-in" : "cursor-default"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" />
                      {slide.finalImagePath && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <ZoomIn size={20} className="text-white" />
                        </div>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs">Slide {i + 1}</span>
                  )}
                </div>
                <p className="mb-1 line-clamp-2 text-[11px] font-medium text-zinc-300">
                  {slide.customPrompt ? slide.customPrompt.slice(0, 60) + (slide.customPrompt.length > 60 ? "…" : "") : `Slide ${i + 1}`}
                </p>
                {slide.overlayText && (
                  <p className="mb-1.5 line-clamp-2 text-[11px] text-zinc-500">&ldquo;{slide.overlayText}&rdquo;</p>
                )}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <StatusBadgeFor status={slide.status} />
                  <div className="flex items-center gap-1.5">
                    {slide.finalImagePath && (
                      <a
                        href={slide.finalImagePath}
                        download={`slide-${i + 1}.jpg`}
                        title="Download this slide"
                        className="text-zinc-500 hover:text-neon transition"
                      >
                        <Download size={13} />
                      </a>
                    )}
                    <button
                      onClick={() => handleGenerateSlide(slide.id)}
                      disabled={isGeneratingThis || generating}
                      title={slide.status === "done" ? "Regenerate this slide" : "Generate this slide"}
                      className="text-zinc-500 hover:text-neon disabled:opacity-40"
                    >
                      {isGeneratingThis ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                    </button>
                  </div>
                </div>
                {slide.status === "failed" && slide.errorMessage && (
                  <p className="line-clamp-2 text-[10px] text-red-400">{slide.errorMessage}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Scheduled Dates</h2>
          {schedule.length === 0 ? (
            <p className="text-xs text-zinc-500">No scheduled dates for this slideshow.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schedule.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-surface-border pb-2 text-xs last:border-0">
                  <span className="text-zinc-300">{s.date} at {s.time}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Analytics</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Views</p>
              <p className="mt-1 text-xl font-bold text-white">{slideshow.views.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-surface-200 p-3">
              <p className="label-text">Likes</p>
              <p className="mt-1 text-xl font-bold text-white">{slideshow.likes.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Live analytics sync from TikTok is not yet connected — placeholder values shown.
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Post History</h2>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between border-b border-surface-border pb-2 text-xs last:border-0">
                <span className="text-zinc-300">{new Date(h.postedAt).toLocaleString()}</span>
                <span className={h.status === "posted" ? "text-neon" : "text-red-400"}>
                  {h.status === "posted" ? "Posted" : `Failed — ${h.errorMessage}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex flex-col items-center gap-3 max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex w-full items-center justify-between px-1">
              <span className="text-xs font-medium text-zinc-400">
                Slide {lightbox.index + 1} of {slides.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.src}
                  download={`slide-${lightbox.index + 1}.jpg`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition"
                >
                  <Download size={12} /> Download
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Image — constrained to actual slide aspect ratio */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={`Slide ${lightbox.index + 1}`}
              style={{ aspectRatio: `${slideshow.outputWidth} / ${slideshow.outputHeight}` }}
              className="max-h-[80vh] w-auto rounded-xl border border-zinc-700 object-contain shadow-2xl"
            />

            {/* Prev / Next */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const prev = slides
                    .slice(0, lightbox.index)
                    .reverse()
                    .find((s) => s.finalImagePath);
                  const prevIdx = prev ? slides.indexOf(prev) : -1;
                  if (prev && prevIdx >= 0) setLightbox({ src: prev.finalImagePath!, index: prevIdx });
                }}
                disabled={!slides.slice(0, lightbox.index).some((s) => s.finalImagePath)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition"
              >
                ← Prev
              </button>
              <button
                onClick={() => {
                  const next = slides.slice(lightbox.index + 1).find((s) => s.finalImagePath);
                  const nextIdx = next ? slides.indexOf(next) : -1;
                  if (next && nextIdx >= 0) setLightbox({ src: next.finalImagePath!, index: nextIdx });
                }}
                disabled={!slides.slice(lightbox.index + 1).some((s) => s.finalImagePath)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-surface-border bg-surface shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="text-base font-semibold text-white">Edit Slideshow</h2>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-surface-200 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Slideshow name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Caption</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  className="input-field w-full resize-none text-sm"
                  placeholder="TikTok caption…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Hashtags</label>
                <input
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  className="input-field w-full"
                  placeholder="#fitness #health …"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">TikTok Account</label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">— No account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {editError && (
                <p className="text-xs text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                  {editError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-4">
              <button
                onClick={() => setEditing(false)}
                disabled={editSaving}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editName.trim()}
                className="btn-primary"
              >
                {editSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadgeFor({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "text-zinc-500",
    generating: "text-yellow-400",
    done: "text-neon",
    failed: "text-red-400",
  };
  const label: Record<string, string> = {
    draft: "Not generated yet",
    generating: "Generating…",
    done: "Generated",
    failed: "Failed",
  };
  return <span className={`text-[11px] font-medium ${map[status]}`}>{label[status]}</span>;
}
