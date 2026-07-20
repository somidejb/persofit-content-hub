"use client";

import { useState } from "react";
import SlideshowCard from "@/components/slideshow/SlideshowCard";
import { STATUS_STYLES } from "@/lib/constants";
import type { MockSlideshow } from "@/lib/types";

const FILTERS = ["ALL", "DRAFT", "SCHEDULED", "GENERATING", "POSTED", "FAILED"] as const;

export default function SlideshowGrid({ slideshows }: { slideshows: MockSlideshow[] }) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("ALL");

  const filtered = filter === "ALL" ? slideshows : slideshows.filter((s) => s.status === filter);

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

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-zinc-400">No slideshows in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SlideshowCard key={s.id} slideshow={s} />
          ))}
        </div>
      )}
    </div>
  );
}
