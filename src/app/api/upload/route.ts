export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file too large (10MB max)" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".jpg";
  const filename = `reference/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Use Vercel Blob in production; fall back to local disk in dev
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, buffer, { access: "public", contentType: file.type });
    return NextResponse.json({ path: blob.url }, { status: 201 });
  }

  // Local dev fallback
  const { writeFile } = await import("fs/promises");
  const destPath = path.join(process.cwd(), "public", "uploads", filename);
  await writeFile(destPath, buffer);
  return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
}
