"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ExternalLink,
  Clock,
  Calendar,
  Zap,
  AlertCircle,
  Download,
  Play,
  Loader2,
} from "lucide-react";
import TemplateForm from "./TemplateForm";
import TemplateRunPreview from "./TemplateRunPreview";

type Run = {
  id: string;
  templateId: string;
  slideshowId: string | null;
  status: string;
  scheduledFor: string;
  errorMessage: string | null;
  createdAt: string;
};

type TemplateSlide = {
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

type Template = {
  id: string;
  name: string;
  caption: string;
  hashtags: string;
  tiktokAccountId: string | null;
  tiktokMusicId: string | null;
  concept: string;
  variables: string | null;
  slideCount: number;
  referenceImagePath: string | null;
  aspectRatio: string;
  outputWidth: number;
  outputHeight: number;
  postTime: string;
  scheduleDays: string;
  autoPost: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tiktokAccount: { id: string; name: string } | null;
  templateSlides: TemplateSlide[];
  runs: Run[];
};

type Account = { id: string; name: string };

const RUN_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  GENERATING: { label: "Generating…", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse" },
  AWAITING_APPROVAL: { label: "Awaiting Approval", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  POSTED: { label: "Posted", className: "bg-[#00FF87]/10 text-[#00FF87] border-[#00FF87]/30" },
  FAILED: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  REJECTED: { label: "Rejected", className: "bg-zinc-800 text-zinc-500 border-zinc-700" },
};

export default function TemplateDetailClient({
  template: initial,
  accounts,
}: {
  template: Template;
  accounts: Account[];
}) {
  const router = useRouter();
  const [template, setTemplate] = useState(initial);
  const [editing, setEditing] = useState(false);

  // Sync when server refreshes data (router.refresh() re-runs the server component)
  useEffect(() => {
    setTemplate(initial);
  }, [initial.updatedAt]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowError, setRunNowError] = useState<string | null>(null);

  type SlideProgress = { order: number; imageMode: string; status: "pending" | "generating" | "done" | "failed"; imagePath?: string; error?: string };
  type RunPhase = "idle" | "planning" | "generating" | "done" | "error";
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [runSlides, setRunSlides] = useState<SlideProgress[]>([]);

  let days: string[] = [];
  try { days = JSON.parse(template.scheduleDays); } catch { days = []; }

  async function handleApprove(runId: string) {
    setActionLoading(runId + "-approve");
    setActionError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/runs/${runId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setTemplate((prev) => ({
        ...prev,
        runs: prev.runs.map((r) => (r.id === runId ? { ...r, status: "POSTED" } : r)),
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(runId: string) {
    if (!confirm("Reject and delete this generated slideshow?")) return;
    setActionLoading(runId + "-reject");
    setActionError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/runs/${runId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      setTemplate((prev) => ({
        ...prev,
        runs: prev.runs.map((r) =>
          r.id === runId ? { ...r, status: "REJECTED", slideshowId: null } : r
        ),
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this template and all its run history?")) return;
    await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    router.push("/templates");
    router.refresh();
  }

  async function handleRunNow() {
    setRunNowLoading(true);
    setRunNowError(null);
    setRunPhase("planning");
    setRunSlides([]);

    try {
      const res = await fetch(`/api/templates/${template.id}/run-now`, { method: "POST" });

      // Handle non-streaming error responses (409 conflict, 404, etc.)
      if (!res.ok || res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        throw new Error(data.error || "Run failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          const type = event.type as string;

          if (type === "planning_start") {
            setRunPhase("planning");
          } else if (type === "planning_done") {
            setRunPhase("generating");
          } else if (type === "slideshow_created") {
            const slides = (event.slides as { id: string; order: number; imageMode: string }[]).map((s) => ({
              order: s.order,
              imageMode: s.imageMode,
              status: "pending" as const,
            }));
            setRunSlides(slides);
          } else if (type === "slide_start") {
            setRunSlides((prev) =>
              prev.map((s) => s.order === (event.order as number) ? { ...s, status: "generating" } : s)
            );
          } else if (type === "slide_done") {
            setRunSlides((prev) =>
              prev.map((s) =>
                s.order === (event.order as number)
                  ? { ...s, status: "done", imagePath: event.finalImagePath as string }
                  : s
              )
            );
          } else if (type === "slide_failed") {
            setRunSlides((prev) =>
              prev.map((s) =>
                s.order === (event.order as number)
                  ? { ...s, status: "failed", error: event.message as string }
                  : s
              )
            );
          } else if (type === "complete") {
            setRunPhase("done");
            router.refresh();
          } else if (type === "error") {
            setRunNowError(event.message as string);
            setRunPhase("error");
          } else if (type === "stream_end") {
            setRunPhase((prev) => {
              if (prev !== "done" && prev !== "error") router.refresh();
              return prev === "error" ? "error" : "done";
            });
          }
        }
      }
    } catch (err) {
      setRunNowError(err instanceof Error ? err.message : "Run failed");
      setRunPhase("error");
    } finally {
      setRunNowLoading(false);
    }
  }

  async function handleToggleActive() {
    const res = await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !template.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTemplate((prev) => ({ ...prev, active: updated.active }));
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft size={16} /> Back to detail
        </button>
        <TemplateForm
          accounts={accounts}
          onSaved={() => setEditing(false)}
          initialValues={{
            ...template,
            scheduleDays: days,
            templateSlides: template.templateSlides,
          }}
        />
      </div>
    );
  }

  const pendingRuns = template.runs.filter((r) => r.status === "AWAITING_APPROVAL");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/templates"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition mb-2"
          >
            <ArrowLeft size={14} /> Templates
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
            {template.name}
            {!template.active && (
              <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500">
                Paused
              </span>
            )}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {template.postTime}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {days.length === 7
                ? "Daily"
                : days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}
            </span>
            <span>{template.slideCount} slides</span>
            {template.tiktokAccount && <span>@{template.tiktokAccount.name}</span>}
            {template.autoPost ? (
              <span className="text-neon">Auto-post</span>
            ) : (
              <span className="text-blue-400">Approval required</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleActive}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              template.active
                ? "border-zinc-700 text-zinc-400 hover:text-white"
                : "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
            }`}
          >
            {template.active ? "Pause" : "Activate"}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-surface-border bg-surface-200 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition flex items-center gap-1.5"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={handleRunNow}
            disabled={runNowLoading}
            className="rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-medium text-neon hover:bg-neon/20 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {runNowLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run Now
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-surface-border p-2 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {runNowError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {runNowError}
        </div>
      )}

      {/* Run Now Progress Panel */}
      {runPhase !== "idle" && (
        <div className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2">
            {(runPhase === "planning" || runPhase === "generating") ? (
              <Loader2 size={15} className="animate-spin text-neon shrink-0" />
            ) : runPhase === "done" ? (
              <CheckCircle2 size={15} className="text-neon shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-red-400 shrink-0" />
            )}
            <span className="text-sm font-semibold text-zinc-200">
              {runPhase === "planning" && "Planning slides with GPT-4o…"}
              {runPhase === "generating" && "Generating images…"}
              {runPhase === "done" && "Run complete"}
              {runPhase === "error" && "Run failed"}
            </span>
          </div>

          {runSlides.length > 0 && (
            <div className="space-y-1.5">
              {runSlides.map((s) => (
                <div key={s.order} className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-200 px-3 py-2">
                  {s.status === "pending" && <div className="h-3 w-3 rounded-full border border-zinc-600 shrink-0" />}
                  {s.status === "generating" && <Loader2 size={12} className="animate-spin text-neon shrink-0" />}
                  {s.status === "done" && <CheckCircle2 size={12} className="text-neon shrink-0" />}
                  {s.status === "failed" && <XCircle size={12} className="text-red-400 shrink-0" />}
                  <span className="text-xs text-zinc-400 shrink-0">Slide {s.order}</span>
                  <span className="text-[11px] text-zinc-600 capitalize">{s.imageMode.replace("-", " ")}</span>
                  {s.status === "generating" && <span className="text-[11px] text-neon ml-auto">Generating…</span>}
                  {s.status === "done" && s.imagePath && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.imagePath} alt={`Slide ${s.order}`} className="ml-auto h-10 w-auto rounded border border-surface-border object-cover" />
                  )}
                  {s.status === "failed" && <span className="text-[11px] text-red-400 ml-auto truncate max-w-[200px]">{s.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {/* Pending approvals */}
      {pendingRuns.length > 0 && (
        <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
            <Zap size={15} />
            {pendingRuns.length} Slideshow{pendingRuns.length > 1 ? "s" : ""} Awaiting Approval
          </h2>
          <div className="space-y-2">
            {pendingRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-blue-500/20 bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-white font-medium">{run.scheduledFor}</span>
                  {run.slideshowId && (
                    <Link
                      href={`/slideshows/${run.slideshowId}`}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition"
                    >
                      View slideshow <ExternalLink size={11} />
                    </Link>
                  )}
                  {run.slideshowId && (
                    <a
                      href={`/api/slideshows/${run.slideshowId}/download`}
                      download
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-neon transition"
                    >
                      <Download size={11} /> Download slides
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReject(run.id)}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    <XCircle size={13} />
                    {actionLoading === run.id + "-reject" ? "Rejecting…" : "Reject"}
                  </button>
                  <button
                    onClick={() => handleApprove(run.id)}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-neon/30 bg-neon/10 px-3 py-1.5 text-xs font-medium text-neon hover:bg-neon/20 transition disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    {actionLoading === run.id + "-approve" ? "Posting…" : "Approve & Post"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Concept */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Concept</h2>
        <p className="text-sm text-zinc-400 whitespace-pre-wrap">{template.concept}</p>
        {template.variables && (
          <div className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Variables:</span> {template.variables}
          </div>
        )}
        {template.referenceImagePath && (
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Reference image:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={template.referenceImagePath}
              alt="Reference"
              className="h-24 w-auto rounded-lg border border-surface-border object-cover"
            />
          </div>
        )}
      </section>

      {/* Slide definitions summary */}
      {template.templateSlides.length > 0 && (
        <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">
            Slides ({template.templateSlides.length})
          </h2>
          <div className="space-y-1.5">
            {template.templateSlides.map((s, i) => {
              const modeLabels: Record<string, { label: string; color: string }> = {
                "ai-auto": { label: "AI Auto", color: "text-purple-400" },
                "generate": { label: "Generate with AI", color: "text-neon" },
                "random-pick": { label: "Random Pick", color: "text-blue-400" },
              };
              const mode = modeLabels[s.imageMode] ?? { label: s.imageMode, color: "text-zinc-400" };
              return (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border border-surface-border px-3 py-2">
                  <span className="text-[11px] font-semibold text-zinc-600 w-5 shrink-0">#{i + 1}</span>
                  <span className={`text-[11px] font-medium shrink-0 ${mode.color}`}>{mode.label}</span>
                  {s.imageMode === "generate" && s.customPrompt && (
                    <span className="text-[11px] text-zinc-500 truncate">{s.customPrompt}</span>
                  )}
                  {s.imageMode === "random-pick" && (
                    <span className="text-[11px] text-zinc-500">
                      {(() => { try { return JSON.parse(s.randomImagePool).length; } catch { return 0; } })()} images in pool
                    </span>
                  )}
                  {s.imageMode === "ai-auto" && (
                    <span className="text-[11px] text-zinc-600 italic">Planned by GPT-4o each run</span>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-zinc-500 hover:text-white transition"
          >
            Edit slides →
          </button>
        </section>
      )}

      {/* Preview a run */}
      <TemplateRunPreview
        concept={template.concept}
        variables={template.variables}
        slideCount={template.slideCount}
        referenceImagePath={template.referenceImagePath}
        outputWidth={template.outputWidth}
        outputHeight={template.outputHeight}
      />

      {/* Run history */}
      <section className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Run History</h2>
        {template.runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet. The first run will occur at {template.postTime} on a scheduled day.</p>
        ) : (
          <div className="space-y-2">
            {template.runs.map((run) => {
              const style = RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.FAILED;
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-surface-border px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-white shrink-0">
                      {run.scheduledFor}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${style.className}`}
                    >
                      {style.label}
                    </span>
                    {run.errorMessage && (
                      <span className="text-xs text-red-400 truncate">{run.errorMessage}</span>
                    )}
                  </div>
                  {run.slideshowId && run.status !== "REJECTED" && (
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/slideshows/${run.slideshowId}`}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition"
                      >
                        View <ExternalLink size={11} />
                      </Link>
                      <a
                        href={`/api/slideshows/${run.slideshowId}/download`}
                        download
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-neon transition"
                      >
                        <Download size={11} /> Download
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
