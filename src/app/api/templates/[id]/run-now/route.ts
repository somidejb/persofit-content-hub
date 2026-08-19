export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTemplateNow } from "@/lib/template-runner";

export const maxDuration = 300; // 5 minutes

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // force: true (the template page's explicit Run Now) re-runs even when
  // today's run already completed; without it (Run All Templates), accounts
  // that completed today are skipped. Actively-generating accounts are never
  // re-run either way.
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  const template = await prisma.slideshowTemplate.findUnique({ where: { id } });
  if (!template) {
    return new Response(JSON.stringify({ error: "Template not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Per-account dedup/retry (skip already-completed accounts, retry failed/
  // rejected ones) is handled inside runTemplateNow itself, since "already
  // ran today" is now a per-account question, not a per-template one.

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
        const result = await runTemplateNow(
          id,
          async (event) => {
            send(event);
          },
          { force }
        );
        send({ type: "run_complete", accounts: result.accounts });
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
