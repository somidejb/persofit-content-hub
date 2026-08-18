import { list, del } from "@vercel/blob";
import { prisma } from "./prisma";

export type OrphanBlob = { url: string; size: number; uploadedAt: string };

export type BlobCleanupReport = {
  totalBlobCount: number;
  totalBlobBytes: number;
  referencedCount: number;
  orphans: OrphanBlob[];
  orphanCount: number;
  orphanBytes: number;
};

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Every field anywhere in the schema that can hold a stored-image URL.
 * Anything in the Blob store NOT in this set is safe to delete — most
 * commonly leftover intermediates from old generations, or "Preview a Run"
 * images from the template builder, which are never saved to any row.
 */
async function collectReferencedUrls(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const [slides, templateSlides, templates, postHistory, accounts] = await Promise.all([
    prisma.slide.findMany({
      select: {
        referenceImagePath: true,
        generatedImagePath: true,
        processedImagePath: true,
        finalImagePath: true,
        randomImagePool: true,
      },
    }),
    prisma.slideshowTemplateSlide.findMany({
      select: { referenceImagePath: true, randomImagePool: true },
    }),
    prisma.slideshowTemplate.findMany({ select: { referenceImagePath: true } }),
    prisma.postHistory.findMany({ select: { generatedImages: true } }),
    prisma.tiktokAccount.findMany({ select: { avatarUrl: true } }),
  ]);

  for (const s of slides) {
    [s.referenceImagePath, s.generatedImagePath, s.processedImagePath, s.finalImagePath].forEach((p) => {
      if (p) referenced.add(p);
    });
    parseJsonArray(s.randomImagePool).forEach((p) => referenced.add(p));
  }
  for (const ts of templateSlides) {
    if (ts.referenceImagePath) referenced.add(ts.referenceImagePath);
    parseJsonArray(ts.randomImagePool).forEach((p) => referenced.add(p));
  }
  for (const t of templates) {
    if (t.referenceImagePath) referenced.add(t.referenceImagePath);
  }
  for (const h of postHistory) {
    parseJsonArray(h.generatedImages).forEach((p) => referenced.add(p));
  }
  for (const a of accounts) {
    if (a.avatarUrl) referenced.add(a.avatarUrl);
  }

  return referenced;
}

/**
 * Read-only dry run: lists every blob in the store and reports which ones
 * are no longer referenced by anything in the database. Deletes nothing.
 */
export async function scanForOrphanedBlobs(): Promise<BlobCleanupReport> {
  const referenced = await collectReferencedUrls();

  let totalBlobCount = 0;
  let totalBlobBytes = 0;
  const orphans: OrphanBlob[] = [];

  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const blob of page.blobs) {
      totalBlobCount++;
      totalBlobBytes += blob.size;
      if (!referenced.has(blob.url)) {
        orphans.push({ url: blob.url, size: blob.size, uploadedAt: blob.uploadedAt.toISOString() });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0);

  return {
    totalBlobCount,
    totalBlobBytes,
    referencedCount: referenced.size,
    orphans,
    orphanCount: orphans.length,
    orphanBytes,
  };
}

/**
 * Deletes exactly the given URLs. Callers pass the list from a
 * scanForOrphanedBlobs() report the user has already reviewed — this
 * function does not re-derive "orphaned" itself, so there's no gap between
 * what was shown and what actually gets deleted.
 */
export async function deleteBlobs(urls: string[]): Promise<{ deleted: number }> {
  if (urls.length === 0) return { deleted: 0 };
  const chunkSize = 100;
  for (let i = 0; i < urls.length; i += chunkSize) {
    await del(urls.slice(i, i + chunkSize));
  }
  return { deleted: urls.length };
}
