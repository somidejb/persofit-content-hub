"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StopCircle, PlayCircle, Loader2, X, CheckCircle2, XCircle, ExternalLink, RefreshCw, Send } from "lucide-react";

type RunSummary = {
  status: string;
  scheduledFor: string;
  errorMessage: string | null;
  slideshowId: string | null;
  slideshowStatus?: string | null;
};
type TemplateSummary = { id: string; name: string; active: boolean; runs: RunSummary[] };

type RunAllResult = {
  id: string;
  name: string;
  status: "running" | "done" | "failed";
  message?: string;
  slideshowId?: string | null;
  doneSlides?: number;
  totalSlides?: number;
  postStatus?: "posting" | "posted" | "post_failed";
  postMessage?: string;
};

type Account = { id: string; name: string; connected: boolean };

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

  // A run can sit at status "GENERATING" for a few extra seconds after every
  // slide is already done, while it wraps up (marks AWAITING_APPROVAL, or
  // finishes auto-posting to TikTok). Treat it as still-generating only if
  // the underlying slideshow itself hasn't finished either — otherwise the
  // panel looks stuck even though the images are visibly complete.
  const isActuallyGenerating = (r: RunSummary) =>
    r.status === "GENERATING" && (r.slideshowStatus == null || r.slideshowStatus === "GENERATING");

  const generatingRun = todays.find(isActuallyGenerating);
  if (generatingRun) {
    return { id: t.id, name: t.name, status: "running", slideshowId: generatingRun.slideshowId };
  }

  const failedRun = todays.find(
    (r) => r.status === "FAILED" || r.status === "REJECTED" || r.slideshowStatus === "FAILED"
  );
  if (failedRun) {
    return {
      id: t.id,
      name: t.name,
      status: "failed",
      message: failedRun.errorMessage ?? undefined,
      slideshowId: failedRun.slideshowId ?? null,
    };
  }

  const latest = todays[0];
  return { id: t.id, name: t.name, status: "done", slideshowId: latest?.slideshowId ?? null };
}

async function fetchTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch("/api/templates");
  const templates: TemplateSummary[] = await res.json();
  return Array.isArray(templates) ? templates : [];
}

/**
 * Reads a run-now SSE stream live, reporting incremental progress (as soon as
 * the slideshow exists, and as each slide finishes) via onUpdate — this is
 * what lets the "View" link appear and the slide count tick up in real time,
 * instead of only after the whole run finishes.
 */
