/**
 * F11a — Resolución multi-tenant del workspace público a partir de la
 * petición HTTP. Decide qué workspace renderiza una URL pública según:
 *
 *   1. **Custom domain**: si `Host` matchea un workspaceDomains.domain
 *      verificado → ese workspace.
 *   2. **Subdomain del root**: si `Host = <slug>.<ROOT_DOMAIN>` → workspace
 *      cuyo slug coincida.
 *   3. **Path-based**: si la URL empieza por `/s/<slug>/...` (cabecera
 *      `x-csm-path-slug` la inyecta el middleware) → workspace por slug.
 *   4. **Single-tenant fallback**: si en la instancia hay UN solo
 *      workspace → ese (UX trivial para self-host de un usuario).
 *   5. **Histórico**: si el slug usado fue el slug viejo de un workspace
 *      (workspace_slug_history < 30d), devolver el actual con
 *      `redirectCanonical` apuntando al nuevo URL.
 *
 * Las páginas públicas (`/`, `/[...slug]`, `/blog`, `/autor/[handle]`,
 * `/tag/[slug]`, `/buscar`, `/suscribir/*`, `/comentarios`) llaman a
 * `resolvePublicWorkspace()`. Si devuelve `redirectCanonical`, llaman a
 * `redirect()`. Si devuelve null, `notFound()`.
 *
 * El middleware (edge) NO consulta la DB — solo reescribe `/s/<slug>` a
 * `/`+header. La consulta DB ocurre aquí, en runtime Node de SSR.
 */

import { db } from "@/db/client";
import { type Workspace, workspaceDomains, workspaceSlugHistory, workspaces } from "@/db/schema";
import { env } from "@/env";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";

export type ResolvedWorkspace = {
  workspace: Workspace;
  /** Identifica cómo se resolvió. Útil para construir URLs canónicas. */
  via: "custom-domain" | "subdomain" | "path" | "single-tenant";
  /**
   * Si el slug en la URL pertenecía al historial (rename reciente), aquí
   * va la URL canónica destino. Las páginas DEBEN llamar a `redirect()`
   * con este valor en lugar de renderizar.
   */
  redirectCanonical?: string;
};

/**
 * Llamable desde server components/route handlers. Lee las cabeceras del
 * request actual y resuelve. No throws; devuelve null si no hay match.
 */
export async function resolvePublicWorkspaceFromRequest(): Promise<ResolvedWorkspace | null> {
  const hdrs = await nextHeaders();
  return resolvePublicWorkspace({
    host: hdrs.get("host"),
    pathSlug: hdrs.get("x-csm-path-slug"),
    pathname: hdrs.get("x-csm-pathname"),
    proto: hdrs.get("x-forwarded-proto"),
  });
}

export type ResolveInput = {
  host: string | null;
  /** Slug extraído por el middleware del prefijo `/s/<slug>` (si aplica). */
  pathSlug: string | null;
  /** Pathname original ANTES del rewrite del middleware (para construir
   * redirect canónico). En path-based: `/s/<slug>/blog`. */
  pathname: string | null;
  /** `http` | `https`. */
  proto: string | null;
};

