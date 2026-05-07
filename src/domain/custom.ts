/**
 * F11a — Gestión de dominios custom para un workspace.
 *
 * Flujo de verificación:
 *   1. `addCustomDomain(ws, "miblog.com")` → genera token, INSERT pending.
 *   2. UI muestra al usuario:
 *        - CNAME `<domain>` → `<ROOT_DOMAIN>` (o IP si self-host)
 *        - TXT  `_csm-verify.<domain>` → `<token>`  (alternativa offline)
 *   3. Usuario configura DNS en su registrador.
 *   4. `verifyCustomDomain(ws, "miblog.com")` hace DNS lookup. Si CNAME
 *      apunta al root o si TXT contiene el token → marca `verifiedAt`.
 *   5. A partir de ese momento, el resolver acepta `Host: miblog.com`.
 *
 * SSL: no lo gestionamos nosotros — depende del hosting. En Vercel se
 * añade el dominio en su API y ellos provisionan Let's Encrypt; en
 * self-host, Caddy/Traefik con on-demand TLS lo hace solo. En la UI lo
 * documentamos pero no automatizamos en este bloque.
 */

import { db } from "@/db/client";
import { type WorkspaceDomain, workspaceDomains, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { validateCustomDomain } from "./slug";

export type AddDomainResult =
  | { ok: true; domain: WorkspaceDomain }
  | { ok: false; reason: AddDomainError };

export type AddDomainError =
  | "invalid"
  | "ip_address"
  | "too_long"
  | "taken"
  | "db_disabled"
  | "already_added";

function generateVerifyToken(): string {
  // 32 chars hex (16 bytes) — suficiente entropía para evitar colisiones de
  // verificación en TXT records y no es secreto crítico (público para que
  // el visitante pueda verificar la verificación si quisiera).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function addCustomDomain(args: {
  workspaceId: string;
  domain: string;
  actorId: string;
}): Promise<AddDomainResult> {
  if (!db) return { ok: false, reason: "db_disabled" };

  const v = validateCustomDomain(args.domain);
  if (!v.ok) {
    if (v.error === "ip_address") return { ok: false, reason: "ip_address" };
    if (v.error === "too_long") return { ok: false, reason: "too_long" };
    return { ok: false, reason: "invalid" };
  }
  const domain = v.domain ?? "";

  // ¿Ya hay alguna fila con ese domain (mismo o distinto workspace)?
  const [taken] = await db
    .select()
    .from(workspaceDomains)
    .where(eq(workspaceDomains.domain, domain))
    .limit(1);
  if (taken) {
    if (taken.workspaceId === args.workspaceId) {
      // Ya añadido por este workspace — devolvemos la fila existente.
      return { ok: false, reason: "already_added" };
    }
    return { ok: false, reason: "taken" };
  }

  const token = generateVerifyToken();
  const id = crypto.randomUUID();
  await db.insert(workspaceDomains).values({
    id,
    workspaceId: args.workspaceId,
    domain,
    verifyToken: token,
  });

  // Sincronizamos el "primary" custom domain en workspaces.customDomain SOLO
  // si está vacío. Si ya tiene uno, dejamos el field como está y este nuevo
  // queda como secundario hasta que el user lo "promueva".
  const [ws] = await db
    .select({ customDomain: workspaces.customDomain })
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId))
    .limit(1);
  if (ws && !ws.customDomain) {
    await db
      .update(workspaces)
      .set({ customDomain: domain, updatedAt: new Date() })
      .where(eq(workspaces.id, args.workspaceId));
  }

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    action: "domain.add",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { domain },
  });

  const [row] = await db
    .select()
    .from(workspaceDomains)
    .where(eq(workspaceDomains.id, id))
    .limit(1);
  if (!row) return { ok: false, reason: "db_disabled" }; // no debería pasar
  return { ok: true, domain: row };
}

export async function listCustomDomains(workspaceId: string): Promise<WorkspaceDomain[]> {
  if (!db) return [];
  return db.select().from(workspaceDomains).where(eq(workspaceDomains.workspaceId, workspaceId));
}

/**
 * Devuelve un Map<workspaceId, primaryVerifiedDomain | null> para la lista
 * de workspaces dada. Usado en `/admin/sitios` para mostrar la URL pública
 * de cada sitio sin hacer N queries separadas.
 *
 * Si un workspace tiene múltiples verified domains, prioriza el que esté
 * marcado como primary en `workspaces.customDomain`. Si ninguno matchea,
 * devuelve el primero.
 */
export async function listVerifiedDomainsByWorkspaceIds(args: {
  workspaceIds: string[];
  primaryByWs: Map<string, string | null>;
}): Promise<Map<string, string | null>> {
  if (!db || args.workspaceIds.length === 0) {
    return new Map(args.workspaceIds.map((id) => [id, null]));
  }
  const rows = await db
    .select({
      workspaceId: workspaceDomains.workspaceId,
      domain: workspaceDomains.domain,
      verifiedAt: workspaceDomains.verifiedAt,
    })
    .from(workspaceDomains)
    .where(
      and(
        inArray(workspaceDomains.workspaceId, args.workspaceIds),
        isNotNull(workspaceDomains.verifiedAt),
      ),
    );

  const byWs = new Map<string, string[]>();
  for (const r of rows) {
    const list = byWs.get(r.workspaceId) ?? [];
    list.push(r.domain);
    byWs.set(r.workspaceId, list);
  }

  const result = new Map<string, string | null>();
  for (const wsId of args.workspaceIds) {
    const verified = byWs.get(wsId) ?? [];
    if (verified.length === 0) {
      result.set(wsId, null);
      continue;
    }
    const primary = args.primaryByWs.get(wsId);
    // Si el primary está verified, lo preferimos. Si no, el primero.
    if (primary && verified.includes(primary)) {
      result.set(wsId, primary);
    } else {
      result.set(wsId, verified[0] ?? null);
    }
  }
  return result;
}

