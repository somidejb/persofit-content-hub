import OpenAI from "openai";
import { prisma } from "./prisma";
import { generateAllSlides } from "./generation";
import { postSlideshowNow } from "./posting";
import type { SlideshowTemplateSlide, Prisma } from "@prisma/client";

type SlideCreateInput = Prisma.SlideCreateWithoutSlideshowInput;

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const PLAN_SYSTEM_PROMPT = `You are a creative director for social media slideshow content.
The user will give you:
- A content concept describing what the slideshow is about
- A reference image style (visual format to replicate)
- A list of variables that should change across slides
- The specific slide positions you need to plan (within a larger slideshow)

Your job is to plan ONLY the slides listed in "Slides to plan", filling in the variables with real, specific, coherent content that fits each slide's position in the overall sequence.
Each slide must be distinct — no two slides should cover the same thing.

Return a JSON object with a single key "slides" containing an array with exactly one object per requested slide position. Each object must have:
- "label": short name for this slide (e.g. "Chicken Breast", "Tip #3", "Day 2")
- "customPrompt": a complete image generation prompt. Copy and include ALL visual/design rules from the concept into this prompt, then add the specific variable values for this slide. Be thorough and self-contained — this prompt is sent directly to an image model with no other context.
- "variationDirection": a short instruction for how this slide should look visually distinct from the others (lighting, composition, angle, color, etc.)

Rules:
- "customPrompt" MUST include all design/style rules from the concept (format, layout, colors, brand guidelines, etc.) plus the slide-specific content
- Use real, accurate data where applicable (e.g. real nutritional values, real facts, real tips)
- Keep the visual format consistent with the base concept across all slides
- Make variationDirection genuinely different for each slide
- Return exactly: {"slides": [...]} — no other keys`;

type PlannedSlide = { label: string; customPrompt: string; variationDirection: string };

async function planSlides(
  concept: string,
  variables: string | null | undefined,
  slideCount: number,
  referenceImagePath: string | null | undefined,
  apiKey: string,
  /** If provided, tells GPT-4o the full slideshow context and which positions to plan */
  slotContext?: {
    totalSlides: number;
    /** Positions (1-based) of the ai-auto slots being planned */
    positions: number[];
    /** Brief descriptions of fixed slides so GPT-4o understands what's already there */
    fixedSlides: { position: number; description: string }[];
  }
): Promise<PlannedSlide[]> {
  const client = new OpenAI({ apiKey });

  const contextLines: (string | null)[] = [
    `Content concept: ${concept.trim()}`,
    variables?.trim() ? `Variables to change per slide: ${variables.trim()}` : null,
    referenceImagePath
      ? `The reference image defines the visual format/layout — maintain that structure across all slides.`
      : null,
  ];

  if (slotContext && slotContext.totalSlides > slotContext.positions.length) {
    contextLines.push(`Total slides in this slideshow: ${slotContext.totalSlides}`);
    if (slotContext.fixedSlides.length > 0) {
      const fixedDesc = slotContext.fixedSlides
        .map((f) => `  - Slide ${f.position}: ${f.description}`)
        .join("\n");
      contextLines.push(`Fixed slides (already defined, do NOT plan these):\n${fixedDesc}`);
    }
    contextLines.push(
      `Slides to plan (your output must contain exactly ${slotContext.positions.length} items, in order): ${slotContext.positions.map((p) => `Slide ${p}`).join(", ")}`
    );
  } else {
    contextLines.push(`Number of slides to plan: ${slideCount}`);
  }

  const userMessage = contextLines.filter(Boolean).join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GPT-4o returned invalid JSON during slide planning");
  }

  // Resolve array: bare array > .slides > first array-valued key > first value
  let slides: unknown;
  if (Array.isArray(parsed)) {
    slides = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // Try well-known keys first, then any key whose value is an array
    slides =
      obj.slides ??
      obj.data ??
      obj.result ??
      Object.values(obj).find((v) => Array.isArray(v));
  }

  if (!Array.isArray(slides)) {
    throw new Error(
      `GPT-4o response was not an array of slides. Raw: ${raw.slice(0, 300)}`
    );
  }

  return (slides as Record<string, string>[]).map((s, i) => ({
    label: s.label ?? `Slide ${i + 1}`,
    customPrompt: s.customPrompt ?? s.prompt ?? "",
    variationDirection: s.variationDirection ?? "",
  }));
}

