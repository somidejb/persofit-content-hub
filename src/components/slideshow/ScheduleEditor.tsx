"use client";

import { useState } from "react";
import { Plus, X, Clock } from "lucide-react";

export default function ScheduleEditor({
  postTime,
  dates,
  onChangeTime,
  onChangeDates,
}: {
  postTime: string;
  dates: string[];
  onChangeTime: (time: string) => void;
  onChangeDates: (dates: string[]) => void;
}) {
  const [newDate, setNewDate] = useState("");

  function addDate() {
    if (!newDate || dates.includes(newDate)) return;
    onChangeDates([...dates, newDate].sort());
    setNewDate("");
  }

  function removeDate(d: string) {
    onChangeDates(dates.filter((x) => x !== d));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label-text mb-1.5 block">Daily post time</label>
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-zinc-500" />
          <input
            type="time"
            value={postTime}
            onChange={(e) => onChangeTime(e.target.value)}
            className="input-field w-40"
          />
        </div>
      </div>

      <div>
        <label className="label-text mb-1.5 block">Post dates</label>
        <div className="mb-2 flex gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field w-44"
          />
          <button type="button" onClick={addDate} className="btn-secondary px-3">
            <Plus size={15} /> Add date
          </button>
        </div>
        {dates.length === 0 ? (
          <p className="text-xs text-zinc-500">No post dates added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-200 px-2.5 py-1 text-xs text-zinc-300"
              >
                {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                <button type="button" onClick={() => removeDate(d)} className="text-zinc-500 hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
