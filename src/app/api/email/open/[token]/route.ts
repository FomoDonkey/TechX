/**
 * GET /api/email/open/{token}.gif
 *
 * Pixel transparente 1x1. Verifica HMAC, registra `open` en email_events e
 * incrementa contadores. Sin cache (clientes de email cachean imágenes en su
 * proxy igualmente, así que no es 100% preciso — es la realidad de email).
 */

import { hashIp } from "@/forms/submit";
import { recordOpen } from "@/newsletter/dispatcher";
import { tokens } from "@/newsletter/tokens";

export const dynamic = "force-dynamic";

// 1x1 GIF transparente
const GIF_BYTES = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cleanToken = token.replace(/\.(gif|png)$/i, "");

  const verified = tokens.verifyOpen(cleanToken);
  if (!verified) {
    return imgResponse();
  }

  const ip = getIp(req);
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? undefined;
  const ipHash = ip ? hashIp(ip) : undefined;

  // El token discrimina por `t`: "c" = campaign-recipient, "d" = drip-enrollment.
  // Sin discriminator antes podíamos doble-contar si UUIDs coincidían.
  const dispatch =
    verified.t === "d"
      ? recordOpen({ enrollmentId: verified.rid, ipHash, userAgent: ua })
      : recordOpen({ recipientId: verified.rid, ipHash, userAgent: ua });

  void dispatch.catch((err) => {
    console.error("[email/open] failed:", err);
  });

  return imgResponse();
}

function imgResponse(): Response {
  return new Response(GIF_BYTES, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF_BYTES.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function getIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}
