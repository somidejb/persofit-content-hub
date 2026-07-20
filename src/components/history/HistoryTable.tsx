"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { MockHistoryEntry } from "@/lib/types";

const FILTERS = ["ALL", "posted", "failed"] as const;

export default function HistoryTable({ history }: { history: MockHistoryEntry[] }) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("ALL");
  const filtered = filter === "ALL" ? history : history.filter((h) => h.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f
                ? "border-neon/50 bg-neon/10 text-neon"
                : "border-surface-border bg-surface-200 text-zinc-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">Slideshow</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Posted At</th>
              <th className="px-4 py-3 font-medium">Slides</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr key={h.id} className="border-b border-surface-border last:border-0 hover:bg-surface-200/50">
                <td className="px-4 py-3 text-zinc-200">{h.slideshowName}</td>
                <td className="px-4 py-3 text-zinc-400">{h.accountName}</td>
                <td className="px-4 py-3 text-zinc-400">{new Date(h.postedAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-zinc-400">{h.slideCount}</td>
                <td className="px-4 py-3">
                  {h.status === "posted" ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-neon">
                      <CheckCircle2 size={14} /> Posted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-red-400" title={h.errorMessage}>
                      <XCircle size={14} /> Failed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-xs text-zinc-500">No history entries found.</p>
        )}
      </div>
    </div>
  );
}
