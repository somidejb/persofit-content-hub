export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { generateAllSlides } from "@/lib/generation";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const result = await generateAllSlides(params.id, (event) => send(event));
        await send({ type: "complete", failed: result.failed });
      } catch (err) {
        await send({ type: "error", message: err instanceof Error ? err.message : "Generation failed" });
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
