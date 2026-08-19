export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TemplateSlideInput = {
  order: number;
  imageMode: string;
  referenceImagePath?: string | null;
  randomImagePool?: string[];
  customPrompt?: string | null;
  variationDirection?: string | null;
  textOverlayEnabled?: boolean;
  overlayText?: string | null;
  overlaySubtext?: string | null;
  textPosition?: string;
  textSize?: string;
  textAlign?: string;
  textColor?: string;
  textAccentColor?: string;
  textStyle?: string;
  textShadow?: boolean;
  textBoxEnabled?: boolean;
  textBoxOpacity?: number;
};

function toSlideCreateData(s: TemplateSlideInput, i: number) {
  return {
    order: typeof s.order === "number" ? s.order : i + 1,
    imageMode: ["ai-auto", "generate", "random-pick"].includes(s.imageMode) ? s.imageMode : "ai-auto",
    referenceImagePath: s.referenceImagePath || null,
    randomImagePool: Array.isArray(s.randomImagePool) ? JSON.stringify(s.randomImagePool) : JSON.stringify([]),
    customPrompt: s.customPrompt || null,
    variationDirection: s.variationDirection || null,
    textOverlayEnabled: typeof s.textOverlayEnabled === "boolean" ? s.textOverlayEnabled : false,
    overlayText: s.overlayText || null,
    overlaySubtext: s.overlaySubtext || null,
    textPosition: s.textPosition || "center",
    textSize: s.textSize || "large",
    textAlign: s.textAlign || "center",
    textColor: s.textColor || "white",
    textAccentColor: s.textAccentColor || "#00FF87",
    textStyle: s.textStyle || "bold",
    textShadow: typeof s.textShadow === "boolean" ? s.textShadow : true,
    textBoxEnabled: typeof s.textBoxEnabled === "boolean" ? s.textBoxEnabled : false,
    textBoxOpacity: typeof s.textBoxOpacity === "number" ? s.textBoxOpacity : 0.45,
  };
}

export async function GET() {
  const templates = await prisma.slideshowTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tiktokAccount: { select: { id: true, name: true } },
      templateSlides: { orderBy: { order: "asc" } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          createdAt: true,
          slideshowId: true,
          errorMessage: true,
        },
      },
    },
  });

  // SlideshowTemplateRun.slideshowId isn't a declared Prisma relation, so pull
  // slideshow statuses separately and merge them in. This lets the client
  // treat a run as "images done" the moment the slideshow itself finishes
  // generating, instead of waiting on the run's own wrap-up bookkeeping
  // (marking AWAITING_APPROVAL, or finishing an auto-post to TikTok) — which
  // otherwise left the "Run All Templates" panel showing a loading spinner
  // for a few extra seconds after every slide was already visibly done.
  const slideshowIds = Array.from(
    new Set(templates.flatMap((t) => t.runs.map((r) => r.slideshowId).filter((id): id is string => !!id)))
  );
  const slideshows = slideshowIds.length
    ? await prisma.slideshow.findMany({ where: { id: { in: slideshowIds } }, select: { id: true, status: true } })
    : [];
  const statusById = new Map(slideshows.map((s) => [s.id, s.status]));

  // A slideshow's status alone can't tell "posting failed" apart from
  // "generation failed" — both leave it at "FAILED". PostHistory rows are
  // only ever written by an actual post attempt (postSlideshowNow bails out
  // before creating one if images aren't ready yet), so the latest row per
  // slideshow is an unambiguous record of whether posting was ever tried,
  // and whether it succeeded — this is what lets "Post All to Account" know
  // which slideshows are already posted (skip, don't duplicate) vs. which
  // just failed to post (offer a targeted retry instead of a full rerun).
  const postHistory = slideshowIds.length
    ? await prisma.postHistory.findMany({
        where: { slideshowId: { in: slideshowIds } },
        orderBy: { postedAt: "desc" },
        select: { slideshowId: true, status: true, errorMessage: true },
      })
    : [];
  const lastPostBySlideshow = new Map<string, { status: string; errorMessage: string | null }>();
  for (const p of postHistory) {
    if (!lastPostBySlideshow.has(p.slideshowId)) {
      lastPostBySlideshow.set(p.slideshowId, { status: p.status, errorMessage: p.errorMessage });
    }
  }

  const withSlideshowStatus = templates.map((t) => ({
    ...t,
    runs: t.runs.map((r) => {
      const lastPost = r.slideshowId ? lastPostBySlideshow.get(r.slideshowId) : undefined;
      return {
        ...r,
        slideshowStatus: r.slideshowId ? statusById.get(r.slideshowId) ?? null : null,
        lastPostStatus: lastPost?.status ?? null,
        lastPostError: lastPost?.status === "failed" ? lastPost.errorMessage ?? null : null,
      };
    }),
  }));

  return NextResponse.json(withSlideshowStatus);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    caption,
    hashtags,
    tiktokAccountId,
    tiktokMusicId,
    targetAccountIds,
    concept,
    variables,
    slideCount,
    referenceImagePath,
    aspectRatio,
    outputWidth,
    outputHeight,
    postTime,
    scheduleDays,
    autoPost,
    active,
    templateSlides,
  } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!concept || typeof concept !== "string") {
    return NextResponse.json({ error: "concept is required" }, { status: 400 });
  }
  if (!postTime || typeof postTime !== "string") {
    return NextResponse.json({ error: "postTime is required" }, { status: 400 });
  }
  if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) {
    return NextResponse.json({ error: "scheduleDays must be a non-empty array" }, { status: 400 });
  }

  const slides = Array.isArray(templateSlides) ? templateSlides as TemplateSlideInput[] : [];

  const template = await prisma.slideshowTemplate.create({
    data: {
      name,
      caption: caption || "",
      hashtags: hashtags || "",
      tiktokAccountId: tiktokAccountId || null,
      tiktokMusicId: tiktokMusicId || null,
      targetAccountIds: Array.isArray(targetAccountIds) ? JSON.stringify(targetAccountIds) : "[]",
      concept,
      variables: variables || null,
      slideCount: typeof slideCount === "number" ? slideCount : 7,
      referenceImagePath: referenceImagePath || null,
      aspectRatio: aspectRatio || "9:16",
      outputWidth: typeof outputWidth === "number" ? outputWidth : 1080,
      outputHeight: typeof outputHeight === "number" ? outputHeight : 1920,
      postTime,
      scheduleDays: JSON.stringify(scheduleDays),
      autoPost: typeof autoPost === "boolean" ? autoPost : false,
      active: typeof active === "boolean" ? active : true,
      templateSlides: slides.length > 0 ? { create: slides.map(toSlideCreateData) } : undefined,
    },
    include: {
      tiktokAccount: { select: { id: true, name: true } },
      templateSlides: { orderBy: { order: "asc" } },
      runs: true,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
