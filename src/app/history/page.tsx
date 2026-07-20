import HistoryTable from "@/components/history/HistoryTable";
import { prisma } from "@/lib/prisma";
import { toHistoryEntry } from "@/lib/adapters";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const rows = await prisma.postHistory.findMany({
    include: { slideshow: true, tiktokAccount: true },
    orderBy: { postedAt: "desc" },
  });

  return <HistoryTable history={rows.map(toHistoryEntry)} />;
}
