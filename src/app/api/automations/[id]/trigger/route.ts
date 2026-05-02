/**
 * POST /api/automations/[id]/trigger
 *
 * Endpoint público (token-protected) para disparar una automation con
 * trigger_type = "webhook_in". Verifica `x-csm-secret` contra el secret
 * timing-safely.
 */

import { timingSafeEqual } from "node:crypto";
import { triggerWebhookIn } from "@/automations/listener";
import { db } from "@/db/client";
import { automations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ error: "DB no disponible" }, { status: 503 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const provided = req.headers.get("x-csm-secret") ?? "";
  if (!provided) return NextResponse.json({ error: "missing_secret" }, { status: 401 });

  const [auto] = await db
    .select({
      id: automations.id,
      workspaceId: automations.workspaceId,
      active: automations.active,
      triggerType: automations.triggerType,
      webhookSecret: automations.webhookSecret,
    })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.triggerType, "webhook_in")))
    .limit(1);
  if (!auto || !auto.webhookSecret) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Timing-safe compare
  const a = Buffer.from(provided);
  const b = Buffer.from(auto.webhookSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!auto.active) return NextResponse.json({ error: "inactive" }, { status: 409 });

  let payload: unknown = null;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    payload = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const runId = await triggerWebhookIn({
    workspaceId: auto.workspaceId,
    automationId: auto.id,
    payload,
  });
  return NextResponse.json({ ok: true, runId }, { status: 202 });
}
