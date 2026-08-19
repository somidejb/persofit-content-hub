"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Zap, StopCircle, ExternalLink, AlertTriangle, CalendarClock, MousePointerClick } from "lucide-react";

type ActivityItem = {
  slideshowId: string;
  slideshowName: string;
  slideshowStatus: string;
  doneSlides: number;
  failedSlides: number;
  generatingSlides: number;
  totalSlides: number;
  stalled: boolean;
  source: "template" | "schedule" | "manual";
  templateName: string | null;
  lastActivityAt: string;
};

const ACTIVE_POLL_MS = 4000;
const IDLE_POLL_MS = 15000;

/**
 * App-wide live view of every generation in flight, mounted once in the
 * shell so it's visible on every page. Polls /api/generation-status (the
 * single DB-derived source of truth), so it sees generations no matter what
 * started them — Generate All, a single-slide regenerate, a template run,
 * the scheduler, or Post-to-Accounts. When the set of active work changes,
 * it also refreshes the current route so server-rendered content (dashboard
 * stats, list cards, template cards) stays in sync without a manual reload.
 */
export default function GenerationActivityBar() {
  const router = useRouter();
  const [active, setActive] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const prevKeyRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    // Don't burn requests while the tab is hidden — catch up on return.
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/generation-status");
      if (!res.ok) return;
      const body = await res.json();
      const items: ActivityItem[] = Array.isArray(body.active) ? body.active : [];
      setLoaded(true);

      // Refresh server-rendered content when the activity picture changes
      // (something started, finished, failed, or progressed) so every page's
      // cards/stats reflect the latest state without a manual reload. When
      // nothing changed, skip the state update too — no pointless re-renders.
      const key = items
        .map((i) => `${i.slideshowId}:${i.doneSlides}/${i.totalSlides}:${i.generatingSlides}:${i.stalled}`)
        .join("|");
      if (prevKeyRef.current !== key) {
        const hadActivity = prevKeyRef.current !== "";
        prevKeyRef.current = key;
        setActive(items);
        if (hadActivity || items.length > 0) router.refresh();
      }
    } catch {
      // transient network hiccup — next tick retries
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const schedule = (ms: number) => {
      if (cancelled) return;
      timerRef.current = setTimeout(async () => {
        await poll();
        schedule(activeRef.current.length > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS);
      }, ms);
    };
    poll();
    schedule(ACTIVE_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Keep the polling loop's cadence decision in sync with latest state
  // without re-creating the loop on every poll result.
  const activeRef = useRef<ActivityItem[]>([]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function handleStop(item: ActivityItem) {
    if (
      !confirm(
        `Stop generating "${item.slideshowName}"? The slide currently in progress finishes (it's already paid for); all remaining slides are skipped.`
      )
    ) {
      return;
    }
    setStoppingId(item.slideshowId);
    try {
      await fetch(`/api/slideshows/${item.slideshowId}/cancel-generation`, { method: "POST" });
      await poll();
      router.refresh();
    } finally {
      setStoppingId(null);
    }
  }

  if (!loaded || active.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-neon/25 bg-neon/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neon">
        <Zap size={13} />
        {active.length === 1 ? "1 slideshow generating" : `${active.length} slideshows generating`}
        <span className="font-normal text-zinc-500">— live across the whole app</span>
      </div>
      <div className="flex flex-col gap-2">
        {active.map((item) => {
          const pct = item.totalSlides > 0 ? Math.round((item.doneSlides / item.totalSlides) * 100) : 0;
          return (
            <div key={item.slideshowId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-zinc-300">
                  {item.stalled ? (
                    <AlertTriangle size={12} className="shrink-0 text-yellow-400" />
                  ) : (
                    <Loader2 size={12} className="shrink-0 animate-spin text-neon" />
                  )}
                  <span className="truncate">{item.slideshowName}</span>
                  <span className="shrink-0 text-zinc-500">
                    {item.doneSlides}/{item.totalSlides} slides
                    {item.failedSlides > 0 && <span className="text-red-400"> · {item.failedSlides} failed</span>}
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 text-[10px] text-zinc-600 sm:flex">
                    {item.source === "template" ? (
                      <>
                        <Zap size={9} /> {item.templateName}
                      </>
                    ) : item.source === "schedule" ? (
                      <>
                        <CalendarClock size={9} /> Scheduled
                      </>
                    ) : (
                      <>
                        <MousePointerClick size={9} /> Manual
                      </>
                    )}
                  </span>
                  {item.stalled && (
                    <span className="shrink-0 text-[10px] text-yellow-400">
                      stalled — no activity for 10+ min, safe to stop
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <Link
                    href={`/slideshows/${item.slideshowId}`}
                    className="flex items-center gap-1 text-neon transition hover:text-neon/80"
                  >
                    Watch <ExternalLink size={10} />
                  </Link>
                  <button
                    onClick={() => handleStop(item)}
                    disabled={stoppingId === item.slideshowId}
                    className="flex items-center gap-1 text-zinc-500 transition hover:text-red-400 disabled:opacity-40"
                  >
                    {stoppingId === item.slideshowId ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <StopCircle size={10} />
                    )}
                    Stop
                  </button>
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-300">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${item.stalled ? "bg-yellow-400/60" : "bg-neon"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
