import CalendarView from "@/components/schedule/CalendarView";
import { prisma } from "@/lib/prisma";
import { toScheduleEntries } from "@/lib/adapters";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const rows = await prisma.schedule.findMany({
    include: { slideshow: { include: { tiktokAccount: true } } },
    orderBy: { createdAt: "desc" },
  });

  const entries = rows.flatMap(toScheduleEntries);

  return <CalendarView entries={entries} />;
}
