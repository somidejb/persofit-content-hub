export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function maskKey(key: string | null) {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
}

function toResponse(settings: {
  openaiApiKey: string | null;
  imageModel: string;
  imageQuality: string;
  defaultAspectRatio: string;
  defaultOutputWidth: number;
  defaultOutputHeight: number;
  globalBrandPrompt: string | null;
}) {
  return {
    openaiApiKey: maskKey(settings.openaiApiKey),
    hasKey: !!settings.openaiApiKey,
    imageModel: settings.imageModel,
    imageQuality: settings.imageQuality,
    defaultAspectRatio: settings.defaultAspectRatio,
    defaultOutputWidth: settings.defaultOutputWidth,
    defaultOutputHeight: settings.defaultOutputHeight,
    globalBrandPrompt: settings.globalBrandPrompt ?? "",
  };
}

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(
    toResponse(
      settings ?? {
        openaiApiKey: null,
        imageModel: "gpt-image-2",
        imageQuality: "medium",
        defaultAspectRatio: "9:16",
        defaultOutputWidth: 1080,
        defaultOutputHeight: 1920,
        globalBrandPrompt: null,
      }
    )
  );
}

export async function PUT(req: NextRequest) {
  const body = await req.json();

  const data: Record<string, string | number> = {};
  if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) data.openaiApiKey = body.openaiApiKey.trim();
  if (typeof body.imageModel === "string" && body.imageModel.trim()) data.imageModel = body.imageModel.trim();
  if (typeof body.imageQuality === "string" && body.imageQuality.trim()) data.imageQuality = body.imageQuality.trim();
  if (typeof body.defaultAspectRatio === "string" && body.defaultAspectRatio.trim())
    data.defaultAspectRatio = body.defaultAspectRatio.trim();
  if (typeof body.defaultOutputWidth === "number") data.defaultOutputWidth = body.defaultOutputWidth;
  if (typeof body.defaultOutputHeight === "number") data.defaultOutputHeight = body.defaultOutputHeight;
  if (typeof body.globalBrandPrompt === "string") data.globalBrandPrompt = body.globalBrandPrompt;
  if (typeof body.tiktokClientKey === "string") data.tiktokClientKey = body.tiktokClientKey.trim();
  if (typeof body.tiktokClientSecret === "string" && body.tiktokClientSecret.trim())
    data.tiktokClientSecret = body.tiktokClientSecret.trim();
  if (typeof body.tiktokRedirectUri === "string") data.tiktokRedirectUri = body.tiktokRedirectUri.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json(toResponse(settings));
}
