import { subscribeUltimaEvents, formatSseMessage } from "@/lib/ultima/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event) => {
        controller.enqueue(encoder.encode(formatSseMessage(event.type, event.payload)));
      };

      send({ type: "connected", payload: { ok: true } });

      const unsub = subscribeUltimaEvents(send);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsub();
      };

      // Store cleanup on the stream for cancel
      controller._cleanup = cleanup;
    },
    cancel(controller) {
      controller._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
