"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, PlayCircle, Loader2, X, CheckCircle2, XCircle } from "lucide-react";

type RunSummary = { status: string; scheduledFor: string; errorMessage: string | null };
type TemplateSummary = { id: string; name: string; active: boolean; runs: RunSummary[] };

type RunAllResult = {
  id: string;
  name: string;
  status: "running" | "done" | "failed";
  message?: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reconstructs a template's today-status purely from what's durably stored
 * in the database (SlideshowTemplateRun rows) — this is what makes progress
 * survive navigating away and back, or even showing up for runs a scheduled
 * cron job kicked off with nobody watching.
 */
function summarizeTemplateToday(t: TemplateSummary, today: string): RunAllResult | null {
  const todays = t.runs.filter((r) => r.scheduledFor === today);
  if (todays.length === 0) return null;
  if (todays.some((r) => r.status === "GENERATING")) {
    return { id: t.id, name: t.name, status: "running" };
  }
  if (todays.every((r) => r.status === "POSTED" || r.status === "AWAITING_APPROVAL")) {
    return { id: t.id, name: t.name, status: "done" };
  }
  const failedRun = todays.find((r) => r.status === "FAILED" || r.status === "REJECTED");
  return { id: t.id, name: t.name, status: "failed", message: failedRun?.errorMessage ?? undefined };
}

async function fetchTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch("/api/templates");
  const templates: TemplateSummary[] = await res.json();
  return Array.isArray(templates) ? templates : [];
}

/** Reads a run-now SSE stream to completion and reports whether it errored. */
async function runTemplateAndSummarize(templateId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/templates/${templateId}/run-now`, { method: "POST" });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, message: body.error || "Run failed" };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawError: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });
      if (done) break;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "error") sawError = event.message;
        } catch {
          // ignore malformed line
        }
      }
    }

    return sawError ? { ok: false, message: sawError } : { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Run failed" };
  }
}

export default function MasterGenerationControls() {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);
  const [stopResult, setStopResult] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  const [runningAll, setRunningAll] = useState(false);
  const [runAllResults, setRunAllResults] = useState<RunAllResult[]>([]);
  const [runAllError, setRunAllError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reconcile = useCallback(async () => {
    try {
      const templates = await fetchTemplates();
      const today = todayIso();
      const results = templates
        .filter((t) => t.active)
        .map((t) => summarizeTemplateToday(t, today))
        .filter((r): r is RunAllResult => r !== null);
      setRunAllResults(results);
    } catch {
      // best-effort reconciliation — leave whatever's currently displayed alone
    }
  }, []);

  // Reconstruct today's run status from the server on every mount, so
  // navigating away and back (or a scheduled run nobody was watching)
  // still shows real progress instead of a blank slate.
  useEffect(() => {
    reconcile();
  }, [reconcile]);

  // While anything is still generating, keep polling so this stays live even
  // if a different tab (or no tab) triggered the run.
  useEffect(() => {
    const hasRunning = runAllResults.some((r) => r.status === "running");
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(reconcile, 5000);
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [runAllResults, reconcile]);

  async function handleStopAll() {
    if (!confirm("Stop and clear every slide currently generating, across all slideshows? They'll reset to draft so you can regenerate fresh ones.")) {
      return;
    }
    setStopping(true);
    setStopError(null);
    setStopResult(null);
    try {
      const res = await fetch("/api/slideshows/cancel-all-generation", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to stop generations");
      setStopResult(
        body.slidesReset === 0
          ? "Nothing was generating."
          : `Cleared ${body.slidesReset} slide${body.slidesReset === 1 ? "" : "s"} across ${body.slideshowsReset} slideshow${body.slideshowsReset === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : "Failed to stop generations");
    } finally {
      setStopping(false);
    }
  }

  async function handleRunAllTemplates() {
    setRunningAll(true);
    setRunAllError(null);

    try {
      const templates = await fetchTemplates();
      const active = templates.filter((t) => t.active);

      if (active.length === 0) {
        setRunAllError("No active templates to run.");
        setRunningAll(false);
        return;
      }

      setRunAllResults(active.map((t) => ({ id: t.id, name: t.name, status: "running" })));

      await Promise.all(
        active.map(async (t) => {
          const result = await runTemplateAndSummarize(t.id);
          setRunAllResults((prev) =>
            prev.map((r) => (r.id === t.id ? { ...r, status: result.ok ? "done" : "failed", message: result.message } : r))
          );
        })
      );
      await reconcile();
      router.refresh();
    } catch (err) {
      setRunAllError(err instanceof Error ? err.message : "Failed to run templates");
    } finally {
      setRunningAll(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={handleStopAll} disabled={stopping} className="btn-danger">
        {stopping ? <Loader2 size={15} className="animate-spin" /> : <StopCircle size={15} />}
        Stop All Generations
      </button>
      <button onClick={handleRunAllTemplates} disabled={runningAll} className="btn-secondary">
        {runningAll ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
        Run All Templates
      </button>

      {(stopResult || stopError) && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
            stopError ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-neon/30 bg-neon/10 text-neon"
          }`}
        >
          {stopError ?? stopResult}
          <button onClick={() => { setStopResult(null); setStopError(null); }} className="opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {(runAllResults.length > 0 || runAllError) && (
        <div className="w-full rounded-lg border border-surface-border bg-surface-200 p-3">
          {runAllError && <p className="text-xs text-red-400">{runAllError}</p>}
          {runAllResults.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {runAllResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    {r.status === "running" && <Loader2 size={12} className="animate-spin text-neon" />}
                    {r.status === "done" && <CheckCircle2 size={12} className="text-neon" />}
                    {r.status === "failed" && <XCircle size={12} className="text-red-400" />}
                    {r.name}
                  </span>
                  {r.status === "failed" && r.message && (
                    <span className="truncate text-red-400" title={r.message}>{r.message}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
