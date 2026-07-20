export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
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
    const absPath = path.join(process.cwd(), "public", imgPath.replace(/^\//, ""));

    try {
      const buffer = await readFile(absPath);
      // Pad number: slide_01.jpg, slide_02.jpg, …
      const filename = `slide_${String(i + 1).padStart(2, "0")}.jpg`;
      zip.file(filename, buffer);
    } catch {
      // Skip missing files — generation may have partially failed
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Sanitise name for Content-Disposition
  const safeName = slideshow.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}_slides.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
