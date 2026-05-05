/**
 * POST /api/public/forms/[slug]/submit
 *
 * Endpoint público para envíos. Sin auth — protegido por:
 *  - Rate limit por IP (token bucket en memoria, hourly + daily)
 *  - Honeypot field
 *  - Time-trap (csm_t)
 *  - Spam scoring heurístico
 *  - Captcha opcional (hCaptcha/Turnstile)
 *  - CORS allowedOrigins opcional
 *
 * Body: form-encoded o JSON. Limit 256 KB.
 */

import { getPublishedFormBySlug } from "@/forms/lib";
import { consumeSubmitRateLimit } from "@/forms/rate-limit";
import { getDefaultRateLimits, hashIp, processSubmission } from "@/forms/submit";
import type { FormSettings } from "@/forms/types";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  // Resolver workspace por host evita cross-tenant lookup: dos workspaces
  // pueden tener forms con el mismo slug ("contact") y sin host check
  // resolvía cualquiera. F0-F9a audit catch.
  const host = req.headers.get("host") ?? "";
  const workspaceId = await resolveWorkspaceIdByHost(host);
  if (!workspaceId) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Form no encontrado" } },
      { status: 404, headers: corsHeaders(null) },
    );
  }
  const form = await getPublishedFormBySlug(workspaceId, slug);
  if (!form) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Form no encontrado" } },
      { status: 404, headers: corsHeaders(null) },
    );
  }

  // Body parsing — JSON o form-encoded
  const contentType = req.headers.get("content-type") ?? "";
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY) {
    return NextResponse.json(
      { error: { code: "payload_too_large", message: "Body demasiado grande" } },
      { status: 413, headers: corsHeaders(form) },
    );
  }

  let raw: Record<string, unknown>;
  try {
    if (contentType.includes("application/json")) {
      const text = await req.text();
      if (text.length > MAX_BODY) throw new Error("payload_too_large");
      raw = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      if (text.length > MAX_BODY) throw new Error("payload_too_large");
      raw = formDecodeMultivalue(new URLSearchParams(text));
    } else if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      raw = formDataToObject(fd);
    } else {
      const text = await req.text();
      if (text.length > MAX_BODY) throw new Error("payload_too_large");
      raw = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid_body";
    if (msg === "payload_too_large") {
      return NextResponse.json(
        { error: { code: "payload_too_large", message: "Body demasiado grande" } },
        { status: 413, headers: corsHeaders(form) },
      );
    }
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Body inválido" } },
      { status: 400, headers: corsHeaders(form) },
    );
  }

  // Rate limit por IP
  const ip = getIp(req);
  const rl = getDefaultRateLimits((form.settings ?? {}) as FormSettings);
  const rlResult = consumeSubmitRateLimit({
    ip,
    formId: form.id,
    hourly: rl.hourly,
    daily: rl.daily,
  });
  if (!rlResult.ok) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: `Has superado el límite ${rlResult.reason === "daily" ? "diario" : "horario"}`,
        },
      },
      { status: 429, headers: corsHeaders(form) },
    );
  }

  // Extracción de metadata técnicas
  const tValue = raw.csm_t;
  const formLoadedAt =
    typeof tValue === "string" || typeof tValue === "number" ? Number(tValue) : undefined;
  const captchaToken = typeof raw.csm_captcha === "string" ? raw.csm_captcha : undefined;
  const utm = extractUtm(raw);

  const out = await processSubmission({
    form,
    raw,
    ip,
    ipHash: hashIp(ip),
    userAgent: req.headers.get("user-agent") ?? undefined,
    referer: req.headers.get("referer") ?? undefined,
    country: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? undefined,
    origin: req.headers.get("origin") ?? undefined,
    formLoadedAt: Number.isFinite(formLoadedAt) ? (formLoadedAt as number) : undefined,
    captchaToken,
    utm,
  });

  switch (out.kind) {
    case "ok":
      return NextResponse.json(
        {
          ok: true,
          submissionId: out.submissionId,
          status: out.status,
          needsConfirmation: out.needsConfirmation,
          message: form.successMessage ?? "¡Gracias!",
          ...(form.redirectUrl ? { redirectUrl: form.redirectUrl } : {}),
        },
        { status: 201, headers: corsHeaders(form) },
      );
    case "duplicate":
      // Anti info-leak: NO devolvemos `submissionId` ni `duplicate: true` para
      // no revelar a un atacante que un email/dato ya estaba registrado en el
      // formulario. La response es indistinguible de un success.
      return NextResponse.json(
        {
          ok: true,
          message: form.successMessage ?? "¡Gracias!",
        },
        { status: 200, headers: corsHeaders(form) },
      );
    case "spam":
      // Devolvemos 200 para no revelar al spammer que detectamos.
      return NextResponse.json(
        { ok: true, message: form.successMessage ?? "¡Gracias!" },
        { status: 200, headers: corsHeaders(form) },
      );
    case "honeypot_dropped":
      // Idem, 200 silencioso.
      return NextResponse.json(
        { ok: true, message: form.successMessage ?? "¡Gracias!" },
        { status: 200, headers: corsHeaders(form) },
      );
    case "validation_error":
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Hay campos inválidos",
            issues: out.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
              code: i.code,
            })),
          },
        },
        { status: 422, headers: corsHeaders(form) },
      );
    case "captcha_failed":
      return NextResponse.json(
        { error: { code: "captcha_failed", message: "Captcha no superado" } },
        { status: 422, headers: corsHeaders(form) },
      );
    case "origin_blocked":
      return NextResponse.json(
        { error: { code: "origin_blocked", message: "Origen no permitido" } },
        { status: 403, headers: corsHeaders(form) },
      );
    case "rate_limited":
      return NextResponse.json(
        {
          error: {
            code: "rate_limited",
            message: `Has superado el límite ${out.reason === "daily" ? "diario" : "horario"}`,
          },
        },
        { status: 429, headers: corsHeaders(form) },
      );
    default:
      return NextResponse.json(
        { error: { code: "internal_error", message: "Error interno" } },
        { status: 500, headers: corsHeaders(form) },
      );
  }
}

export async function OPTIONS(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const host = req.headers.get("host") ?? "";
  const workspaceId = await resolveWorkspaceIdByHost(host);
  const form = workspaceId ? await getPublishedFormBySlug(workspaceId, slug) : null;
  return new Response(null, { status: 204, headers: corsHeaders(form) });
}

function corsHeaders(form: { settings?: unknown } | null): Record<string, string> {
  const settings = (form?.settings ?? {}) as FormSettings;
  const origins = settings.allowedOrigins ?? ["*"];
  const allow = origins.includes("*") ? "*" : origins.join(", ");
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function formDecodeMultivalue(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(Array.from(params.keys()))) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(Array.from(fd.keys()))) {
    const values = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return out;
}

function extractUtm(raw: Record<string, unknown>): Record<string, string> | undefined {
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = raw[k];
    if (typeof v === "string" && v.length > 0 && v.length < 200) utm[k] = v;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}
