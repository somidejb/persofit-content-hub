import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateSlideImage } from "@/lib/openaiImageService";
import { buildFinalPrompt } from "@/lib/prompt-builder";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { referenceImagePath, customPrompt, variationDirection, outputWidth, outputHeight } = body;

  if (!customPrompt || typeof customPrompt !== "string" || !customPrompt.trim()) {
    return NextResponse.json({ error: "customPrompt is required" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured. Add it in Settings." }, { status: 400 });
  }

  const prompt = buildFinalPrompt({ customPrompt, variationDirection });
  const w = typeof outputWidth === "number" ? outputWidth : 1080;
  const h = typeof outputHeight === "number" ? outputHeight : 1920;

  try {
    const imageBuffer = await generateSlideImage({
      apiKey,
      model: settings?.imageModel ?? "gpt-image-2",
      quality: settings?.imageQuality ?? "medium",
      referenceImagePath: referenceImagePath || null,
      prompt,
      outputWidth: w,
      outputHeight: h,
    });

    const filename = `preview-${randomUUID()}.jpg`;
    const destPath = path.join(process.cwd(), "public", "uploads", "generated", filename);
    await writeFile(destPath, imageBuffer);

    return NextResponse.json({ imagePath: `/uploads/generated/${filename}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
