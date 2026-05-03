/**
 * Resolución de workspace para rutas y páginas públicas (sin admin auth).
 * Reusable por miembros, Stripe routes, paywall render.
 *
 * Estrategia (igual que /api/public/subscribe):
 *  1) Si llega `workspaceId` explícito y existe, usa ese.
 *  2) Resuelve por host (custom domain → workspace).
 *  3) Fallback al primer workspace (modo demo single-tenant).
 */

import { db } from "@/db/client";
import { type Workspace, workspaces } from "@/db/schema";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { eq } from "drizzle-orm";

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

  // Fallback al primer workspace. En multi-tenant de producción esto puede
  // atribuir checkouts/portal al tenant equivocado si el host no resuelve.
  // Documentamos con un warn — single-tenant deployments pueden ignorarlo.
  const [first] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
  if (first && process.env.NODE_ENV === "production") {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "?";
    console.warn(
      `[resolvePublicWorkspace] Fallback al primer workspace (host="${host}" no resolvió). Configura customDomain en el workspace correcto si es multi-tenant.`,
    );
  }
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
