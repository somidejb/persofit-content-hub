export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/slideshows/[id]/slides/[slideId]/cancel
 *
 * Resets exactly ONE slide stuck in "generating" back to draft. Used by the
 * per-slide Stop button — unlike the slideshow-level cancel-generation
 * endpoint, this never touches sibling slides or the slideshow's own status,
 * so stopping one slide can't wipe out other generations in progress.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; slideId: string } }
) {
  const reset = await prisma.slide.updateMany({
    where: { id: params.slideId, slideshowId: params.id, status: "generating" },
    data: { status: "draft", errorMessage: null },
  });

  return NextResponse.json({ ok: true, reset: reset.count > 0 });
}
