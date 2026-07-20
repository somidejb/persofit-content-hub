export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard } from "@/lib/adapters";

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

  const slideshow = await prisma.slideshow.update({
    where: { id: params.id },
    data,
    include: INCLUDE,
  });

  return NextResponse.json(toSlideshowCard(slideshow));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.slideshow.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
