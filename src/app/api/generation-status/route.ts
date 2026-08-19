export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STALLED_AFTER_MS = 10 * 60 * 1000;

export type GenerationActivityItem = {
  slideshowId: string;
  slideshowName: string;
  slideshowStatus: string;
  doneSlides: number;
  failedSlides: number;
  generatingSlides: number;
  totalSlides: number;
  /** Nothing has written to this slideshow's rows in 10+ minutes — the driving process likely died. */
  stalled: boolean;
  /** What kicked this generation off, for diagnosis: a template run, a schedule, or a manual click. */
  source: "template" | "schedule" | "manual";
  templateName: string | null;
  lastActivityAt: string;
};

/**
 * GET /api/generation-status
 *
 * The single source of truth for "what is generating right now, anywhere in
 * the app". Derived entirely from the database, so it sees every entry point
 * the same way: Generate All, a single-slide regenerate, a template run, the
 * cron scheduler, and Post-to-Accounts clones. Every page polls this one
 * endpoint instead of keeping its own partial picture.
 */
export async function GET() {
  // Two ways a slideshow counts as "active": its own status claim says
  // GENERATING (generate-all runs), or at least one of its slides is
  // individually "generating" (single-slide regens never flip the parent).
  const [generatingSlides, claimedSlideshows] = await Promise.all([
    prisma.slide.findMany({
      where: { status: "generating" },
      select: { slideshowId: true },
    }),
    prisma.slideshow.findMany({
      where: { status: "GENERATING" },
      select: { id: true },
    }),
  ]);

  const activeIds = Array.from(
    new Set([...generatingSlides.map((s) => s.slideshowId), ...claimedSlideshows.map((s) => s.id)])
  );

  if (activeIds.length === 0) {
    return NextResponse.json({ active: [], timestamp: new Date().toISOString() });
  }

  const [slideshows, templateRuns, schedules] = await Promise.all([
    prisma.slideshow.findMany({
      where: { id: { in: activeIds } },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        slides: { select: { status: true, updatedAt: true } },
      },
    }),
    prisma.slideshowTemplateRun.findMany({
      where: { status: "GENERATING", slideshowId: { in: activeIds } },
      select: { slideshowId: true, template: { select: { name: true } } },
    }),
    prisma.schedule.findMany({
      where: { status: "GENERATING", slideshowId: { in: activeIds } },
      select: { slideshowId: true },
    }),
  ]);

  const templateBySlideshow = new Map(templateRuns.map((r) => [r.slideshowId, r.template.name]));
  const scheduleSlideshowIds = new Set(schedules.map((s) => s.slideshowId));

  const active: GenerationActivityItem[] = slideshows.map((s) => {
    const lastActivityMs = Math.max(
      s.updatedAt.getTime(),
      ...s.slides.map((sl) => sl.updatedAt.getTime())
    );
    const templateName = templateBySlideshow.get(s.id) ?? null;
    return {
      slideshowId: s.id,
      slideshowName: s.name,
      slideshowStatus: s.status,
      doneSlides: s.slides.filter((sl) => sl.status === "done").length,
      failedSlides: s.slides.filter((sl) => sl.status === "failed").length,
      generatingSlides: s.slides.filter((sl) => sl.status === "generating").length,
      totalSlides: s.slides.length,
      stalled: Date.now() - lastActivityMs > STALLED_AFTER_MS,
      source: templateName ? "template" : scheduleSlideshowIds.has(s.id) ? "schedule" : "manual",
      templateName,
      lastActivityAt: new Date(lastActivityMs).toISOString(),
    };
  });

  // Most recently active first, so the busiest thing is at the top.
  active.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  return NextResponse.json({ active, timestamp: new Date().toISOString() });
}
