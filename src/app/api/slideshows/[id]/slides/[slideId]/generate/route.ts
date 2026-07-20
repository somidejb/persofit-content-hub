export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { generateSingleSlide } from "@/lib/generation";

export async function POST(_req: NextRequest, { params }: { params: { id: string; slideId: string } }) {
  try {
    const result = await generateSingleSlide(params.id, params.slideId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate slide" },
      { status: 400 }
    );
  }
}
