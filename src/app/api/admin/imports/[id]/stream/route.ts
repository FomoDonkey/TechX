import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { subscribe } from "@/imports/events";
import type { ImportProgressEvent } from "@/imports/types";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

/**
 * SSE endpoint: el cliente abre EventSource y recibe ImportProgressEvent
 * encoded como `event: progress\ndata: {…json…}\n\n`. Reenvía heartbeat
 * cada 15s para evitar que proxies cierren la conexión.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  if (!db) return new NextResponse("DB no configurada", { status: 503 });
  const { id } = await props.params;
  if (!isUuid(id)) return new NextResponse("id inválido", { status: 400 });

  // Tenant check
  const [row] = await db
    .select({ id: imports.id, status: imports.status })
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(ev: ImportProgressEvent | { type: "ping" }) {
        if (closed) return;
        try {
          const payload = `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller closed
        }
      }

      // Initial — el subscribe replays buffer si engine ya corrió antes
      unsubscribe = subscribe(id, (ev) => send(ev));

      heartbeatTimer = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);

      // Si el cliente abandona, limpiamos
      req.signal?.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (unsubscribe) unsubscribe();
  }

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