/** Build the create-data array for Slideshow.slides, given a template and its stored slide definitions */
async function buildSlideCreateData(
  template: {
    concept: string;
    variables: string | null;
    slideCount: number;
    referenceImagePath: string | null;
  },
  storedSlides: SlideshowTemplateSlide[],
  apiKey: string
): Promise<SlideCreateInput[]> {
  // How many "ai-auto" slots need GPT-4o planning?
  const autoSlots = storedSlides.filter((s) => s.imageMode === "ai-auto");
  let aiPlans: PlannedSlide[] = [];
  if (autoSlots.length > 0) {
    // Build context so GPT-4o knows where the auto slots sit within the full slideshow
    const fixedSlides = storedSlides
      .filter((s) => s.imageMode !== "ai-auto")
      .map((s) => ({
        position: s.order,
        description:
          s.imageMode === "random-pick"
            ? "Random image picked from pool"
            : s.customPrompt
            ? `Fixed AI image: "${s.customPrompt.slice(0, 80)}${s.customPrompt.length > 80 ? "…" : ""}"`
            : "Fixed AI-generated image",
      }));

    aiPlans = await planSlides(
      template.concept,
      template.variables,
      autoSlots.length,
      template.referenceImagePath,
      apiKey,
      {
        totalSlides: storedSlides.length,
        positions: autoSlots.map((s) => s.order),
        fixedSlides,
      }
    );
  }

  let autoIdx = 0;
  return storedSlides.map((ts) => {
    const base = {
      order: ts.order,
      textOverlayEnabled: ts.textOverlayEnabled,
      overlayText: ts.overlayText,
      overlaySubtext: ts.overlaySubtext,
      textPosition: ts.textPosition,
      textSize: ts.textSize,
      textAlign: ts.textAlign,
      textColor: ts.textColor,
      textAccentColor: ts.textAccentColor,
      textStyle: ts.textStyle,
      textShadow: ts.textShadow,
      textBoxEnabled: ts.textBoxEnabled,
      textBoxOpacity: ts.textBoxOpacity,
    };

    if (ts.imageMode === "random-pick") {
      return {
        ...base,
        imageMode: "random-pick",
        referenceImagePath: null,
        randomImagePool: ts.randomImagePool,
        customPrompt: null,
        variationDirection: null,
      };
    }

    if (ts.imageMode === "generate") {
      return {
        ...base,
        imageMode: "generate",
        referenceImagePath: ts.referenceImagePath ?? template.referenceImagePath,
        randomImagePool: JSON.stringify([]),
        customPrompt: ts.customPrompt,
        variationDirection: ts.variationDirection,
      };
    }

    // ai-auto: use GPT-4o plan for this slot
    const plan = aiPlans[autoIdx++] ?? { customPrompt: "", variationDirection: "", label: `Slide ${ts.order}` };
    return {
      ...base,
      imageMode: "generate",
      referenceImagePath: ts.referenceImagePath ?? template.referenceImagePath,
      randomImagePool: JSON.stringify([]),
      customPrompt: plan.customPrompt,
      variationDirection: plan.variationDirection,
    };
  });
}

export type RunProgressEvent =
  | { type: "planning_start" }
  | { type: "planning_done"; slideCount: number }
  | { type: "slideshow_created"; slideshowId: string; slides: { id: string; order: number; imageMode: string }[] }
  | { type: "slide_start"; slideId: string; order: number }
  | { type: "slide_done"; slideId: string; order: number; finalImagePath: string }
  | { type: "slide_failed"; slideId: string; order: number; message: string }
  | { type: "complete"; status: string; slideshowId: string }
  | { type: "error"; message: string };

