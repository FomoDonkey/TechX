/**
 * GET /api/email/click/{token}
 *
 * Verifica el HMAC del token (lleva url destino firmada) → registra click →
 * 302 redirect. La URL viene firmada para evitar open-redirect arbitrario
 * — sólo se redirige a hosts cuya firma coincide.
 */

import { hashIp } from "@/forms/submit";
import { recordClick } from "@/newsletter/dispatcher";
import { tokens } from "@/newsletter/tokens";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const fallback = new URL("/", req.url).toString();
  const verified = tokens.verifyClick(token);
  if (!verified) {
    return NextResponse.redirect(fallback, { status: 302 });
  }

  // Anti open-redirect adicional — el HMAC garantiza integridad pero el admin
  // que firmó pudo meter `javascript:` o `data:` por bypass del sanitizer.
  // Forzamos http(s) absolutas únicamente.
  if (!/^https?:\/\//i.test(verified.url)) {
    return NextResponse.redirect(fallback, { status: 302 });
  }

  const ip = getIp(req);
  const ipHash = ip ? hashIp(ip) : undefined;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? undefined;

  // Sólo trackeamos clicks de campaña (recipientId existe). Drips registran
  // open vía pixel pero no clicks per-enrollment todavía (F8a-2 podrá añadir
  // tabla `drip_click_events` si vale la pena). Para tipo "d" sólo redirigimos.
  if (verified.t === "c") {
    void recordClick({
      recipientId: verified.rid,
      url: verified.url,
      ipHash,
      userAgent,
    }).catch((err) => {
      console.error("[email/click] failed:", err);
    });
  }

  return NextResponse.redirect(verified.url, { status: 302 });
}

function getIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}
