export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;

  const run = await prisma.slideshowTemplateRun.findUnique({ where: { id: runId } });
  if (!run || run.templateId !== id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: `Run is not awaiting approval (status: ${run.status})` }, { status: 400 });
  }

  // Delete generated images and the slideshow if linked
  if (run.slideshowId) {
    const slideshow = await prisma.slideshow.findUnique({
      where: { id: run.slideshowId },
      include: { slides: true },
    });

    if (slideshow) {
      // Delete generated image files from disk
      const imagePaths = slideshow.slides.flatMap((s) =>
        [s.generatedImagePath, s.processedImagePath, s.finalImagePath].filter(Boolean) as string[]
      );

      await Promise.allSettled(
        imagePaths.map((p) =>
          unlink(path.join(process.cwd(), "public", p.replace(/^\//, ""))).catch(() => undefined)
        )
      );

      // Cascade-delete slideshow (slides deleted via onDelete: Cascade in schema)
      await prisma.slideshow.delete({ where: { id: run.slideshowId } });
    }
  }

  await prisma.slideshowTemplateRun.update({
    where: { id: runId },
    data: { status: "REJECTED", slideshowId: null },
  });

  return NextResponse.json({ ok: true });
}
