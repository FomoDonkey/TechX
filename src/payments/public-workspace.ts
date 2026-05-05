/**
 * Resolución de workspace para rutas y páginas públicas (sin admin auth).
 * Reusable por miembros, Stripe routes, paywall render.
 *
 * Estrategia (igual que /api/public/subscribe):
 *  1) Si llega `workspaceId` explícito y existe, usa ese.
 *  2) Resuelve por host (custom domain → workspace).
 *  3) Single-tenant fallback (`CSM_SINGLE_TENANT=true` o desarrollo): primer workspace.
 *
 * En multi-tenant de producción NO hacemos fallback — devolvemos null para que
 * la ruta responda 4xx en lugar de atribuir al tenant equivocado (audit F0-F9a
 * layer 3 detectó este vector de cross-tenant attribution).
 */

import { db } from "@/db/client";
import { type Workspace, workspaces } from "@/db/schema";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { eq } from "drizzle-orm";

function isSingleTenantMode(): boolean {
  if (process.env.CSM_SINGLE_TENANT === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export async function resolvePublicWorkspace(
  req: Request,
  opts: { explicitId?: string | null } = {},
): Promise<Workspace | null> {
  if (!db) return null;

  if (opts.explicitId && /^[0-9a-f-]{36}$/.test(opts.explicitId)) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, opts.explicitId))
      .limit(1);
    if (ws) return ws;
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (host) {
    const id = await resolveWorkspaceIdByHost(host);
    if (id) {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
      if (ws) return ws;
    }
  }

  // Multi-tenant de producción: fail-closed. Single-tenant / dev: fallback al primero.
  if (!isSingleTenantMode()) {
    console.warn(
      `[resolvePublicWorkspace] host="${host || "?"}" no resolvió en producción multi-tenant — devolviendo null. Configura customDomain o CSM_SINGLE_TENANT=true.`,
    );
    return null;
  }

  const [first] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
  return first ?? null;
}

export function publicOrigin(ws: { customDomain?: string | null } | null): string {
  if (ws?.customDomain) {
    const cd = ws.customDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${cd}`;
  }
  // Lazy import para no romper si env no inicializado en edge
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
