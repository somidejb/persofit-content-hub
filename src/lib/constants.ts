export const SLIDESHOW_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "GENERATING",
  "POSTED",
  "FAILED",
] as const;

export type SlideshowStatus = (typeof SLIDESHOW_STATUSES)[number];

export const SCHEDULE_STATUSES = [
  "PENDING",
  "GENERATING",
  "POSTED",
  "FAILED",
] as const;

export type ScheduleStatusT = (typeof SCHEDULE_STATUSES)[number];

export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-zinc-800 text-zinc-300 border-zinc-700" },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  GENERATING: { label: "Generating", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse" },
  POSTED: { label: "Posted", className: "bg-[#00FF87]/10 text-[#00FF87] border-[#00FF87]/30" },
  FAILED: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  PENDING: { label: "Pending", className: "bg-zinc-800 text-zinc-300 border-zinc-700" },
  AWAITING_APPROVAL: { label: "Awaiting Approval", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  REJECTED: { label: "Rejected", className: "bg-zinc-800 text-zinc-500 border-zinc-700" },
};