async function runTemplateLive(
  templateId: string,
  onUpdate: (patch: Partial<RunAllResult>) => void
): Promise<{ ok: boolean; message?: string }> {
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
    let doneSlides = 0;

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
          if (event.type === "error") {
            sawError = event.message;
          } else if (event.type === "slideshow_created") {
            const totalSlides = Array.isArray(event.slides) ? event.slides.length : undefined;
            doneSlides = 0;
            onUpdate({ slideshowId: event.slideshowId ?? null, doneSlides, totalSlides });
          } else if (event.type === "slide_done" || event.type === "slide_failed") {
            doneSlides += 1;
            onUpdate({ doneSlides });
          } else if (event.type === "account_complete") {
            if (event.slideshowId) onUpdate({ slideshowId: event.slideshowId });
          }
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
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [postingAll, setPostingAll] = useState(false);
  const [postAllError, setPostAllError] = useState<string | null>(null);

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

      await Promise.all(active.map((t) => runOneTemplate(t.id, t.name)));
      await reconcile();
      router.refresh();
    } catch (err) {
      setRunAllError(err instanceof Error ? err.message : "Failed to run templates");
    } finally {
      setRunningAll(false);
    }
  }

  async function runOneTemplate(id: string, name: string) {
    setRunAllResults((prev) => {
      const exists = prev.some((r) => r.id === id);
      if (exists) {
        return prev.map((r) =>
          r.id === id ? { ...r, status: "running", message: undefined, doneSlides: undefined, totalSlides: undefined } : r
        );
      }
      return [...prev, { id, name, status: "running" }];
    });

    const result = await runTemplateLive(id, (patch) => {
      setRunAllResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    });

    setRunAllResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: result.ok ? "done" : "failed", message: result.message } : r))
    );
  }

  async function handleRetry(id: string, name: string) {
    setRetryingId(id);
    try {
      await runOneTemplate(id, name);
      router.refresh();
    } finally {
      setRetryingId(null);
    }
  }

  // Slideshows generated in this batch that are ready to be posted (finished
  // generating, not currently mid-post already).
  const readyToPost = runAllResults.filter(
    (r) => r.status === "done" && r.slideshowId && r.postStatus !== "posting"
  );

  async function handleOpenPostAll() {
    setPostAllError(null);
    if (!accountsLoaded) {
      try {
        const res = await fetch("/api/accounts");
        const body = await res.json();
        setAccounts(Array.isArray(body) ? body : []);
        setAccountsLoaded(true);
      } catch {
        setPostAllError("Failed to load TikTok accounts");
        return;
      }
    }
    setPickerOpen(true);
  }

  async function handleConfirmPostAll() {
    if (!selectedAccountId) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    const targets = readyToPost;
    if (targets.length === 0) {
      setPickerOpen(false);
      return;
    }
    if (
      !confirm(
        `Post ${targets.length} generated slideshow${targets.length === 1 ? "" : "s"} to "${account?.name ?? "this account"}", one after another?`
      )
    ) {
      return;
    }

    setPickerOpen(false);
    setPostingAll(true);
    setPostAllError(null);

    for (const target of targets) {
      const slideshowId = target.slideshowId as string;
      setRunAllResults((prev) =>
        prev.map((r) => (r.id === target.id ? { ...r, postStatus: "posting", postMessage: undefined } : r))
      );
      try {
        const patchRes = await fetch(`/api/slideshows/${slideshowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tiktokAccountId: selectedAccountId }),
        });
        if (!patchRes.ok) {
          const body = await patchRes.json().catch(() => ({}));
          throw new Error(body.error || "Failed to assign TikTok account");
        }

        const postRes = await fetch(`/api/slideshows/${slideshowId}/post`, { method: "POST" });
        const postBody = await postRes.json().catch(() => ({}));
        if (!postRes.ok) throw new Error(postBody.error || "Failed to post to TikTok");

        setRunAllResults((prev) =>
          prev.map((r) => (r.id === target.id ? { ...r, postStatus: "posted", postMessage: undefined } : r))
        );
      } catch (err) {
        setRunAllResults((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? { ...r, postStatus: "post_failed", postMessage: err instanceof Error ? err.message : "Failed to post" }
              : r
          )
        );
      }
    }

    setPostingAll(false);
    router.refresh();
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
      {readyToPost.length > 0 && (
        <button onClick={handleOpenPostAll} disabled={postingAll} className="btn-secondary">
          {postingAll ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {postingAll ? "Posting…" : `Post All to Account (${readyToPost.length})`}
        </button>
      )}

      {postAllError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {postAllError}
          <button onClick={() => setPostAllError(null)} className="opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

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
            <div className="flex flex-col gap-2">
              {runAllResults.map((r) => (
                <div key={r.id} className="flex flex-col gap-1 border-b border-surface-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      {r.status === "running" && <Loader2 size={12} className="animate-spin text-neon" />}
                      {r.status === "done" && <CheckCircle2 size={12} className="text-neon" />}
                      {r.status === "failed" && <XCircle size={12} className="text-red-400" />}
                      {r.name}
                      {r.status === "running" && (
                        <span className="text-zinc-500">
                          {typeof r.totalSlides === "number"
                            ? `— ${r.doneSlides ?? 0}/${r.totalSlides} slides`
                            : "— planning…"}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.slideshowId && (
                        <Link
                          href={`/slideshows/${r.slideshowId}`}
                          className={`flex items-center gap-1 transition ${
                            r.status === "running" ? "text-neon hover:text-neon/80" : "text-zinc-500 hover:text-neon"
                          }`}
                        >
                          {r.status === "running" ? "Watch live" : "View"} <ExternalLink size={11} />
                        </Link>
                      )}
                      {r.status === "failed" && (
                        <button
                          onClick={() => handleRetry(r.id, r.name)}
                          disabled={retryingId === r.id}
                          className="flex items-center gap-1 text-zinc-500 hover:text-neon disabled:opacity-40 transition"
                        >
                          {retryingId === r.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          Retry
                        </button>
                      )}
                      {r.postStatus === "posting" && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Loader2 size={11} className="animate-spin" /> Posting…
                        </span>
                      )}
                      {r.postStatus === "posted" && (
                        <span className="flex items-center gap-1 text-neon">
                          <Send size={11} /> Posted
                        </span>
                      )}
                      {r.postStatus === "post_failed" && (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle size={11} /> Post failed
                        </span>
                      )}
                    </div>
                  </div>
                  {r.status === "failed" && r.message && (
                    <p className="text-[11px] text-red-400/90">{r.message}</p>
                  )}
                  {r.postStatus === "post_failed" && r.postMessage && (
                    <p className="text-[11px] text-red-400/90">{r.postMessage}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-surface-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="text-base font-semibold text-white">Post All to Account</h2>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-surface-200 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs text-zinc-400">
                Posts {readyToPost.length} generated slideshow{readyToPost.length === 1 ? "" : "s"} to the chosen
                account, one after another. Each slideshow&apos;s assigned account will be updated to match.
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">TikTok Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">— Select an account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.connected ? "" : " (not connected)"}
                    </option>
                  ))}
                </select>
                {accountsLoaded && accounts.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-zinc-500">No TikTok accounts connected yet.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-4">
              <button onClick={() => setPickerOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmPostAll} disabled={!selectedAccountId} className="btn-primary">
                <Send size={14} /> Post All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
