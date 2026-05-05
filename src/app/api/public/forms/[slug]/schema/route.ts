/**
 * GET /api/public/forms/[slug]/schema
 *
 * Devuelve el FormSchema sanitizado del form publicado para el renderer cliente.
 * Sin auth, con CORS abierto (a menos que el form defina allowedOrigins).
 *
 * Sanitización: incluimos honeypotFieldName (lo necesita el renderer), captcha
 * siteKey y minSubmitTimeMs. Excluimos webhookUrl, notificationEmails y
 * cualquier secret.
 */

import { getPublishedFormBySlug } from "@/forms/lib";
import type { FormSchema, FormSettings } from "@/forms/types";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const host = req.headers.get("host") ?? "";
  const workspaceId = await resolveWorkspaceIdByHost(host);
  const form = workspaceId ? await getPublishedFormBySlug(workspaceId, slug) : null;
  if (!form) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Form no encontrado o no publicado" } },
      { status: 404, headers: corsHeaders(form) },
    );
  }
  const schema = (form.schema ?? { fields: [], steps: [] }) as FormSchema;
  const settings = (form.settings ?? {}) as FormSettings;
  const publicSettings = {
    honeypotFieldName: settings.honeypotFieldName ?? "csm_company",
    minSubmitTimeMs: settings.minSubmitTimeMs ?? 1500,
    captcha: settings.captcha
      ? { provider: settings.captcha.provider, siteKey: settings.captcha.siteKey }
      : undefined,
    doubleOptIn: Boolean(settings.doubleOptIn),
  };
  return NextResponse.json(
    {
      data: {
        id: form.id,
        slug: form.slug,
        name: form.name,
        description: form.description,
        version: form.version,
        schema,
        settings: publicSettings,
      },
    },
    {
      headers: {
        ...corsHeaders(form),
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
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
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}
