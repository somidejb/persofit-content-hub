import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard, toHistoryEntry, toScheduleEntries } from "@/lib/adapters";
import SlideshowDetailClient from "@/components/slideshow/SlideshowDetailClient";

export const dynamic = "force-dynamic";

export default async function SlideshowDetailPage({ params }: { params: { id: string } }) {
  const [row, accounts] = await Promise.all([
    prisma.slideshow.findUnique({
      where: { id: params.id },
      include: { slides: true, tiktokAccount: true, schedules: true, posts: true },
    }),
    prisma.tiktokAccount.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!row) notFound();

  const slideshow = toSlideshowCard(row);
  const history = row.posts
    .map((p) => toHistoryEntry({ ...p, slideshow: row, tiktokAccount: row.tiktokAccount }))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const schedule = row.schedules
    .flatMap((s) => toScheduleEntries({ ...s, slideshow: row }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <SlideshowDetailClient
      slideshow={slideshow}
      schedule={schedule}
      history={history}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