/** Core logic extracted so both runDueTemplates and runTemplateNow can share it */
async function executeTemplateRun(
  template: {
    id: string;
    name: string;
    concept: string;
    variables: string | null;
    slideCount: number;
    referenceImagePath: string | null;
    caption: string | null;
    hashtags: string | null;
    tiktokAccountId: string | null;
    aspectRatio: string;
    outputWidth: number;
    outputHeight: number;
    autoPost: boolean;
    templateSlides: SlideshowTemplateSlide[];
  },
  runId: string,
  today: string,
  onProgress?: (event: RunProgressEvent) => void | Promise<void>
) {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured");

  let slideCreateData: Record<string, unknown>[];

  if (template.templateSlides.length > 0) {
    await onProgress?.({ type: "planning_start" });
    slideCreateData = await buildSlideCreateData(template, template.templateSlides, apiKey);
    await onProgress?.({ type: "planning_done", slideCount: slideCreateData.length });
  } else {
    await onProgress?.({ type: "planning_start" });
    const plannedSlides = await planSlides(
      template.concept,
      template.variables,
      template.slideCount,
      template.referenceImagePath,
      apiKey
    );
    slideCreateData = plannedSlides.map((s, i) => ({
      order: i + 1,
      imageMode: "generate",
      referenceImagePath: template.referenceImagePath ?? null,
      randomImagePool: JSON.stringify([]),
      customPrompt: s.customPrompt,
      variationDirection: s.variationDirection,
      textOverlayEnabled: false,
      textPosition: "center",
      textSize: "large",
      textAlign: "center",
      textColor: "white",
      textAccentColor: "#00FF87",
      textStyle: "bold",
      textShadow: true,
      textBoxEnabled: false,
      textBoxOpacity: 0.45,
    }));
    await onProgress?.({ type: "planning_done", slideCount: slideCreateData.length });
  }

  const createdSlideshow = await prisma.slideshow.create({
    data: {
      name: `${template.name} — ${today}`,
      caption: template.caption ?? undefined,
      hashtags: template.hashtags ?? undefined,
      status: "DRAFT",
      tiktokAccountId: template.tiktokAccountId ?? null,
      tiktokMusicId: template.tiktokMusicId ?? null,
      aspectRatio: template.aspectRatio,
      outputWidth: template.outputWidth,
      outputHeight: template.outputHeight,
      slides: { create: slideCreateData as SlideCreateInput[] },
    },
  });

  const slidesCreated = await prisma.slide.findMany({
    where: { slideshowId: createdSlideshow.id },
    orderBy: { order: "asc" },
    select: { id: true, order: true, imageMode: true },
  });

  await prisma.slideshowTemplateRun.update({
    where: { id: runId },
    data: { slideshowId: createdSlideshow.id },
  });

  await onProgress?.({
    type: "slideshow_created",
    slideshowId: createdSlideshow.id,
    slides: slidesCreated,
  });

  const { failed } = await generateAllSlides(createdSlideshow.id, async (event) => {
    if (event.type === "slide_start") {
      const slide = slidesCreated.find((s) => s.id === event.slideId);
      await onProgress?.({ type: "slide_start", slideId: event.slideId, order: slide?.order ?? 0 });
    } else if (event.type === "slide_done") {
      const slide = slidesCreated.find((s) => s.id === event.slideId);
      await onProgress?.({ type: "slide_done", slideId: event.slideId, order: slide?.order ?? 0, finalImagePath: event.finalImagePath });
    } else if (event.type === "slide_failed") {
      const slide = slidesCreated.find((s) => s.id === event.slideId);
      await onProgress?.({ type: "slide_failed", slideId: event.slideId, order: slide?.order ?? 0, message: event.message });
    }
  });

  if (failed) throw new Error("One or more slides failed to generate");

  if (template.autoPost) {
    await postSlideshowNow(createdSlideshow.id);
    await prisma.slideshowTemplateRun.update({ where: { id: runId }, data: { status: "POSTED" } });
    await onProgress?.({ type: "complete", status: "POSTED", slideshowId: createdSlideshow.id });
    console.log(`[template-runner] template ${template.id} auto-posted slideshow ${createdSlideshow.id}`);
  } else {
    await prisma.slideshowTemplateRun.update({ where: { id: runId }, data: { status: "AWAITING_APPROVAL" } });
    await onProgress?.({ type: "complete", status: "AWAITING_APPROVAL", slideshowId: createdSlideshow.id });
    console.log(`[template-runner] template ${template.id} awaiting approval (run ${runId})`);
  }
}

/** Run a specific template immediately (used by the Run Now button). Streams progress via callback. */
export async function runTemplateNow(
  templateId: string,
  onProgress?: (event: RunProgressEvent) => void | Promise<void>
): Promise<{ runId: string; slideshowId: string | null; status: string }> {
  const today = new Date().toISOString().slice(0, 10);

  const template = await prisma.slideshowTemplate.findUnique({
    where: { id: templateId },
    include: { templateSlides: { orderBy: { order: "asc" } } },
  });
  if (!template) throw new Error("Template not found");

  const existingRun = await prisma.slideshowTemplateRun.findFirst({
    where: { templateId, scheduledFor: today },
  });
  if (existingRun) {
    if (existingRun.status === "REJECTED" || existingRun.status === "FAILED") {
      await prisma.slideshowTemplateRun.delete({ where: { id: existingRun.id } });
    } else {
      return { runId: existingRun.id, slideshowId: existingRun.slideshowId, status: existingRun.status };
    }
  }

  const run = await prisma.slideshowTemplateRun.create({
    data: { templateId, scheduledFor: today, status: "GENERATING" },
  });

  try {
    await executeTemplateRun(template, run.id, today, onProgress);
    const updated = await prisma.slideshowTemplateRun.findUnique({ where: { id: run.id } });
    return { runId: run.id, slideshowId: updated?.slideshowId ?? null, status: updated?.status ?? "UNKNOWN" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.slideshowTemplateRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await onProgress?.({ type: "error", message });
    throw err;
  }
}

export async function runDueTemplates() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  const todayCode = DAY_CODES[now.getDay()];

  const activeTemplates = await prisma.slideshowTemplate.findMany({
    where: { active: true, postTime: currentTime },
    include: {
      tiktokAccount: true,
      templateSlides: { orderBy: { order: "asc" } },
    },
  });

  for (const template of activeTemplates) {
    let scheduleDays: string[] = [];
    try { scheduleDays = JSON.parse(template.scheduleDays); } catch { scheduleDays = []; }
    if (!scheduleDays.includes(todayCode)) continue;

    const existingRun = await prisma.slideshowTemplateRun.findFirst({
      where: { templateId: template.id, scheduledFor: today },
    });
    if (existingRun) continue;

    const run = await prisma.slideshowTemplateRun.create({
      data: { templateId: template.id, scheduledFor: today, status: "GENERATING" },
    });

    try {
      await executeTemplateRun(template, run.id, today);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.slideshowTemplateRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: message },
      });
      console.error(`[template-runner] template ${template.id} run ${run.id} failed:`, err);
    }
  }
}
