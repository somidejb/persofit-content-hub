import path from "path";
import { readFile } from "fs/promises";
import { randomUUID } from "crypto";
import type { Slide, Slideshow, Settings } from "@prisma/client";
import { put } from "@vercel/blob";
import { prisma } from "./prisma";
import { generateSlideImage } from "./openaiImageService";
import { buildFinalPrompt } from "./prompt-builder";
import { normalizeToOutputSize } from "./image-processing";
import { renderTextOverlay } from "./overlay-renderer";
import { deleteStoredImages } from "./blob-storage";

type ProgressEvent =
  | { type: "slide_start"; slideId: string }
  | { type: "slide_done"; slideId: string; finalImagePath: string }
  | { type: "slide_failed"; slideId: string; message: string };

async function saveBuffer(buffer: Buffer): Promise<string> {
  const filename = `generated/${randomUUID()}.jpg`;
  // Use Vercel Blob in production; fall back to local disk in dev
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, buffer, { access: "public", contentType: "image/jpeg" });
    return blob.url;
  }
  // Local dev fallback — write to public/uploads/generated/
  const { writeFile } = await import("fs/promises");
  const destPath = path.join(process.cwd(), "public", "uploads", filename);
  await writeFile(destPath, buffer);
  return `/uploads/${filename}`;
}

/** Settings.openaiApiKey (pasted in the UI) takes priority; falls back to the OPENAI_API_KEY env var. */
function resolveOpenAIApiKey(settings: Settings): string | null {
  return settings.openaiApiKey || process.env.OPENAI_API_KEY || null;
}

/**
 * Builds a map of referenceImagePath → slides ordered by their position,
 * so each slide knows its 1-based index and total among siblings that share
 * the same reference image. Used to inject auto-uniqueness hints.
 */
function buildSiblingMap(slides: Slide[]): Map<string, { index: number; total: number }> {
  const grouped = new Map<string, Slide[]>();
  for (const slide of slides) {
    const key = slide.referenceImagePath ?? "__none__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(slide);
  }

  const result = new Map<string, { index: number; total: number }>();
  Array.from(grouped.values()).forEach((group) => {
    const total = group.length;
    group.forEach((slide: Slide, i: number) => {
      result.set(slide.id, { index: i + 1, total });
    });
  });
  return result;
}

/**
 * Only finalImagePath is ever displayed or posted — generatedImagePath and
 * processedImagePath are pure intermediates. Once a fresh finalImagePath
 * exists, delete: (a) this attempt's now-redundant raw/processed images,
 * and (b) whatever the slide's PREVIOUS attempt left behind (regenerating a
 * slide otherwise leaks its old images every time).
 */
async function cleanUpSuperseded(
  oldPaths: (string | null)[],
  thisAttempt: { generatedImagePath: string; processedImagePath: string; finalImagePath: string }
): Promise<void> {
  const toDelete = new Set<string>();
  for (const p of oldPaths) if (p) toDelete.add(p);
  if (thisAttempt.generatedImagePath !== thisAttempt.finalImagePath) toDelete.add(thisAttempt.generatedImagePath);
  if (thisAttempt.processedImagePath !== thisAttempt.finalImagePath) toDelete.add(thisAttempt.processedImagePath);
  toDelete.delete(thisAttempt.finalImagePath);

  await deleteStoredImages(Array.from(toDelete));
}

