export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { postSlideshowToAccounts } from "@/lib/posting";

export const maxDuration = 300; // 5 minutes — generating+posting several accounts can take a while

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const accountIds = Array.isArray(body.accountIds) ? (body.accountIds as string[]).filter(Boolean) : [];

  if (accountIds.length === 0) {
    return new Response(JSON.stringify({ error: "Select at least one TikTok account" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        const results = await postSlideshowToAccounts(params.id, accountIds, (event) => send(event));
        await send({ type: "complete", results });
      } catch (err) {
        await send({ type: "error", message: err instanceof Error ? err.message : "Multi-account post failed" });
      } finally {
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
