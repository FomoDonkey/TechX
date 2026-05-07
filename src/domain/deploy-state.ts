/**
 * F11b — Detección del estado de deploy de la instancia CSM.
 *
 * Determina si la instancia está corriendo en local, en Vercel, en otro
 * hosting cloud, o en un servidor self-hosted. Útil para que la pantalla
 * de publicación adapte sus pasos al estado real del usuario.
 *
 * Detección por env vars (no DNS lookup, no calls externos):
 *   - `VERCEL === "1"`            → corriendo dentro de Vercel
 *   - `RAILWAY_ENVIRONMENT`        → Railway
 *   - `RENDER`                     → Render
 *   - `FLY_APP_NAME`               → Fly.io
 *   - host = `localhost`           → dev local
 *   - resto                        → self-host genérico
 */

import { db } from "@/db/client";
import { workspaceDomains } from "@/db/schema";
import { hasRootDomain } from "@/domain/resolver";
import { and, eq, isNotNull } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";

export type DeployHost = "vercel" | "railway" | "render" | "fly" | "self-hosted" | "local";

export type DeployState = {
  /** Plataforma donde corre CSM, detectada por env vars. */
  host: DeployHost;
  /** Hostname del request actual (puede no ser la URL canónica del deploy). */
  currentHost: string;
  /** Hostname canónico del deploy (de Vercel, etc.) si lo conocemos. */
  deployHost: string | null;
  /** True si la instancia es accesible desde internet (no localhost). */
  isPublic: boolean;
  /** Sub-checks del checklist del wizard. */
  checks: DeployCheck[];
};

export type DeployCheck = {
  id: "database" | "slug" | "domain-free" | "domain-custom" | "live";
  label: string;
  done: boolean;
  hint?: string;
};

export async function getDeployState(args: {
  workspaceId: string;
  workspaceSlug: string;
  customDomain?: string | null;
}): Promise<DeployState> {
  const hdrs = await nextHeaders();
  const currentHost = hdrs.get("host") ?? "";
  const hostnameOnly = currentHost.split(":")[0]?.toLowerCase() ?? "";

  let host: DeployHost = "self-hosted";
  let deployHost: string | null = null;

  // Solo confiamos en `VERCEL=1` etc. cuando el hostname también es coherente.
  // Si el user tiene `VERCEL=1` en `.env.local` (copiado de prod por error)
  // pero corre en localhost, NO queremos decirle "estás en Vercel".
  const isLoopbackHost =
    !hostnameOnly ||
    hostnameOnly === "localhost" ||
    hostnameOnly === "127.0.0.1" ||
    hostnameOnly.startsWith("192.168.") ||
    hostnameOnly.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostnameOnly);

  if (process.env.VERCEL === "1" && !isLoopbackHost) {
    host = "vercel";
    // VERCEL_URL es el preview/prod URL canónico de Vercel (sin protocolo).
    deployHost = process.env.VERCEL_URL ?? null;
  } else if (process.env.RAILWAY_ENVIRONMENT && !isLoopbackHost) {
    host = "railway";
    deployHost = process.env.RAILWAY_PUBLIC_DOMAIN ?? null;
  } else if (process.env.RENDER === "true" && !isLoopbackHost) {
    host = "render";
    deployHost = process.env.RENDER_EXTERNAL_URL?.replace(/^https?:\/\//, "") ?? null;
  } else if (process.env.FLY_APP_NAME && !isLoopbackHost) {
    host = "fly";
    deployHost = `${process.env.FLY_APP_NAME}.fly.dev`;
  } else if (isLoopbackHost) {
    host = "local";
  }

  const isPublic = host !== "local";

  // Comprueba si existe algún custom domain verificado para este workspace.
  let hasVerifiedDomain = false;
  if (db) {
    const [hit] = await db
      .select({ id: workspaceDomains.id })
      .from(workspaceDomains)
      .where(
        and(
          eq(workspaceDomains.workspaceId, args.workspaceId),
          isNotNull(workspaceDomains.verifiedAt),
        ),
      )
      .limit(1);
    hasVerifiedDomain = Boolean(hit);
  }

  const checks: DeployCheck[] = [
    {
      id: "database",
      label: "Base de datos conectada",
      done: Boolean(db),
      hint: db ? undefined : "Configura DATABASE_URL en tu .env y ejecuta `npm run db:push`.",
    },
    {
      id: "slug",
      label: "Identificador del sitio elegido",
      done: Boolean(args.workspaceSlug),
    },
    {
      id: "domain-free",
      label: "URL pública gratis activa",
      done: isPublic, // si es local, no es realmente pública
      hint: isPublic
        ? undefined
        : "Sube CSM a un servidor (Vercel, Railway, etc.) para que tu URL sea accesible desde internet.",
    },
    {
      id: "live",
      label: "Sitio visible desde otro PC del mundo",
      done: isPublic,
      hint: isPublic ? "Cualquiera con la URL puede verlo." : undefined,
    },
    {
      id: "domain-custom",
      label: "Dominio propio conectado (opcional)",
      done: hasVerifiedDomain || Boolean(args.customDomain),
      hint: "Compra un dominio (~10€/año) y conéctalo si quieres una URL bonita.",
    },
  ];

  return { host, currentHost, deployHost, isPublic, checks };
}

/**
 * Sugiere plataformas de deploy según el estado detectado. La UI las muestra
 * como cards 1-click. Vercel siempre va primero porque es la más amistosa
 * para Next.js (que es lo que CSM usa).
 */
export type DeployTarget = {
  id: "vercel" | "railway" | "render" | "self-host";
  name: string;
  tagline: string;
  cost: string;
  rec: boolean;
  /**
   * URL de "1-click deploy" si la plataforma la ofrece. Para Vercel, requiere
   * que el repo esté en GitHub público. Si no se conoce, devolvemos el link
   * genérico a `vercel.com/new`.
   */
  ctaUrl: string;
  ctaLabel: string;
};

export function suggestDeployTargets(opts?: { repoUrl?: string }): DeployTarget[] {
  const repoUrl = opts?.repoUrl;
  return [
    {
      id: "vercel",
      name: "Vercel",
      tagline: "El camino más corto. 0€ con plan Hobby.",
      cost: "Gratis hasta 100 GB de tráfico/mes",
      rec: true,
      ctaUrl: repoUrl
        ? `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoUrl)}`
        : "https://vercel.com/new",
      ctaLabel: "Deploy en Vercel",
    },
    {
      id: "railway",
      name: "Railway",
      tagline: "Buen balance UX/precio. Tier de prueba gratis.",
      cost: "Gratis ~$5 crédito inicial",
      rec: false,
      ctaUrl: "https://railway.app/new",
      ctaLabel: "Crear proyecto",
    },
    {
      id: "render",
      name: "Render",
      tagline: "Free tier eterno. Servicios 'duermen' tras inactividad.",
      cost: "Gratis (cold starts)",
      rec: false,
      ctaUrl: "https://render.com/",
      ctaLabel: "Crear servicio",
    },
    {
      id: "self-host",
      name: "Tu propio servidor",
      tagline: "Docker en tu VPS. Control total.",
      cost: "Desde 4€/mes (Hetzner)",
      rec: false,
      ctaUrl: "/admin/ajustes/publicar/self-host",
      ctaLabel: "Ver instrucciones",
    },
  ];
}

/**
 * Re-export utilidades del resolver para que la página `/admin/ajustes/publicar`
 * pueda mostrar la URL pública sin importar de varios sitios.
 */
export { hasRootDomain };
