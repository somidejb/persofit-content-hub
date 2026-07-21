import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/slideshows/[id]/reorder
 * Body: { orderedIds: string[] }  — full ordered array of slide IDs
 * Updates the `order` field of every slide to match the supplied order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { orderedIds } = await req.json();

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
  }

  // Verify all slides belong to this slideshow before updating
  const slides = await prisma.slide.findMany({
    where: { slideshowId: id },
    select: { id: true },
  });
  const ownedIds = new Set(slides.map((s) => s.id));
  const allOwned = orderedIds.every((sid: string) => ownedIds.has(sid));
  if (!allOwned) {
    return NextResponse.json({ error: "Some slide IDs do not belong to this slideshow" }, { status: 403 });
  }

  await prisma.$transaction(
    orderedIds.map((slideId: string, index: number) =>
      prisma.slide.update({
        where: { id: slideId },
        data: { order: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
