import SlideshowGrid from "@/components/slideshow/SlideshowGrid";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard } from "@/lib/adapters";
import type { SlideshowRunInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SlideshowsPage() {
  const [rows, templateRuns] = await Promise.all([
    prisma.slideshow.findMany({
      where: { sourceSlideshowId: null },
      include: { slides: true, tiktokAccount: true, schedules: true, posts: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.slideshowTemplateRun.findMany({
      where: { slideshowId: { not: null } },
      select: {
        slideshowId: true,
        scheduledFor: true,
        template: { select: { id: true, name: true } },
      },
    }),
  ]);

  const runInfoBySlideshowId: Record<string, SlideshowRunInfo> = {};
  for (const run of templateRuns) {
    if (!run.slideshowId) continue;
    runInfoBySlideshowId[run.slideshowId] = {
      templateId: run.template.id,
      templateName: run.template.name,
      scheduledFor: run.scheduledFor,
    };
  }

  return <SlideshowGrid slideshows={rows.map(toSlideshowCard)} runInfoBySlideshowId={runInfoBySlideshowId} />;
}