async function generateOneSlide(
  slideshow: Pick<Slideshow, "outputWidth" | "outputHeight">,
  slide: Slide,
  settings: Settings,
  siblingIndex?: number,
  siblingTotal?: number
): Promise<{ finalImagePath: string }> {
  // Whatever this slide had from a previous attempt — cleaned up once the
  // new attempt succeeds, so regenerating doesn't leak the old images.
  const oldPaths = [slide.generatedImagePath, slide.processedImagePath, slide.finalImagePath];

  // ── Random-pick mode: skip OpenAI, just pick a file from the pool ──
  if (slide.imageMode === "random-pick") {
    let pool: string[] = [];
    try { pool = JSON.parse(slide.randomImagePool ?? "[]"); } catch { pool = []; }
    const validPool = pool.filter(Boolean);
    if (validPool.length === 0) throw new Error("Slide has no images in its pool");

    const picked = validPool[Math.floor(Math.random() * validPool.length)];
    let rawBuffer: Buffer;
    if (picked.startsWith("http://") || picked.startsWith("https://")) {
      // Production: pool image is a remote Vercel Blob URL — fetch it
      const res = await fetch(picked);
      if (!res.ok) throw new Error(`Failed to fetch pool image (${res.status}): ${picked}`);
      rawBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      // Development: pool image is a local path under /public
      const absPath = path.join(process.cwd(), "public", picked.replace(/^\//, ""));
      rawBuffer = await readFile(absPath);
    }
    const generatedImagePath = await saveBuffer(rawBuffer);

    const processedBuffer = await normalizeToOutputSize(rawBuffer, slideshow.outputWidth, slideshow.outputHeight);
    const processedImagePath = await saveBuffer(processedBuffer);

    const overlaidBuffer = slide.textOverlayEnabled ? await renderTextOverlay(processedBuffer, slide) : processedBuffer;
    const finalImagePath = overlaidBuffer !== processedBuffer ? await saveBuffer(overlaidBuffer) : processedImagePath;

    await prisma.slide.update({
      where: { id: slide.id },
      data: {
        status: "done",
        // Redundant intermediates get their blob deleted below — don't keep
        // a dead URL pointing at nothing in the database.
        generatedImagePath: generatedImagePath === finalImagePath ? generatedImagePath : null,
        processedImagePath: processedImagePath === finalImagePath ? processedImagePath : null,
        finalImagePath,
        errorMessage: null,
      },
    });
    await cleanUpSuperseded(oldPaths, { generatedImagePath, processedImagePath, finalImagePath });
    return { finalImagePath };
  }

  // ── Generate mode: call OpenAI ──
  const apiKey = resolveOpenAIApiKey(settings);
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Add it in Settings or set OPENAI_API_KEY.");
  }

  const finalPrompt = buildFinalPrompt({
    customPrompt: slide.customPrompt,
    variationDirection: slide.variationDirection,
    siblingIndex,
    siblingTotal,
  });
  await prisma.slide.update({ where: { id: slide.id }, data: { finalPrompt } });

  const rawBuffer = await generateSlideImage({
    apiKey,
    model: settings.imageModel,
    quality: settings.imageQuality,
    referenceImagePath: slide.referenceImagePath,
    prompt: finalPrompt,
    outputWidth: slideshow.outputWidth,
    outputHeight: slideshow.outputHeight,
  });
  const generatedImagePath = await saveBuffer(rawBuffer);

  const processedBuffer = await normalizeToOutputSize(rawBuffer, slideshow.outputWidth, slideshow.outputHeight);
  const processedImagePath = await saveBuffer(processedBuffer);

  const overlaidBuffer = slide.textOverlayEnabled ? await renderTextOverlay(processedBuffer, slide) : processedBuffer;
  const finalImagePath = overlaidBuffer !== processedBuffer ? await saveBuffer(overlaidBuffer) : processedImagePath;

  await prisma.slide.update({
    where: { id: slide.id },
    data: {
      status: "done",
      generatedImagePath: generatedImagePath === finalImagePath ? generatedImagePath : null,
      processedImagePath: processedImagePath === finalImagePath ? processedImagePath : null,
      finalImagePath,
      errorMessage: null,
    },
  });
  await cleanUpSuperseded(oldPaths, { generatedImagePath, processedImagePath, finalImagePath });

  return { finalImagePath };
}

/**
 * A generation is considered stalled (safe to take over or ignore as a guard)
 * once nothing has touched its DB rows for this long. A single slide —
 * including safety-system retries — finishes well inside this window, so a
 * "generating" row older than this can only be a crashed/killed process.
 */
const GENERATION_STALE_MS = 10 * 60 * 1000;

/**
 * True when a slideshow's GENERATING claim looks abandoned: neither the
 * slideshow row nor ANY of its slide rows has been written in
 * GENERATION_STALE_MS. A live run writes a slide row every few seconds
 * (status flips, image paths, prompts), so real activity never looks stale.
 */
async function isGenerationStale(slideshowId: string): Promise<boolean> {
  const [newestSlide, slideshow] = await Promise.all([
    prisma.slide.findFirst({
      where: { slideshowId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.slideshow.findUnique({
      where: { id: slideshowId },
      select: { updatedAt: true },
    }),
  ]);
  const lastTouched = Math.max(
    newestSlide?.updatedAt.getTime() ?? 0,
    slideshow?.updatedAt.getTime() ?? 0
  );
  return Date.now() - lastTouched > GENERATION_STALE_MS;
}

/**
 * Atomically claims a slideshow for generation by flipping its status to
 * GENERATING only if it isn't already. This is the duplicate-run guard: two
 * tabs, a tab + the cron scheduler, or a tab + a template run can no longer
 * generate the same slideshow concurrently and double-spend on OpenAI.
 * A claim held by a crashed process (nothing updated for GENERATION_STALE_MS)
 * is taken over rather than blocking regeneration forever.
 */
async function claimSlideshowForGeneration(slideshowId: string): Promise<void> {
  const claimed = await prisma.slideshow.updateMany({
    where: { id: slideshowId, status: { not: "GENERATING" } },
    data: { status: "GENERATING" },
  });
  if (claimed.count > 0) return;

  // Already GENERATING — live process, or a crashed one that never cleaned up?
  if (!(await isGenerationStale(slideshowId))) {
    throw new Error(
      "This slideshow is already generating (started from another tab, a template run, or the scheduler). " +
      "Wait for it to finish or use Stop first — running it twice would pay for every image twice."
    );
  }
  // Stale claim from a dead process — take over.
  await prisma.slideshow.update({ where: { id: slideshowId }, data: { status: "GENERATING" } });
}

export async function generateAllSlides(
  slideshowId: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>
): Promise<{ failed: boolean; cancelled: boolean }> {
  const slideshow = await prisma.slideshow.findUnique({
    where: { id: slideshowId },
    include: { slides: { orderBy: { order: "asc" } }, schedules: true },
  });
  if (!slideshow) throw new Error("Slideshow not found");

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings || !resolveOpenAIApiKey(settings)) {
    throw new Error("OpenAI API key is not configured. Add it in Settings or set OPENAI_API_KEY.");
  }

  await claimSlideshowForGeneration(slideshow.id);
  let anyFailed = false;
  let cancelled = false;

  const siblingMap = buildSiblingMap(slideshow.slides.filter((s) => s.imageMode !== "random-pick"));

  // Track order → finalImagePath for slide-chaining (@slide:N references)
  const generatedPathByOrder = new Map<number, string>();

  for (const slide of slideshow.slides) {
    // Honor cancellation between slides: Stop / Stop All reset the
    // slideshow's status in the DB — if it's no longer GENERATING, someone
    // cancelled this run, so bail out before paying for the next image.
    // (The slide currently mid-flight when Stop is clicked can't be pulled
    // back from OpenAI, but every remaining one is saved.)
    const current = await prisma.slideshow.findUnique({
      where: { id: slideshow.id },
      select: { status: true },
    });
    if (current?.status !== "GENERATING") {
      cancelled = true;
      break;
    }

    // Resolve @slide:N reference before generating
    let resolvedSlide = slide;
    if (slide.referenceImagePath?.startsWith("@slide:")) {
      const refOrder = parseInt(slide.referenceImagePath.replace("@slide:", ""), 10);
      const resolvedPath = generatedPathByOrder.get(refOrder) ?? null;
      if (resolvedPath) {
        // Update in DB so the slide record is accurate, and use resolved path
        await prisma.slide.update({
          where: { id: slide.id },
          data: { referenceImagePath: resolvedPath },
        });
        resolvedSlide = { ...slide, referenceImagePath: resolvedPath };
      } else {
        // Referenced slide hasn't been generated yet or failed — skip with error
        anyFailed = true;
        const message = `Slide ${refOrder} hasn't been generated yet — cannot use its output as reference`;
        await prisma.slide.update({ where: { id: slide.id }, data: { status: "failed", errorMessage: message } });
        await onProgress?.({ type: "slide_failed", slideId: slide.id, message });
        continue;
      }
    }

    await prisma.slide.update({ where: { id: slide.id }, data: { status: "generating", errorMessage: null } });
    await onProgress?.({ type: "slide_start", slideId: slide.id });

    const sibling = siblingMap.get(slide.id);

    try {
      const { finalImagePath } = await generateOneSlide(
        slideshow,
        resolvedSlide,
        settings,
        sibling?.index,
        sibling?.total
      );
      generatedPathByOrder.set(slide.order, finalImagePath);
      await onProgress?.({ type: "slide_done", slideId: slide.id, finalImagePath });
    } catch (err) {
      anyFailed = true;
      const message = err instanceof Error ? err.message : "Generation failed";
      await prisma.slide.update({ where: { id: slide.id }, data: { status: "failed", errorMessage: message } });
      await onProgress?.({ type: "slide_failed", slideId: slide.id, message });
    }
  }

  const hasPendingSchedule = slideshow.schedules.some((s) => s.status === "PENDING");
  // Guarded write: only settle the final status if this run still owns the
  // GENERATING claim. If a cancel already reset the status (or another
  // process took over a stale claim), don't stomp on it — that's what used
  // to leave cancelled runs flipping back to FAILED/DRAFT out of nowhere.
  await prisma.slideshow.updateMany({
    where: { id: slideshow.id, status: "GENERATING" },
    data: { status: anyFailed ? "FAILED" : hasPendingSchedule ? "SCHEDULED" : "DRAFT" },
  });

  return { failed: anyFailed, cancelled };
}

/** Generates or regenerates a single slide. Sibling context is loaded from DB for auto-uniqueness. */
export async function generateSingleSlide(slideshowId: string, slideId: string): Promise<{ finalImagePath: string }> {
  const slideshow = await prisma.slideshow.findUnique({ where: { id: slideshowId } });
  if (!slideshow) throw new Error("Slideshow not found");

  // Don't let a single-slide regen race a whole-slideshow run that's actively
  // working through this same slideshow (it would double-generate this slide
  // when the loop reaches it). A stale GENERATING claim from a dead process
  // doesn't block.
  if (slideshow.status === "GENERATING" && !(await isGenerationStale(slideshowId))) {
    throw new Error(
      "This slideshow is currently running a full generation — wait for it to finish or stop it before regenerating individual slides."
    );
  }

  const slide = await prisma.slide.findUnique({ where: { id: slideId } });
  if (!slide || slide.slideshowId !== slideshowId) throw new Error("Slide not found");

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings || !resolveOpenAIApiKey(settings)) {
    throw new Error("OpenAI API key is not configured. Add it in Settings or set OPENAI_API_KEY.");
  }

  // Load siblings so single-slide regeneration also benefits from uniqueness hints
  const siblings = await prisma.slide.findMany({
    where: { slideshowId, referenceImagePath: slide.referenceImagePath ?? undefined },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const siblingIndex = siblings.findIndex((s) => s.id === slideId) + 1;
  const siblingTotal = siblings.length;

  // Duplicate-run guard, same idea as claimSlideshowForGeneration but at
  // slide granularity: atomically claim the slide by flipping it to
  // "generating" only if it isn't already. Prevents two tabs (or a tab plus
  // a generate-all pass) from paying OpenAI twice for the same slide.
  const claimed = await prisma.slide.updateMany({
    where: { id: slide.id, status: { not: "generating" } },
    data: { status: "generating", errorMessage: null },
  });
  if (claimed.count === 0) {
    const isStale = Date.now() - slide.updatedAt.getTime() > GENERATION_STALE_MS;
    if (!isStale) {
      throw new Error(
        "This slide is already generating (possibly from another tab or a running generate-all). " +
        "Wait for it to finish or stop it first."
      );
    }
    // Stale claim from a dead process — take over.
    await prisma.slide.update({ where: { id: slide.id }, data: { status: "generating", errorMessage: null } });
  }

  try {
    return await generateOneSlide(slideshow, slide, settings, siblingIndex, siblingTotal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await prisma.slide.update({ where: { id: slide.id }, data: { status: "failed", errorMessage: message } });
    throw err;
  }
}
