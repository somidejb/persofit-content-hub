export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/slideshows/[id]/slides/[slideId]/download
 *
 * Fetches the slide's finalImagePath (Blob URL or local path) through the
 * server and streams it back with Content-Disposition: attachment so the
 * browser triggers a file download.
 *
 * The <a download> attribute is silently ignored by browsers for cross-origin
 * URLs (e.g. Vercel Blob on vercel-storage.com), so we route downloads
 * through our own domain instead.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;

  const slide = await prisma.slide.findFirst({
    where: { id: slideId, slideshowId: id },
    select: { finalImagePath: true, order: true },
  });

  if (!slide?.finalImagePath) {
    return NextResponse.json({ error: "Slide image not found" }, { status: 404 });
  }

  const imgPath = slide.finalImagePath;
  let buffer: Buffer;

  try {
    if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
      const res = await fetch(imgPath);
      if (!res.ok) throw new Error(`Upstream ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      const absPath = path.default.join(process.cwd(), "public", imgPath.replace(/^\//, ""));
      buffer = await readFile(absPath);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch image" },
      { status: 502 }
    );
  }

  const filename = `slide_${String(slide.order).padStart(2, "0")}.jpg`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
