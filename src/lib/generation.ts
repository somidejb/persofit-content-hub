import path from "path";
import { readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import type { Slide, Slideshow, Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { generateSlideImage } from "./openaiImageService";
import { buildFinalPrompt } from "./prompt-builder";
import { normalizeToOutputSize } from "./image-processing";
import { renderTextOverlay } from "./overlay-renderer";

type ProgressEvent =
  | { type: "slide_start"; slideId: string }
  | { type: "slide_done"; slideId: string; finalImagePath: string }
  | { type: "slide_failed"; slideId: string; message: string };

async function saveBuffer(buffer: Buffer): Promise<string> {
  const filename = `${randomUUID()}.jpg`;
  const destPath = path.join(process.cwd(), "public", "uploads", "generated", filename);
  await writeFile(destPath, buffer);
  return `/uploads/generated/${filename}`;
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

async function generateOneSlide(
  slideshow: Pick<Slideshow, "outputWidth" | "outputHeight">,
  slide: Slide,
  settings: Settings,
  siblingIndex?: number,
  siblingTotal?: number
): Promise<{ finalImagePath: string }> {
  // ── Random-pick mode: skip OpenAI, just pick a file from the pool ──
  if (slide.imageMode === "random-pick") {
    let pool: string[] = [];
    try { pool = JSON.parse(slide.randomImagePool ?? "[]"); } catch { pool = []; }
    const validPool = pool.filter(Boolean);
    if (validPool.length === 0) throw new Error("Slide has no images in its pool");

    const picked = validPool[Math.floor(Math.random() * validPool.length)];
    const absPath = path.join(process.cwd(), "public", picked.replace(/^\//, ""));
    let rawBuffer: Buffer;
    try {
      rawBuffer = await readFile(absPath);
    } catch {
      // Pool image missing on this server (e.g. fresh deployment) — fall back to text-to-image
      console.warn(`[generation] Pool image not found on disk: ${picked} — falling back to text-to-image`);
      const apiKey = resolveOpenAIApiKey(settings);
      if (!apiKey) throw new Error("OpenAI API key is not configured and pool image is unavailable.");
      const prompt = buildFinalPrompt({ customPrompt: slide.customPrompt, variationDirection: slide.variationDirection, siblingIndex, siblingTotal });
      rawBuffer = await generateSlideImage({ apiKey, model: settings.imageModel, quality: settings.imageQuality, referenceImagePath: null, prompt, outputWidth: slideshow.outputWidth, outputHeight: slideshow.outputHeight });
    }
    const generatedImagePath = await saveBuffer(rawBuffer);

    const processedBuffer = await normalizeToOutputSize(rawBuffer, slideshow.outputWidth, slideshow.outputHeight);
    const processedImagePath = await saveBuffer(processedBuffer);

    const overlaidBuffer = slide.textOverlayEnabled ? await renderTextOverlay(processedBuffer, slide) : processedBuffer;
    const finalImagePath = overlaidBuffer !== processedBuffer ? await saveBuffer(overlaidBuffer) : processedImagePath;

    await prisma.slide.update({
      where: { id: slide.id },
      data: { status: "done", generatedImagePath, processedImagePath, finalImagePath, errorMessage: null },
    });
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
    data: { status: "done", generatedImagePath, processedImagePath, finalImagePath, errorMessage: null },
  });

  return { finalImagePath };
}

export async function generateAllSlides(
  slideshowId: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>
): Promise<{ failed: boolean }> {
  const slideshow = await prisma.slideshow.findUnique({
    where: { id: slideshowId },
    include: { slides: { orderBy: { order: "asc" } }, schedules: true },
  });
  if (!slideshow) throw new Error("Slideshow not found");

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings || !resolveOpenAIApiKey(settings)) {
    throw new Error("OpenAI API key is not configured. Add it in Settings or set OPENAI_API_KEY.");
  }

  await prisma.slideshow.update({ where: { id: slideshow.id }, data: { status: "GENERATING" } });
  let anyFailed = false;

  const siblingMap = buildSiblingMap(slideshow.slides.filter((s) => s.imageMode !== "random-pick"));

  // Track order → finalImagePath for slide-chaining (@slide:N references)
  const generatedPathByOrder = new Map<number, string>();

  for (const slide of slideshow.slides) {
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
  await prisma.slideshow.update({
    where: { id: slideshow.id },
    data: { status: anyFailed ? "FAILED" : hasPendingSchedule ? "SCHEDULED" : "DRAFT" },
  });

  return { failed: anyFailed };
}

/** Generates or regenerates a single slide. Sibling context is loaded from DB for auto-uniqueness. */
export async function generateSingleSlide(slideshowId: string, slideId: string): Promise<{ finalImagePath: string }> {
  const slideshow = await prisma.slideshow.findUnique({ where: { id: slideshowId } });
  if (!slideshow) throw new Error("Slideshow not found");

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

  await prisma.slide.update({ where: { id: slide.id }, data: { status: "generating", errorMessage: null } });

  try {
    return await generateOneSlide(slideshow, slide, settings, siblingIndex, siblingTotal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await prisma.slide.update({ where: { id: slide.id }, data: { status: "failed", errorMessage: message } });
    throw err;
  }
}