export async function removeCustomDomain(args: {
  workspaceId: string;
  domainId: string;
  actorId: string;
}): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  const [row] = await db
    .select()
    .from(workspaceDomains)
    .where(
      and(
        eq(workspaceDomains.id, args.domainId),
        eq(workspaceDomains.workspaceId, args.workspaceId),
      ),
    )
    .limit(1);
  if (!row) return { ok: false };

  await db.delete(workspaceDomains).where(eq(workspaceDomains.id, args.domainId));

  // Si era el primary, lo limpiamos del workspace.
  const [ws] = await db
    .select({ customDomain: workspaces.customDomain })
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId))
    .limit(1);
  if (ws && ws.customDomain === row.domain) {
    await db
      .update(workspaces)
      .set({ customDomain: null, updatedAt: new Date() })
      .where(eq(workspaces.id, args.workspaceId));
  }

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    action: "domain.remove",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { domain: row.domain },
  });

  return { ok: true };
}

export type VerifyResult =
  | { ok: true; domain: WorkspaceDomain }
  | { ok: false; reason: VerifyError };

export type VerifyError =
  | "not_found"
  | "already_verified"
  | "dns_lookup_failed"
  | "no_record_match"
  | "db_disabled";

/**
 * Resuelve el dominio vía Node DNS. Acepta dos métodos:
 *   - CNAME `<domain>` → ROOT_DOMAIN (o cualquier subdominio del root).
 *   - TXT   `_csm-verify.<domain>` → `<verifyToken>`.
 *
 * Suficiente con UN método. Esto permite que self-host sin ROOT_DOMAIN
 * configurado pueda verificar via TXT.
 */
export async function verifyCustomDomain(args: {
  workspaceId: string;
  domainId: string;
  actorId: string;
}): Promise<VerifyResult> {
  if (!db) return { ok: false, reason: "db_disabled" };
  const [row] = await db
    .select()
    .from(workspaceDomains)
    .where(
      and(
        eq(workspaceDomains.id, args.domainId),
        eq(workspaceDomains.workspaceId, args.workspaceId),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.verifiedAt) return { ok: true, domain: row };

  const expectedToken = row.verifyToken;
  const checkResult = await checkDomainDns(row.domain, expectedToken);

  await db
    .update(workspaceDomains)
    .set({
      lastCheckedAt: new Date(),
      lastCheckError: checkResult.ok ? null : checkResult.reason,
      ...(checkResult.ok ? { verifiedAt: new Date() } : {}),
    })
    .where(eq(workspaceDomains.id, args.domainId));

  if (!checkResult.ok) {
    return { ok: false, reason: checkResult.reason };
  }

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    action: "domain.verified",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { domain: row.domain, method: checkResult.method },
  });

  const [updated] = await db
    .select()
    .from(workspaceDomains)
    .where(eq(workspaceDomains.id, args.domainId))
    .limit(1);
  return { ok: true, domain: updated ?? row };
}

async function checkDomainDns(
  domain: string,
  expectedToken: string,
): Promise<{ ok: true; method: "txt" | "cname" } | { ok: false; reason: VerifyError }> {
  // import dinámico para mantener edge-friendly imports (el resolver y
  // el validador NO deben arrastrar `dns/promises` en builds que no lo usan).
  let dns: typeof import("dns/promises") | null = null;
  try {
    dns = await import("node:dns/promises");
  } catch {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  const DNS_TIMEOUT_MS = 4000;
  const withTimeout = <T>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("dns_timeout")), DNS_TIMEOUT_MS),
      ),
    ]);

  // 1) TXT en `_csm-verify.<domain>`
  try {
    const records = await withTimeout(dns.resolveTxt(`_csm-verify.${domain}`));
    const flat = records.flat().map((s) => s.trim());
    if (flat.some((s) => s === expectedToken)) {
      return { ok: true, method: "txt" };
    }
  } catch {
    /* TXT no existe → seguimos con CNAME */
  }

  // 2) CNAME apuntando al ROOT_DOMAIN, a un subdominio del root, o al
  //    deploy host canónico de ESTA instancia (Vercel/Fly/Railway).
  //
  // Importante: NO aceptamos `cname.vercel-dns.com` genérico — es un host
  // compartido entre TODOS los proyectos Vercel; cualquiera que lo configure
  // como CNAME en su DNS pasaría verify aunque su dominio NO apunte a
  // nuestro deploy. Para Vercel hay que matchear contra `VERCEL_URL`
  // específico de esta instancia.
  try {
    const cname = await withTimeout(dns.resolveCname(domain));
    const root = (process.env.ROOT_DOMAIN ?? "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(":")[0];
    const ourVercel = (process.env.VERCEL_URL ?? "").toLowerCase().split(":")[0];
    const ourFly = process.env.FLY_APP_NAME ? `${process.env.FLY_APP_NAME}.fly.dev` : "";
    const ourRailway = (process.env.RAILWAY_PUBLIC_DOMAIN ?? "").toLowerCase();
    const trustedTargets = [ourVercel, ourFly, ourRailway].filter(Boolean) as string[];
    if (cname.length > 0) {
      const flat = cname.map((c) => c.toLowerCase());
      if (root && flat.some((c) => c === root || c.endsWith(`.${root}`))) {
        return { ok: true, method: "cname" };
      }
      if (flat.some((c) => trustedTargets.includes(c))) {
        return { ok: true, method: "cname" };
      }
    }
  } catch {
    /* CNAME no existe / timeout / A record */
  }

  return { ok: false, reason: "no_record_match" };
}
