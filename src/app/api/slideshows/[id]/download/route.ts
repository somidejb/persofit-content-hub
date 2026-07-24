export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/slideshows/[id]/download
 *
 * Zips all finalImagePaths for the slideshow and streams the archive.
 * Images may be Vercel Blob URLs (production) or local /uploads paths (dev).
 * We fetch Blob URLs over HTTP; local paths are read from disk.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const slideshow = await prisma.slideshow.findUnique({
    where: { id },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!slideshow) {
    return NextResponse.json({ error: "Slideshow not found" }, { status: 404 });
  }

  const slidesWithImages = slideshow.slides.filter((s) => s.finalImagePath);
  if (slidesWithImages.length === 0) {
    return NextResponse.json(
      { error: "No generated images found — generate the slides first" },
      { status: 400 }
    );
  }

  const zip = new JSZip();

  for (let i = 0; i < slidesWithImages.length; i++) {
    const slide = slidesWithImages[i];
    const imgPath = slide.finalImagePath!;

    try {
      let buffer: Buffer;

      if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
        // Production: image is a remote Vercel Blob URL — fetch it
        const res = await fetch(imgPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        // Dev: local filesystem path under public/
        const { readFile } = await import("fs/promises");
        const path = await import("path");
        const absPath = path.default.join(process.cwd(), "public", imgPath.replace(/^\//, ""));
        buffer = await readFile(absPath);
      }

      const filename = `slide_${String(i + 1).padStart(2, "0")}.jpg`;
      zip.file(filename, buffer);
    } catch {
      // Skip slides whose image can't be fetched; don't abort the whole zip
    }
  }

  if (Object.keys(zip.files).length === 0) {
    return NextResponse.json(
      { error: "Could not fetch any slide images" },
      { status: 500 }
    );
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const safeName = slideshow.name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}_slides.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
