"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Zap, Clock, Calendar, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type RunSummary = {
  id: string;
  status: string;
  scheduledFor: string;
  createdAt: string;
  slideshowId: string | null;
  errorMessage: string | null;
};

type TemplateSummary = {
  id: string;
  name: string;
  concept: string;
  postTime: string;
  scheduleDays: string;
  autoPost: boolean;
  active: boolean;
  slideCount: number;
  createdAt: string;
  tiktokAccount: { id: string; name: string } | null;
  runs: RunSummary[];
};

const RUN_STATUS_STYLES: Record<string, string> = {
  GENERATING: "text-yellow-400 animate-pulse",
  AWAITING_APPROVAL: "text-blue-400",
  POSTED: "text-[#00FF87]",
  FAILED: "text-red-400",
  REJECTED: "text-zinc-500",
};

function pendingApprovals(templates: TemplateSummary[]) {
  return templates.reduce(
    (sum, t) => sum + t.runs.filter((r) => r.status === "AWAITING_APPROVAL").length,
    0
  );
}

export default function TemplatesClient({ templates: initial }: { templates: TemplateSummary[] }) {
  const [templates, setTemplates] = useState(initial);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template and all its run history?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleToggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active: updated.active } : t)));
    }
  }

  const approvalCount = pendingApprovals(templates);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Templates
            {approvalCount > 0 && (
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/30">
                {approvalCount} awaiting approval
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Auto-generate and post slideshows on a recurring schedule.
          </p>
        </div>
        <Link href="/templates/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border py-16 text-center">
          <Zap size={32} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-400">No templates yet</p>
          <p className="mt-1 text-xs text-zinc-600">
            Create a template to auto-generate slideshows on a schedule.
          </p>
          <Link href="/templates/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={14} />
            New Template
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const pendingRuns = t.runs.filter((r) => r.status === "AWAITING_APPROVAL");
            const lastRun = t.runs[0];
            let days: string[] = [];
            try { days = JSON.parse(t.scheduleDays); } catch { days = []; }

            return (
              <div
                key={t.id}
                className="rounded-xl border border-surface-border bg-surface p-5 hover:border-zinc-600 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/templates/${t.id}`}
                        className="font-semibold text-white hover:text-neon transition truncate"
                      >
                        {t.name}
                      </Link>
                      {!t.active && (
                        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-500">
                          Paused
                        </span>
                      )}
                      {t.autoPost ? (
                        <span className="rounded-full bg-neon/10 border border-neon/20 px-2 py-0.5 text-[11px] text-neon">
                          Auto-post
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] text-blue-400">
                          Approval required
                        </span>
                      )}
                      {pendingRuns.length > 0 && (
                        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[11px] text-blue-300 font-medium">
                          {pendingRuns.length} pending
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-xs text-zinc-500 line-clamp-1">{t.concept}</p>

                    <div className="mt-2.5 flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {t.postTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {days.length === 7 ? "Daily" : days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}
                      </span>
                      <span>{t.slideCount} slides</span>
                      {t.tiktokAccount && <span>@{t.tiktokAccount.name}</span>}
                    </div>

                    {lastRun && (
                      <div className="mt-2 text-xs text-zinc-600">
                        Last run:{" "}
                        <span className={RUN_STATUS_STYLES[lastRun.status] ?? "text-zinc-400"}>
                          {lastRun.status.replace("_", " ")}
                        </span>{" "}
                        on {lastRun.scheduledFor}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(t.id, t.active)}
                      className="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-surface-200 transition"
                      title={t.active ? "Pause template" : "Activate template"}
                    >
                      {t.active ? <ToggleRight size={18} className="text-neon" /> : <ToggleLeft size={18} />}
                    </button>
                    <Link
                      href={`/templates/${t.id}`}
                      className="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-surface-200 transition"
                    >
                      <ChevronRight size={18} />
                    </Link>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg p-2 text-zinc-500 hover:text-red-400 hover:bg-surface-200 transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
