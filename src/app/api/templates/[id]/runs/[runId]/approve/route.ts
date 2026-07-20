export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postSlideshowNow } from "@/lib/posting";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;

  const run = await prisma.slideshowTemplateRun.findUnique({ where: { id: runId } });
  if (!run || run.templateId !== id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: `Run is not awaiting approval (status: ${run.status})` }, { status: 400 });
  }
  if (!run.slideshowId) {
    return NextResponse.json({ error: "Run has no linked slideshow" }, { status: 400 });
  }

  try {
    await postSlideshowNow(run.slideshowId);
    await prisma.slideshowTemplateRun.update({
      where: { id: runId },
      data: { status: "POSTED" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Posting failed";
    await prisma.slideshowTemplateRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
