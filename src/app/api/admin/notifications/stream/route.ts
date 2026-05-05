import { requireUser } from "@/auth/server";
import { subscribeNotifications } from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * SSE stream del bell. Auto-heartbeat cada 25s. Cierre limpio al desconectar.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let unsub = () => {};
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      // F9c.8a fix H3: cualquier fallo de send (cliente cerró sin abort) dispara
      // cleanup. Previene listener leak en `notifications.ts` Map.
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

      unsub = subscribeNotifications(ctx.workspace.id, user.id, (n) => {
        send(
          {
            id: n.id,
            type: n.type,
            payload: n.payload,
            createdAt: n.createdAt.toISOString(),
          },
          "notification",
        );
      });

      heartbeat = setInterval(() => {
        const ok = send({ ts: Date.now() }, "heartbeat");
        if (!ok) cleanup();
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
