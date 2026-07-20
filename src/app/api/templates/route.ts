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
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    caption,
    hashtags,
    tiktokAccountId,
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
