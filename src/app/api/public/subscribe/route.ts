/**
 * POST /api/public/subscribe
 *
 * Endpoint público para alta a la newsletter. Sin auth — protegido por:
 *  - Honeypot field (`website` style)
 *  - Time-trap (csm_t — opcional)
 *  - Rate limit por IP+workspace
 *  - Email validation strict
 *  - Workspace resolution por host (custom domain → subdominio → fallback)
 *
 * Si el workspace tiene `RESEND_API_KEY`, manda email de confirmación. Si no,
 * el subscriber se crea con confirmedAt=null y un mock-log queda en consola
 * (modo dev).
 */

import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { consumeSubmitRateLimit } from "@/forms/rate-limit";
import { hashIp } from "@/forms/submit";
import { sendEmail } from "@/lib/email";
import { subscribe } from "@/newsletter/subscribers";
import { renderConfirmation } from "@/newsletter/templates";
import { buildSubscribeUrls, publicOriginFromWorkspace } from "@/newsletter/urls";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024;
const HONEYPOT_FIELD = "website"; // estilo común — bots lo rellenan
const MIN_FORM_TIME_MS = 800; // si csm_t llega y elapsed < 800ms es bot

type SubscribeBody = {
  email?: unknown;
  name?: unknown;
  locale?: unknown;
  source?: unknown;
  tags?: unknown;
  csm_t?: unknown;
  workspaceId?: unknown;
  [HONEYPOT_FIELD]?: unknown;
};

export async function POST(req: Request) {
  const cors = corsHeaders();
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers: cors });
  }

  const ct = req.headers.get("content-type") ?? "";
  let body: SubscribeBody;
  try {
    if (ct.includes("application/json")) {
      const text = await req.text();
      if (text.length > MAX_BODY) throw new Error("too_large");
      body = text ? (JSON.parse(text) as SubscribeBody) : {};
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart")) {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries()) as SubscribeBody;
    } else {
      const text = await req.text();
      body = text ? (JSON.parse(text) as SubscribeBody) : {};
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: cors });
  }

  // Honeypot — silencioso (200 OK pero no insertamos)
  const honey = body[HONEYPOT_FIELD];
  if (typeof honey === "string" && honey.trim() !== "") {
    return NextResponse.json({ ok: true, message: "Gracias" }, { status: 200, headers: cors });
  }

  // Time-trap opcional
  const csm_t = body.csm_t;
  if (csm_t !== undefined && csm_t !== null && csm_t !== "") {
    const t = Number(csm_t);
    if (Number.isFinite(t) && Date.now() - t < MIN_FORM_TIME_MS) {
      return NextResponse.json({ ok: true, message: "Gracias" }, { status: 200, headers: cors });
    }
  }

  // Resolución de workspace
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  let workspaceId: string | null = null;

  if (typeof body.workspaceId === "string" && body.workspaceId.length === 36) {
    // Confirmamos que existe (anti-injection cross-tenant)
    if (db) {
      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, body.workspaceId))
        .limit(1);
      if (ws) workspaceId = ws.id;
    }
  }

  if (!workspaceId && host) {
    workspaceId = await resolveWorkspaceIdByHost(host);
  }

  // Fallback: primer workspace (modo demo single-tenant)
  if (!workspaceId && db) {
    const [first] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
    workspaceId = first?.id ?? null;
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_unresolved" }, { status: 400, headers: cors });
  }

  // Rate limit por IP+workspace (8/h, 40/d)
  const ip = getIp(req);
  const rl = consumeSubmitRateLimit({
    ip,
    formId: `subscribe:${workspaceId}`,
    hourly: 8,
    daily: 40,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", reason: rl.reason },
      { status: 429, headers: cors },
    );
  }

  if (typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "invalid_email" }, { status: 422, headers: cors });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 10)
    : typeof body.tags === "string"
      ? body.tags
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
      : null;

  const result = await subscribe({
    workspaceId,
    email: body.email,
    name: typeof body.name === "string" ? body.name.slice(0, 200) : null,
    locale: typeof body.locale === "string" ? body.locale.slice(0, 8) : null,
    source: typeof body.source === "string" ? body.source.slice(0, 80) : "public_form",
    tags,
  });

  if (!result.ok) {
    if (result.error === "invalid_email") {
      return NextResponse.json({ error: "invalid_email" }, { status: 422, headers: cors });
    }
    return NextResponse.json({ error: "internal" }, { status: 500, headers: cors });
  }

  // Si subscribe devolvió token de confirmación, enviamos email
  if (result.confirmationToken) {
    const ws =
      db && workspaceId
        ? ((await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0] ??
          null)
        : null;
    const origin = publicOriginFromWorkspace(ws);
    const urls = buildSubscribeUrls(origin, { confirm: result.confirmationToken });

    await sendEmail({
      to: result.subscriber.email,
      subject: `Confirma tu suscripción a ${ws?.name ?? "CSM"} ✦`,
      html: renderConfirmation({
        workspaceName: ws?.name ?? "CSM",
        subscriberEmail: result.subscriber.email,
        confirmUrl: urls.confirm ?? "#",
      }),
      text: `Confirma tu suscripción a ${ws?.name ?? "CSM"}: ${urls.confirm ?? ""}`,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      created: result.created,
      needsConfirmation: !!result.confirmationToken,
      message: result.confirmationToken
        ? "Te enviamos un email para confirmar tu suscripción."
        : "Suscripción registrada.",
    },
    { status: 201, headers: cors },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function getIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}
