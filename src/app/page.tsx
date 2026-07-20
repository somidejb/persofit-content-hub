import Link from "next/link";
import { Images, CalendarClock, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import SlideshowCard from "@/components/slideshow/SlideshowCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard, toHistoryEntry, toScheduleEntries } from "@/lib/adapters";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [slideshowRows, historyRows, scheduleRows] = await Promise.all([
    prisma.slideshow.findMany({
      include: { slides: true, tiktokAccount: true, schedules: true, posts: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.postHistory.findMany({
      include: { slideshow: true, tiktokAccount: true },
      orderBy: { postedAt: "desc" },
      take: 4,
    }),
    prisma.schedule.findMany({
      where: { status: { in: ["PENDING", "GENERATING"] } },
      include: { slideshow: { include: { tiktokAccount: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const slideshows = slideshowRows.map(toSlideshowCard);
  const history = historyRows.map(toHistoryEntry);
  const today = new Date().toISOString().slice(0, 10);
  const schedule = scheduleRows
    .flatMap(toScheduleEntries)
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 4);

  const total = slideshows.length;
  const scheduled = slideshows.filter((s) => s.status === "SCHEDULED" || s.status === "GENERATING").length;
  const posted = slideshows.filter((s) => s.status === "POSTED").length;
  const failed = slideshows.filter((s) => s.status === "FAILED").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Slideshows" value={total} icon={Images} />
        <StatCard label="Scheduled / Active" value={scheduled} icon={CalendarClock} accent />
        <StatCard label="Posted" value={posted} icon={CheckCircle2} />
        <StatCard label="Failed" value={failed} icon={XCircle} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Your Slideshows</h2>
            <Link href="/slideshows" className="flex items-center gap-1 text-xs font-medium text-neon hover:underline">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          {slideshows.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-zinc-400">No slideshows yet.</p>
              <Link href="/slideshows/new" className="btn-primary mt-2">
                Create your first slideshow
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {slideshows.slice(0, 4).map((s) => (
                <SlideshowCard key={s.id} slideshow={s} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Upcoming Posts</h2>
              <Link href="/schedule" className="text-xs font-medium text-neon hover:underline">
                Calendar
              </Link>
            </div>
            {schedule.length === 0 ? (
              <p className="text-xs text-zinc-500">Nothing scheduled yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {schedule.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 border-b border-surface-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{entry.slideshowName}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {entry.time} · {entry.accountName}
                      </p>
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent History</h2>
              <Link href="/history" className="text-xs font-medium text-neon hover:underline">
                Full log
              </Link>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-500">Nothing posted yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 border-b border-surface-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{entry.slideshowName}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {new Date(entry.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {entry.accountName}
                      </p>
                    </div>
                    {entry.status === "posted" ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-neon">
                        <CheckCircle2 size={13} /> Posted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-red-400">
                        <XCircle size={13} /> Failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
