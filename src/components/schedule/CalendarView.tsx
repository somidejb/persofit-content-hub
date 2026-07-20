"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { MockScheduleEntry } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarView({ entries }: { entries: MockScheduleEntry[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MockScheduleEntry[]>();
    for (const e of entries) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [entries]);

  const { year, month } = cursor;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setSelectedDate(null);
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card p-4 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{monthLabel}</h2>
          <div className="flex gap-1">
            <button onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-surface-200 hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-surface-200 hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />;
            const key = toKey(year, month, day);
            const dayEntries = entriesByDate.get(key) ?? [];
            const isSelected = selectedDate === key;
            const isToday = key === toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(dayEntries.length ? key : null)}
                className={`flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition ${
                  isSelected
                    ? "border-neon/50 bg-neon/10"
                    : dayEntries.length
                    ? "border-surface-border bg-surface-200 hover:border-neon/30"
                    : "border-transparent hover:bg-surface-200/50"
                }`}
              >
                <span className={`text-xs ${isToday ? "font-bold text-neon" : "text-zinc-400"}`}>{day}</span>
                {dayEntries.slice(0, 2).map((e) => (
                  <span key={e.id} className="w-full truncate rounded bg-surface-300 px-1 text-[10px] text-zinc-300">
                    {e.time} · {e.slideshowName}
                  </span>
                ))}
                {dayEntries.length > 2 && (
                  <span className="text-[10px] text-zinc-500">+{dayEntries.length - 2} more</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "Select a date"}
        </h2>
        {selectedDate === null ? (
          <p className="text-xs text-zinc-500">Click a highlighted day to see scheduled posts.</p>
        ) : selectedEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing scheduled for this day.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedEntries.map((e) => (
              <div key={e.id} className="rounded-lg border border-surface-border bg-surface-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{e.time}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-xs text-zinc-300">{e.slideshowName}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{e.accountName}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
