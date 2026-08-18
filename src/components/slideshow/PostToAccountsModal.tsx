"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { MockAccount } from "@/lib/types";

type AccountProgress = {
  accountId: string;
  accountName: string;
  status: "pending" | "running" | "posted" | "failed";
  doneSlides: number;
  totalSlides: number | null;
  slideshowId: string | null;
  error: string | null;
};

export default function PostToAccountsModal({
  slideshowId,
  legacyAccountId,
  initialTargetAccountIds,
  onClose,
  onComplete,
}: {
  slideshowId: string;
  legacyAccountId: string | null;
  initialTargetAccountIds: string[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [accounts, setAccounts] = useState<MockAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"select" | "running" | "done">("select");
  const [progress, setProgress] = useState<AccountProgress[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data: MockAccount[]) => {
        setAccounts(Array.isArray(data) ? data : []);
        const preselect = initialTargetAccountIds.length > 0
          ? initialTargetAccountIds
          : legacyAccountId
          ? [legacyAccountId]
          : [];
        setSelected(new Set(preselect));
      })
      .catch(() => setLoadError("Failed to load accounts"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(accountId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  async function handleStart() {
    const accountIds = Array.from(selected);
    if (accountIds.length === 0) return;

    setPhase("running");
    setRunError(null);
    setProgress(
      accountIds.map((id) => ({
        accountId: id,
        accountName: accounts?.find((a) => a.id === id)?.name ?? id,
        status: "pending",
        doneSlides: 0,
        totalSlides: null,
        slideshowId: null,
        error: null,
      }))
    );

    try {
      const res = await fetch(`/api/slideshows/${slideshowId}/post-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to start");
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
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          const accountId = data.accountId as string | undefined;

          if (data.type === "account_start") {
            setProgress((prev) =>
              prev.map((p) => (p.accountId === accountId ? { ...p, status: "running" } : p))
            );
          } else if (data.type === "slide_start" || data.type === "slide_done" || data.type === "slide_failed") {
            setProgress((prev) =>
              prev.map((p) => {
                if (p.accountId !== accountId) return p;
                if (data.type === "slide_done") return { ...p, doneSlides: p.doneSlides + 1 };
                return p;
              })
            );
          } else if (data.type === "account_posted") {
            setProgress((prev) =>
              prev.map((p) =>
                p.accountId === accountId
                  ? { ...p, status: "posted", slideshowId: data.slideshowId as string }
                  : p
              )
            );
          } else if (data.type === "account_failed") {
            setProgress((prev) =>
              prev.map((p) =>
                p.accountId === accountId
                  ? {
                      ...p,
                      status: "failed",
                      slideshowId: (data.slideshowId as string | null) ?? null,
                      error: data.message as string,
                    }
                  : p
              )
            );
          } else if (data.type === "complete") {
            setPhase("done");
            onComplete();
          } else if (data.type === "error") {
            setRunError(data.message as string);
            setPhase("done");
          }
        }
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to post");
      setPhase("done");
    }
  }

  const connectedAccounts = accounts?.filter((a) => a.connected) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h2 className="text-base font-semibold text-white">Post to Accounts</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-surface-200 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {phase === "select" && (
            <>
              <p className="text-xs text-zinc-500">
                Pick which accounts to post to. Each account gets its own fresh generation — slides
                are generated independently per account, not copied.
              </p>
              {loadError && <p className="text-xs text-red-400">{loadError}</p>}
              {!accounts ? (
                <p className="text-xs text-zinc-500">Loading accounts…</p>
              ) : connectedAccounts.length === 0 ? (
                <p className="text-xs text-zinc-500">No connected TikTok accounts yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {connectedAccounts.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-200 px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-neon"
                      />
                      <span className="text-sm text-zinc-200">{a.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

          {phase !== "select" && (
            <div className="space-y-2">
              {runError && (
                <p className="text-xs text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                  {runError}
                </p>
              )}
              {progress.map((p) => (
                <div
                  key={p.accountId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-200 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.status === "pending" && <div className="h-3 w-3 rounded-full border border-zinc-600 shrink-0" />}
                    {p.status === "running" && <Loader2 size={14} className="animate-spin text-neon shrink-0" />}
                    {p.status === "posted" && <CheckCircle2 size={14} className="text-neon shrink-0" />}
                    {p.status === "failed" && <XCircle size={14} className="text-red-400 shrink-0" />}
                    <span className="text-sm text-zinc-200 truncate">{p.accountName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    {p.status === "running" && <span className="text-zinc-500">{p.doneSlides} slides done</span>}
                    {p.status === "failed" && <span className="text-red-400 truncate max-w-[160px]">{p.error}</span>}
                    {p.status === "posted" && p.slideshowId && (
                      <Link
                        href={`/slideshows/${p.slideshowId}`}
                        className="flex items-center gap-1 text-neon hover:underline"
                      >
                        View <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-4">
          <button onClick={onClose} className="btn-secondary">
            {phase === "done" ? "Close" : "Cancel"}
          </button>
          {phase === "select" && (
            <button onClick={handleStart} disabled={selected.size === 0} className="btn-primary">
              Post to {selected.size || ""} Account{selected.size === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
