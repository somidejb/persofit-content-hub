export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTemplateNow } from "@/lib/template-runner";

export const maxDuration = 300; // 5 minutes

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const template = await prisma.slideshowTemplate.findUnique({ where: { id } });
  if (!template) {
    return new Response(JSON.stringify({ error: "Template not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const existingRun = await prisma.slideshowTemplateRun.findFirst({
    where: { templateId: id, scheduledFor: today },
  });

  if (existingRun) {
    const retriable = existingRun.status === "REJECTED" || existingRun.status === "FAILED";
    if (!retriable) {
      return new Response(
        JSON.stringify({
          error: `Already ran today (status: ${existingRun.status}). Wait until tomorrow or approve/reject the existing run first.`,
          runId: existingRun.id,
          status: existingRun.status,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    // Delete the failed/rejected run so runTemplateNow can create a fresh one
    await prisma.slideshowTemplateRun.delete({ where: { id: existingRun.id } });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // client disconnected
        }
      }

      try {
        await runTemplateNow(id, async (event) => {
          send(event);
        });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Run failed" });
      } finally {
        send({ type: "stream_end" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
