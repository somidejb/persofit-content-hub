export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/slideshows/[id]/cancel-generation
 *
 * Resets every slide that is still in "generating" status back to "draft"
 * and the slideshow itself back to "DRAFT". Called when the user clicks
 * Stop while a generate-all stream is running.
 *
 * The client-side AbortController already closes the SSE stream immediately;
 * this endpoint cleans up the DB so no slide stays stuck in "generating".
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [updatedSlides] = await Promise.all([
    prisma.slide.updateMany({
      where: { slideshowId: id, status: "generating" },
      data: { status: "draft", errorMessage: null },
    }),
    prisma.slideshow.update({
      where: { id },
      data: { status: "DRAFT" },
    }),
  ]);

  return NextResponse.json({ ok: true, resetCount: updatedSlides.count });
}
