import { db } from "@/db/client";
import { editorialCalendarTokens, members } from "@/db/schema";
import { buildCalendarFeed, findTokenRecord } from "@/editorial";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Feed iCal personal. Auth via secret token query param (?token=...).
 * No requiere session — los clientes iCal (Google Cal, Apple Cal) no manejan
 * cookies. El token es revocable rotándolo.
 *
 * Seguridad (F9c.8a fix C1): además de validar el token, comprobamos que el
 * usuario sigue siendo miembro del workspace. Si dejó de serlo (kick/leave),
 * borramos el token y devolvemos 403 — el token deja de funcionar para siempre.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || !TOKEN_RE.test(token)) {
    return new Response("Missing or invalid token", { status: 401 });
  }
  const record = await findTokenRecord(token);
  if (!record) return new Response("Token revoked", { status: 403 });

  // Verificar membership viva.
  if (db) {
    const [m] = await db
      .select({ ws: members.workspaceId })
      .from(members)
      .where(and(eq(members.workspaceId, record.workspaceId), eq(members.userId, record.userId)))
      .limit(1);
    if (!m) {
      // El usuario ya no es miembro: revocamos el token defensivamente.
      await db
        .delete(editorialCalendarTokens)
        .where(
          and(
            eq(editorialCalendarTokens.workspaceId, record.workspaceId),
            eq(editorialCalendarTokens.userId, record.userId),
          ),
        );
      return new Response("Membership revoked", { status: 403 });
    }
  }

  // Range: -7 días a +90 días (ventana razonable para clientes iCal).
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 7);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 90);

  const baseUrl = `${url.protocol}//${url.host}`;
  const ics = await buildCalendarFeed(record, { from, to }, baseUrl);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'inline; filename="csm-editorial.ics"',
    },
  });
}
