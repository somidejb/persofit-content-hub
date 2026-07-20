import { NextRequest, NextResponse } from "next/server";
import { postSlideshowNow } from "@/lib/posting";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await postSlideshowNow(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to post to TikTok" },
      { status: 400 }
    );
  }
}
