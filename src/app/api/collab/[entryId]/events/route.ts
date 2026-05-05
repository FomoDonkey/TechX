import { requireUser } from "@/auth/server";
import {
  COLLAB_AWARENESS_CHANNEL,
  COLLAB_UPDATE_CHANNEL,
  checkEntryAccess,
  loadInitialState,
} from "@/collab/server";
import { subscribePubsub } from "@/lib/pubsub";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * SSE stream para realtime collab editing de un entry.
 *
 * Eventos:
 *   - `connected` — payload `{ ok, ts, clientHint }`
 *   - `init` — payload `{ snapshot: base64|null, updates: base64[], bodyJson: any }`
 *   - `update` — payload `{ clientId, update: base64, userId }` para cada update remoto
 *   - `awareness` — payload `{ clientId, update: base64, user }` presence/cursors
 *   - `heartbeat` — cada 25s
 */
export async function GET(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const user = await requireUser();
  const wsCtx = await requireWorkspace("author");

  const ok = await checkEntryAccess(entryId, wsCtx.workspace.id);
  if (!ok) return new Response("Not Found", { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let unsubUpdate = () => {};
      let unsubAwareness = () => {};
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubUpdate();
        unsubAwareness();
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

      send({ ok: true, ts: Date.now(), userId: user.id }, "connected");

      // 1. Estado inicial: snapshot + updates posteriores + body fallback
      try {
        const initial = await loadInitialState(entryId, wsCtx.workspace.id);
        send(initial, "init");
      } catch {
        send({ message: "init failed" }, "error");
      }

      // 2. Suscribirse al canal de updates del entry
      unsubUpdate = subscribePubsub(COLLAB_UPDATE_CHANNEL(entryId), (raw) => {
        try {
          const data = JSON.parse(raw) as {
            clientId: string;
            update: string;
            userId: string | null;
          };
          send(data, "update");
        } catch {
          /* malformed payload ignored */
        }
      });

      // 3. Suscribirse al canal de awareness (presence/cursors)
      unsubAwareness = subscribePubsub(COLLAB_AWARENESS_CHANNEL(entryId), (raw) => {
        try {
          const data = JSON.parse(raw) as {
            clientId: string;
            update: string;
            user: unknown;
          };
          send(data, "awareness");
        } catch {
          /* malformed payload ignored */
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
