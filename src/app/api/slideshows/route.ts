import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSlideshowCard } from "@/lib/adapters";

const INCLUDE = {
  slides: true,
  tiktokAccount: true,
  schedules: true,
  posts: true,
} as const;

export async function GET() {
  const slideshows = await prisma.slideshow.findMany({
    include: INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(slideshows.map(toSlideshowCard));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, caption, hashtags, tiktokAccountId, aspectRatio, outputWidth, outputHeight, slides, schedule } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json({ error: "at least one slide is required" }, { status: 400 });
  }

  const hasSchedule = schedule && Array.isArray(schedule.dates) && schedule.dates.length > 0;

  const slideshow = await prisma.slideshow.create({
    data: {
      name,
      caption: caption || "",
      hashtags: hashtags || "",
      status: hasSchedule ? "SCHEDULED" : "DRAFT",
      tiktokAccountId: tiktokAccountId || null,
      aspectRatio: (aspectRatio as string) || "9:16",
      outputWidth: typeof outputWidth === "number" ? outputWidth : 1080,
      outputHeight: typeof outputHeight === "number" ? outputHeight : 1920,
      slides: {
        create: slides.map((s: Record<string, unknown>, i: number) => ({
          order: (s.order as number) ?? i + 1,
          imageMode: (s.imageMode as string) === "random-pick" ? "random-pick" : "generate",
          referenceImagePath: (s.referenceImagePath as string) || null,
          randomImagePool: typeof s.randomImagePool === "string" ? s.randomImagePool : JSON.stringify([]),
          customPrompt: (s.customPrompt as string) || null,
          variationDirection: (s.variationDirection as string) || null,
          textOverlayEnabled: typeof s.textOverlayEnabled === "boolean" ? s.textOverlayEnabled : false,
          overlayText: (s.overlayText as string) || null,
          overlaySubtext: (s.overlaySubtext as string) || null,
          textPosition: (s.textPosition as string) || "center",
          textSize: (s.textSize as string) || "large",
          textAlign: (s.textAlign as string) || "center",
          textColor: (s.textColor as string) || "white",
          textAccentColor: (s.textAccentColor as string) || "#00FF87",
          textStyle: (s.textStyle as string) || "bold",
          textShadow: typeof s.textShadow === "boolean" ? s.textShadow : true,
          textBoxEnabled: typeof s.textBoxEnabled === "boolean" ? s.textBoxEnabled : false,
          textBoxOpacity: typeof s.textBoxOpacity === "number" ? s.textBoxOpacity : 0.45,
        })),
      },
      schedules: hasSchedule
        ? {
            create: [
              {
                postTime: schedule.postTime || "09:00",
                dates: JSON.stringify(schedule.dates),
                status: "PENDING",
              },
            ],
          }
        : undefined,
    },
    include: INCLUDE,
  });

  return NextResponse.json(toSlideshowCard(slideshow), { status: 201 });
}
