"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ArrowUpRight } from "lucide-react";
import SlideshowCard from "@/components/slideshow/SlideshowCard";
import { STATUS_STYLES } from "@/lib/constants";
import type { MockSlideshow, SlideshowRunInfo } from "@/lib/types";

const FILTERS = ["ALL", "DRAFT", "SCHEDULED", "GENERATING", "POSTED", "FAILED"] as const;

type Group = {
  key: string;
  label: string;
  href: string | null;
  items: { slideshow: MockSlideshow; runDate?: string }[];
};

function formatRunDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupSlideshows(
  slideshows: MockSlideshow[],
  runInfoBySlideshowId: Record<string, SlideshowRunInfo>
): Group[] {
  const groups = new Map<string, Group>();

  for (const slideshow of slideshows) {
    const info = runInfoBySlideshowId[slideshow.id];
    const key = info ? info.templateId : "manual";

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: info ? info.templateName : "Manual",
        href: info ? `/templates/${info.templateId}` : null,
        items: [],
      });
    }
    groups.get(key)!.items.push({ slideshow, runDate: info?.scheduledFor });
  }

  // slideshows arrive pre-sorted by updatedAt desc, so each group's first
  // item is already its most recently updated one — use that to order groups.
  return Array.from(groups.values()).sort((a, b) =>
    (b.items[0]?.slideshow.updatedAt ?? "").localeCompare(a.items[0]?.slideshow.updatedAt ?? "")
  );
}

export default function SlideshowGrid({
  slideshows,
  runInfoBySlideshowId,
}: {
  slideshows: MockSlideshow[];
  runInfoBySlideshowId: Record<string, SlideshowRunInfo>;
}) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("ALL");

  const filtered = filter === "ALL" ? slideshows : slideshows.filter((s) => s.status === filter);
  const groups = groupSlideshows(filtered, runInfoBySlideshowId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "border-neon/50 bg-neon/10 text-neon"
                : "border-surface-border bg-surface-200 text-zinc-400 hover:text-white"
            }`}
          >
            {f === "ALL" ? "All" : STATUS_STYLES[f]?.label ?? f}
            <span className="ml-1.5 opacity-60">
              {f === "ALL" ? slideshows.length : slideshows.filter((s) => s.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-zinc-400">No slideshows in this category yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="mb-3 flex items-center gap-2">
                {group.href ? (
                  <Link
                    href={group.href}
                    className="flex items-center gap-1.5 text-sm font-semibold text-white transition hover:text-neon"
                  >
                    <Zap size={14} className="text-neon" />
                    {group.label}
                    <ArrowUpRight size={13} />
                  </Link>
                ) : (
                  <h2 className="text-sm font-semibold text-zinc-400">{group.label}</h2>
                )}
                <span className="text-xs text-zinc-600">({group.items.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ slideshow, runDate }) => (
                  <div key={slideshow.id} className="flex flex-col gap-1.5">
                    <SlideshowCard slideshow={slideshow} />
                    {runDate && (
                      <span className="px-1 text-[11px] text-zinc-500">Run {formatRunDate(runDate)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