export async function resolvePublicWorkspace(
  input: ResolveInput,
): Promise<ResolvedWorkspace | null> {
  if (!db) return null;

  const hostnameOnly = (input.host ?? "").split(":")[0]?.toLowerCase() ?? "";
  const proto = input.proto === "https" ? "https" : "http";
  const port = (input.host ?? "").includes(":") ? `:${(input.host ?? "").split(":")[1]}` : "";

  // ── 1) Custom domain ─────────────────────────────────────────
  if (hostnameOnly) {
    const ws = await findWorkspaceByCustomDomain(hostnameOnly);
    if (ws) return { workspace: ws, via: "custom-domain" };
  }

  // ── 2) Subdomain del ROOT_DOMAIN ─────────────────────────────
  const rootDomain = (env.ROOT_DOMAIN ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0];
  if (
    rootDomain &&
    hostnameOnly &&
    hostnameOnly !== rootDomain &&
    hostnameOnly.endsWith(`.${rootDomain}`)
  ) {
    const sub = hostnameOnly.slice(0, hostnameOnly.length - rootDomain.length - 1);
    if (sub && !sub.includes(".")) {
      const ws = await findWorkspaceBySlug(sub);
      if (ws) return { workspace: ws, via: "subdomain" };
      const old = await findWorkspaceByOldSlug(sub);
      if (old) {
        const canonical = `${proto}://${old.slug}.${rootDomain}${port}${input.pathname ?? "/"}`;
        return { workspace: old, via: "subdomain", redirectCanonical: canonical };
      }
    }
  }

  // ── 3) Path-based `/s/<slug>/...` ────────────────────────────
  if (input.pathSlug) {
    const slug = input.pathSlug.toLowerCase();
    const ws = await findWorkspaceBySlug(slug);
    if (ws) return { workspace: ws, via: "path" };
    const old = await findWorkspaceByOldSlug(slug);
    if (old) {
      // El pathname original es `/s/<oldslug>/<rest>` — sustituye solo el slug.
      const original = input.pathname ?? `/s/${slug}/`;
      const rest = original.replace(/^\/s\/[a-z0-9-]+/, "");
      const canonical = `/s/${old.slug}${rest || "/"}`;
      return { workspace: old, via: "path", redirectCanonical: canonical };
    }
    return null;
  }

  // ── 4) Single-tenant fallback ────────────────────────────────
  // Si hay UN solo workspace en la instancia, asume ése. Hace que un
  // self-host de 1 usuario funcione sin configurar nada en hosts donde
  // SÍ controlamos la URL: localhost, IP privada, o el deploy host
  // canónico (vercel.app, fly.dev, etc.). En cualquier OTRO host
  // (`evil.com` apuntando a nuestra IP), NO aplicamos fallback —
  // proteger del host hijacking en multi-tenant.
  if (canApplySingleTenantFallback(hostnameOnly)) {
    const all = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .orderBy(asc(workspaces.createdAt))
      .limit(2);
    if (all.length === 1) {
      const [first] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, all[0]!.id))
        .limit(1);
      if (first) return { workspace: first, via: "single-tenant" };
    }
  }

  return null;
}

/**
 * Decide si el `hostnameOnly` actual es "trusted" para aplicar single-tenant
 * fallback. Trusted = controlamos esa URL:
 *  - `localhost`, `127.0.0.1` (dev local)
 *  - IPs privadas (`10.*`, `192.168.*`, `172.16-31.*`)
 *  - host vacío (curl sin Host)
 *  - Deploy hosts auto-asignados por hosting: `*.vercel.app`, `*.fly.dev`,
 *    `*.up.railway.app`, `*.onrender.com`, `*.netlify.app`, `*.pages.dev`.
 *
 * NO aplicamos fallback en hosts arbitrarios (`evil.com` que apunta a nuestra
 * IP por DNS hijacking) — eso permitiría servir nuestro contenido bajo su
 * dominio, lo que es un risk de phishing/defacement.
 */
function canApplySingleTenantFallback(hostnameOnly: string): boolean {
  if (!hostnameOnly) return true;
  if (hostnameOnly === "localhost" || hostnameOnly === "127.0.0.1") return true;
  // IPv4 privadas
  if (/^10\./.test(hostnameOnly)) return true;
  if (/^192\.168\./.test(hostnameOnly)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostnameOnly)) return true;
  if (/^169\.254\./.test(hostnameOnly)) return true; // APIPA
  // Deploy hosts canónicos
  if (hostnameOnly.endsWith(".vercel.app")) return true;
  if (hostnameOnly.endsWith(".fly.dev")) return true;
  if (hostnameOnly.endsWith(".up.railway.app")) return true;
  if (hostnameOnly.endsWith(".onrender.com")) return true;
  if (hostnameOnly.endsWith(".netlify.app")) return true;
  if (hostnameOnly.endsWith(".pages.dev")) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// Lookups DB (helpers internos)
// ─────────────────────────────────────────────────────────────

async function findWorkspaceByCustomDomain(domain: string): Promise<Workspace | null> {
  if (!db) return null;
  // Verificación: el dominio debe estar en `workspace_domains` con
  // `verifiedAt IS NOT NULL`. NO se permite resolver dominios sin
  // verificar — si aceptamos, cualquiera podría apuntar su DNS a
  // nuestra IP y servir contenido como si fuera nuestro.
  const [hit] = await db
    .select({
      ws: workspaces,
    })
    .from(workspaceDomains)
    .innerJoin(workspaces, eq(workspaces.id, workspaceDomains.workspaceId))
    .where(and(eq(workspaceDomains.domain, domain), isNotNull(workspaceDomains.verifiedAt)))
    .limit(1);
  return hit?.ws ?? null;
}

