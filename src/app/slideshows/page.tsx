import SlideshowGrid from "@/components/slideshow/SlideshowGrid";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard } from "@/lib/adapters";

export const dynamic = "force-dynamic";

export default async function SlideshowsPage() {
  const rows = await prisma.slideshow.findMany({
    include: { slides: true, tiktokAccount: true, schedules: true, posts: true },
    orderBy: { updatedAt: "desc" },
  });

  return <SlideshowGrid slideshows={rows.map(toSlideshowCard)} />;
}
