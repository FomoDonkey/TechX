/**
 * GET /api/public/forms/[slug]/confirm?token=...
 *
 * Endpoint público que confirma una submission con double-opt-in.
 * Devuelve HTML simple (este enlace se abre desde un email).
 */

import { getPublishedFormBySlug } from "@/forms/lib";
import { confirmSubmission } from "@/forms/submit";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const host = req.headers.get("host") ?? "";
  const workspaceId = await resolveWorkspaceIdByHost(host);
  const form = workspaceId ? await getPublishedFormBySlug(workspaceId, slug) : null;
  if (!form) return htmlResponse("Form no encontrado", 404);

  if (!token) return htmlResponse("Falta el token de confirmación", 400);

  const result = await confirmSubmission(token);
  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid_token: "El enlace de confirmación es inválido",
      expired: "El enlace de confirmación ha caducado",
      not_found: "No se encontró la submission",
      internal: "Error interno",
    };
    return htmlResponse(messages[result.reason] ?? "No se pudo confirmar", 400);
  }
  const message = result.alreadyConfirmed
    ? "Ya habías confirmado este envío. ¡Gracias!"
    : "¡Confirmado! Tu envío ya está activo.";
  return htmlResponse(message, 200);
}

function htmlResponse(message: string, status: number): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>CSM</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0a14;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:480px;width:100%;background:linear-gradient(160deg,#1a1228,#0c0a14);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:40px;text-align:center}
    .badge{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#c08bff;margin-bottom:16px}
    h1{font-size:22px;margin:0 0 12px;background:linear-gradient(120deg,#9b5cff,#ff5db1);-webkit-background-clip:text;background-clip:text;color:transparent}
    p{color:#b8b3c7;line-height:1.6;margin:0}
  </style></head>
  <body><div class="card"><div class="badge">CSM · Confirmación</div><h1>${escapeHtml(message)}</h1><p>Ya puedes cerrar esta ventana.</p></div></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
