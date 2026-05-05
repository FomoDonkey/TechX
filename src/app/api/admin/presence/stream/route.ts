import { requireUser } from "@/auth/server";
import { subscribePubsub } from "@/lib/pubsub";
import { requireWorkspace } from "@/lib/workspace";
import { PRESENCE_CHANNEL, listActivePresence } from "@/presence/server";

export const dynamic = "force-dynamic";

/**
 * SSE de presence global del workspace. Eventos:
 *   - `connected` ack
 *   - `init` array con sesiones activas (last 60s) + datos de usuario
 *   - `presence` payload `{kind, userId, clientId, route, entryId, user, ts}`
 *   - `heartbeat` cada 25s
 */
export async function GET(req: Request) {
  await requireUser();
  const ctx = await requireWorkspace("viewer");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let unsub = () => {};
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (data: unknown, event?: string): boolean => {
        if (closed) return false;
        try {
          if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      send({ ok: true, ts: Date.now() }, "connected");

      // Snapshot inicial: hidrata el cliente con todas las sesiones activas.
      try {
        const initial = await listActivePresence(ctx.workspace.id);
        send(initial, "init");
      } catch {
        send({ message: "init failed" }, "error");
      }

      // Suscripción al canal del workspace para deltas en vivo.
      unsub = subscribePubsub(PRESENCE_CHANNEL(ctx.workspace.id), (raw) => {
        try {
          const data = JSON.parse(raw);
          send(data, "presence");
        } catch {
          /* ignored */
        }
      });

      heartbeat = setInterval(() => {
        const ok2 = send({ ts: Date.now() }, "heartbeat");
        if (!ok2) cleanup();
      }, 25_000);

      req.signal.addEventListener("abort", cleanup);
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
