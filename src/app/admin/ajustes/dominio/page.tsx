/**
 * F11a — /admin/ajustes/dominio
 *
 * Página completa de gestión de URL pública. Muestra:
 *  - URL pública actual (subdomain del root domain o path-based)
 *  - Slug editable con verificación live de disponibilidad
 *  - Sección "Dominio propio" (opcional, gratis si solo subdominio)
 *  - Instrucciones DNS si root_domain está configurado
 */

import { listCustomDomains } from "@/domain/custom";
import { countWorkspaces, getRootDomain, hasRootDomain, publicUrlFor } from "@/domain/resolver";
import { env } from "@/env";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { DomainClient } from "./client";

export const metadata: Metadata = { title: "Dominio · techx" };
export const dynamic = "force-dynamic";

export default async function DomainPage() {
  const ctx = await requireWorkspace("admin");
  const [customDomains, totalWorkspaces] = await Promise.all([
    listCustomDomains(ctx.workspace.id),
    countWorkspaces(),
  ]);

  const rootDomain = getRootDomain();
  const subdomainAvailable = hasRootDomain();
  const isSingleTenant = totalWorkspaces <= 1 && !rootDomain;
  const publicUrl = publicUrlFor({
    workspaceId: ctx.workspace.id,
    workspaceSlug: ctx.workspace.slug,
    customDomain: ctx.workspace.customDomain,
    isSingleTenant,
  });
  const baseAppUrl = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dominio y URL</h1>
        <p className="text-sm text-muted-foreground">
          La dirección pública donde el mundo verá tu sitio. Tu URL gratis siempre funciona;
          conectar un dominio propio es opcional.
        </p>
      </header>

      <DomainClient
        workspaceSlug={ctx.workspace.slug}
        workspaceName={ctx.workspace.name}
        customDomainPrimary={ctx.workspace.customDomain}
        customDomains={customDomains.map((d) => ({
          id: d.id,
          domain: d.domain,
          verifyToken: d.verifyToken,
          verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
          lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
          lastCheckError: d.lastCheckError,
        }))}
        rootDomain={rootDomain}
        subdomainAvailable={subdomainAvailable}
        isSingleTenant={isSingleTenant}
        baseAppUrl={baseAppUrl}
        initialPublicUrl={publicUrl}
      />
    </div>
  );
}
