export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/slideshows/cancel-all-generation
 *
 * Master "Stop All" — resets every slide stuck in "generating" status back
 * to "draft" (and its parent slideshow's status back to "DRAFT"), across
 * every slideshow in the app, not just one. Also marks any template run
 * that was still "GENERATING" as failed/cancelled, since its underlying
 * slides just got reset out from under it.
 *
 * Like the per-slideshow cancel-generation endpoint, this is a best-effort
 * DB cleanup — it doesn't reach into a still-running server process and
 * interrupt it mid-call, it just clears the stuck state so slides are free
 * to be regenerated fresh.
 */
export async function POST() {
  const [slidesReset, slideshowsReset, templateRunsReset] = await Promise.all([
    prisma.slide.updateMany({
      where: { status: "generating" },
      data: { status: "draft", errorMessage: null },
    }),
    prisma.slideshow.updateMany({
      where: { status: "GENERATING" },
      data: { status: "DRAFT" },
    }),
    prisma.slideshowTemplateRun.updateMany({
      where: { status: "GENERATING" },
      data: { status: "FAILED", errorMessage: "Cancelled by Stop All Generations" },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    slidesReset: slidesReset.count,
    slideshowsReset: slideshowsReset.count,
    templateRunsReset: templateRunsReset.count,
  });
}
