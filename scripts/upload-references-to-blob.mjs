/**
 * Uploads all local reference images to Vercel Blob and updates Neon DB paths.
 *
 * Usage (run from project root with dev server stopped):
 *   node scripts/upload-references-to-blob.mjs
 *
 * Requires in .env (or as env vars):
 *   DIRECT_URL   — Neon direct connection string
 *   BLOB_READ_WRITE_TOKEN — from Vercel Storage dashboard
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed in Node 20+)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = await import("fs");
const envPath = path.join(__dirname, "../.env");
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const neonUrl = process.env.DIRECT_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!neonUrl || neonUrl.startsWith("file:")) {
  console.error("❌ DIRECT_URL must be a Neon PostgreSQL connection string in .env");
  process.exit(1);
}
if (!blobToken) {
  console.error("❌ BLOB_READ_WRITE_TOKEN is not set in .env — copy it from Vercel Storage dashboard");
  process.exit(1);
}

// Override env so Prisma uses Neon
process.env.DATABASE_URL = neonUrl;
process.env.DIRECT_URL = neonUrl;

const prisma = new PrismaClient();
const publicDir = path.join(__dirname, "../public");

/** Upload a local path to blob, return the blob URL. Returns null if file not found. */
async function uploadToBlob(localPath) {
  // localPath is like /uploads/reference/filename.jpg
  const absPath = path.join(publicDir, localPath.replace(/^\//, ""));
  let buffer;
  try {
    buffer = await readFile(absPath);
  } catch {
    console.warn(`  ⚠ File not found locally, skipping: ${localPath}`);
    return null;
  }

  const ext = path.extname(localPath).toLowerCase();
  const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  const contentType = mimeMap[ext] ?? "image/jpeg";
  const blobKey = `reference/${path.basename(localPath)}`;

  const blob = await put(blobKey, buffer, { access: "public", contentType, token: blobToken });
  return blob.url;
}

/** Returns true if a path needs uploading (local /uploads/ path, not already a blob URL) */
function isLocalPath(p) {
  return p && !p.startsWith("http://") && !p.startsWith("https://");
}

async function run() {
  console.log("🚀 Uploading reference images to Vercel Blob...\n");

  // Cache to avoid re-uploading the same file
  const urlCache = new Map();
  async function getOrUpload(localPath) {
    if (!localPath || !isLocalPath(localPath)) return null;
    if (urlCache.has(localPath)) return urlCache.get(localPath);
    const url = await uploadToBlob(localPath);
    if (url) {
      urlCache.set(localPath, url);
      console.log(`  ✓ ${path.basename(localPath)} → blob`);
    }
    return url;
  }

  // ── 1. SlideshowTemplateSlide.referenceImagePath + randomImagePool ─────────
  const tSlides = await prisma.slideshowTemplateSlide.findMany();
  let tSlideUpdates = 0;
  for (const ts of tSlides) {
    const updates = {};

    if (isLocalPath(ts.referenceImagePath)) {
      const url = await getOrUpload(ts.referenceImagePath);
      if (url) updates.referenceImagePath = url;
    }

    // randomImagePool is a JSON array of paths
    let pool = [];
    try { pool = JSON.parse(ts.randomImagePool ?? "[]"); } catch { pool = []; }
    if (pool.some(isLocalPath)) {
      const newPool = await Promise.all(pool.map(async (p) => isLocalPath(p) ? (await getOrUpload(p) ?? p) : p));
      updates.randomImagePool = JSON.stringify(newPool);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.slideshowTemplateSlide.update({ where: { id: ts.id }, data: updates });
      tSlideUpdates++;
    }
  }
  console.log(`\n✓ Updated ${tSlideUpdates}/${tSlides.length} template slides`);

  // ── 2. SlideshowTemplate.referenceImagePath ────────────────────────────────
  const templates = await prisma.slideshowTemplate.findMany();
  let templateUpdates = 0;
  for (const t of templates) {
    if (isLocalPath(t.referenceImagePath)) {
      const url = await getOrUpload(t.referenceImagePath);
      if (url) {
        await prisma.slideshowTemplate.update({ where: { id: t.id }, data: { referenceImagePath: url } });
        templateUpdates++;
      }
    }
  }
  console.log(`✓ Updated ${templateUpdates}/${templates.length} templates`);

  // ── 3. Slide.referenceImagePath + randomImagePool ─────────────────────────
  const slides = await prisma.slide.findMany();
  let slideUpdates = 0;
  for (const sl of slides) {
    const updates = {};

    if (isLocalPath(sl.referenceImagePath)) {
      const url = await getOrUpload(sl.referenceImagePath);
      if (url) updates.referenceImagePath = url;
    }

    let pool = [];
    try { pool = JSON.parse(sl.randomImagePool ?? "[]"); } catch { pool = []; }
    if (pool.some(isLocalPath)) {
      const newPool = await Promise.all(pool.map(async (p) => isLocalPath(p) ? (await getOrUpload(p) ?? p) : p));
      updates.randomImagePool = JSON.stringify(newPool);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.slide.update({ where: { id: sl.id }, data: updates });
      slideUpdates++;
    }
  }
  console.log(`✓ Updated ${slideUpdates}/${slides.length} slides`);

  await prisma.$disconnect();

  console.log(`\n✅ Done! ${urlCache.size} unique file(s) uploaded to Vercel Blob.`);
  console.log("   Re-generate your slides on production to use the updated reference images.");
}

run().catch((err) => {
  console.error("\n❌ Script failed:", err.message);
  process.exit(1);
});