async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  if (!db) return null;
  const [hit] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return hit ?? null;
}

async function findWorkspaceByOldSlug(oldSlug: string): Promise<Workspace | null> {
  if (!db) return null;
  // Solo los renames de los últimos 30 días son válidos. Evita que un
  // slug "liberado" hace tiempo siga capturando tráfico al workspace
  // antiguo.
  const [hit] = await db
    .select({ ws: workspaces })
    .from(workspaceSlugHistory)
    .innerJoin(workspaces, eq(workspaces.id, workspaceSlugHistory.workspaceId))
    .where(
      and(
        eq(workspaceSlugHistory.oldSlug, oldSlug),
        gt(workspaceSlugHistory.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return hit?.ws ?? null;
}

// ─────────────────────────────────────────────────────────────
// URL building (público)
// ─────────────────────────────────────────────────────────────

/**
 * Construye la URL pública canónica de un workspace según la config global.
 * Prioridad: custom domain verificado > subdomain.ROOT_DOMAIN > path-based en
 * NEXT_PUBLIC_APP_URL.
 *
 * Útil en `/admin/ajustes/dominio` y enlaces "compartir" (`/admin` dashboard,
 * notificaciones, emails de campañas, etc.).
 */
export type PublicUrlInput = {
  workspaceId: string;
  workspaceSlug: string;
  /** Custom domain verificado (si lo tiene). Pasarlo evita una query extra. */
  customDomain?: string | null;
  /** Append este path (default "/"). */
  path?: string;
  /**
   * Si en la instancia hay UN solo workspace, el resolver ya hace single-tenant
   * fallback en `/`. La UI no debe mostrar `/s/<slug>` porque sería más larga
   * que la URL real funcional. Pasar `true` para devolver la URL "limpia"
   * sin prefijo path-based.
   */
  isSingleTenant?: boolean;
};

export function publicUrlFor(input: PublicUrlInput): string {
  const path = normalizePath(input.path);
  if (input.customDomain) {
    return `https://${input.customDomain}${path}`;
  }
  const rootDomain = (env.ROOT_DOMAIN ?? "").toLowerCase().replace(/^https?:\/\//, "");
  if (rootDomain) {
    // Si root incluye :port (dev) lo respetamos.
    const proto = rootDomain.startsWith("localhost") ? "http" : "https";
    return `${proto}://${input.workspaceSlug}.${rootDomain}${path}`;
  }
  const base = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // Single-tenant fallback: el resolver sirve el único workspace en `/`, así
  // que la URL canónica es la base sin prefijo.
  if (input.isSingleTenant) {
    return `${base}${path}`;
  }
  // Multi-tenant sin root domain: path-based bajo NEXT_PUBLIC_APP_URL.
  return `${base}/s/${input.workspaceSlug}${path === "/" ? "" : path}`;
}

/**
 * Cuenta workspaces totales en la instancia (cap a 2 — solo necesitamos saber
 * si es single-tenant o no). Útil para que la UI decida si mostrar URL bare
 * o con prefijo `/s/<slug>`.
 */
export async function countWorkspaces(): Promise<number> {
  if (!db) return 0;
  const rows = await db.select({ id: workspaces.id }).from(workspaces).limit(2);
  return rows.length;
}

function normalizePath(p: string | undefined): string {
  if (!p || p === "") return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Devuelve true si la instancia ofrece subdominios automáticos (hay
 * `ROOT_DOMAIN` configurado). Lo consume la UI para mostrar el preview
 * `<slug>.<root>` o el preview `<base>/s/<slug>` según corresponda.
 */
export function hasRootDomain(): boolean {
  return Boolean((env.ROOT_DOMAIN ?? "").trim());
}

export function getRootDomain(): string | null {
  const r = (env.ROOT_DOMAIN ?? "").toLowerCase().replace(/^https?:\/\//, "");
  return r || null;
}
