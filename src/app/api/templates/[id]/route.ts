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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const template = await prisma.slideshowTemplate.findUnique({
    where: { id },
    include: {
      tiktokAccount: { select: { id: true, name: true } },
      templateSlides: { orderBy: { order: "asc" } },
      runs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const {
    name, caption, hashtags, tiktokAccountId, concept, variables,
    slideCount, referenceImagePath, aspectRatio, outputWidth, outputHeight,
    postTime, scheduleDays, autoPost, active, templateSlides,
  } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (caption !== undefined) data.caption = caption;
  if (hashtags !== undefined) data.hashtags = hashtags;
  if (tiktokAccountId !== undefined) data.tiktokAccountId = tiktokAccountId || null;
  if (concept !== undefined) data.concept = concept;
  if (variables !== undefined) data.variables = variables || null;
  if (slideCount !== undefined) data.slideCount = slideCount;
  if (referenceImagePath !== undefined) data.referenceImagePath = referenceImagePath || null;
  if (aspectRatio !== undefined) data.aspectRatio = aspectRatio;
  if (outputWidth !== undefined) data.outputWidth = outputWidth;
  if (outputHeight !== undefined) data.outputHeight = outputHeight;
  if (postTime !== undefined) data.postTime = postTime;
  if (scheduleDays !== undefined) data.scheduleDays = JSON.stringify(scheduleDays);
  if (autoPost !== undefined) data.autoPost = autoPost;
  if (active !== undefined) data.active = active;

  // If slides array is provided, replace all stored slides
  if (Array.isArray(templateSlides)) {
    data.templateSlides = {
      deleteMany: {},
      create: (templateSlides as TemplateSlideInput[]).map(toSlideCreateData),
    };
  }

  try {
    const updated = await prisma.slideshowTemplate.update({
      where: { id },
      data,
      include: {
        tiktokAccount: { select: { id: true, name: true } },
        templateSlides: { orderBy: { order: "asc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.slideshowTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
}
