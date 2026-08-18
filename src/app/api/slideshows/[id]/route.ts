export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard } from "@/lib/adapters";
import { deleteStoredImages } from "@/lib/blob-storage";

const INCLUDE = {
  slides: true,
  tiktokAccount: true,
  schedules: true,
  posts: true,
} as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const slideshow = await prisma.slideshow.findUnique({ where: { id: params.id }, include: INCLUDE });
  if (!slideshow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toSlideshowCard(slideshow));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.caption === "string") data.caption = body.caption;
  if (typeof body.hashtags === "string") data.hashtags = body.hashtags;
  if (typeof body.status === "string") data.status = body.status;
  if ("tiktokAccountId" in body) data.tiktokAccountId = body.tiktokAccountId || null;
  if ("tiktokMusicId" in body) data.tiktokMusicId = body.tiktokMusicId || null;

  const slideshow = await prisma.slideshow.update({
    where: { id: params.id },
    data,
    include: INCLUDE,
  });

  return NextResponse.json(toSlideshowCard(slideshow));
}

const SLIDE_IMAGE_SELECT = { generatedImagePath: true, processedImagePath: true, finalImagePath: true } as const;

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Deleting a master also cascades (at the DB level, via onDelete: Cascade)
  // to any "Post to Accounts" clones pointing at it via sourceSlideshowId —
  // fetch those clones' slides too so their images get cleaned up as well,
  // not just the master's own.
  const slideshow = await prisma.slideshow.findUnique({
    where: { id: params.id },
    include: {
      slides: { select: SLIDE_IMAGE_SELECT },
      runs: { include: { slides: { select: SLIDE_IMAGE_SELECT } } },
    },
  });

  // Delete the DB rows first (fast, reversible-ish via backups); then the
  // actual image files. generatedImagePath/processedImagePath/finalImagePath
  // are always slide-exclusive (never shared with another slide/template),
  // so they're safe to delete outright — unlike referenceImagePath, which a
  // template or another slide can legitimately still be pointing at.
  await prisma.slideshow.delete({ where: { id: params.id } });

  if (slideshow) {
    const allSlides = [...slideshow.slides, ...slideshow.runs.flatMap((r) => r.slides)];
    const imagePaths = allSlides.flatMap((s) => [s.generatedImagePath, s.processedImagePath, s.finalImagePath]);
    await deleteStoredImages(imagePaths);
  }

  return NextResponse.json({ ok: true });
}
