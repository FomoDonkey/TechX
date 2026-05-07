/**
 * F11d — /admin/sitios
 *
 * Listado de los workspaces a los que pertenece el usuario. Sirve como
 * dashboard de "mis sitios" + entry point para crear uno nuevo + switch
 * directo entre ellos.
 */

import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listVerifiedDomainsByWorkspaceIds } from "@/domain/custom";
import { countWorkspaces, getRootDomain, publicUrlFor } from "@/domain/resolver";
import { listUserWorkspaces, requireWorkspace } from "@/lib/workspace";
import { ArrowRight, ExternalLink, Globe, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SwitchToButton } from "./switch-button";

export const metadata: Metadata = { title: "Mis sitios · techx" };
export const dynamic = "force-dynamic";

export default async function SitiosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await requireWorkspace("viewer");
  const memberships = await listUserWorkspaces(user.id);
  const totalWorkspaces = await countWorkspaces();
  const rootDomain = getRootDomain();
  const isSingleTenantInstance = totalWorkspaces <= 1 && !rootDomain;

  // Cargar verified custom domains de TODOS los workspaces en UNA query.
  // Prioriza el `workspaces.customDomain` (primary) si está verified;
  // si no, el primero verified.
  const wsIds = memberships.map((m) => m.workspace.id);
  const primaryByWs = new Map<string, string | null>(
    memberships.map((m) => [m.workspace.id, m.workspace.customDomain]),
  );
  const domainsByWs = await listVerifiedDomainsByWorkspaceIds({
    workspaceIds: wsIds,
    primaryByWs,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Mis sitios</h1>
          <p className="text-sm text-muted-foreground">
            Cada sitio tiene su propio contenido, branding y URL pública. Comparten esta misma
            instalación.
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/admin/sitios/nuevo">
            <Plus className="size-4" />
            Nuevo sitio
          </Link>
        </Button>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {memberships.map((m) => {
          const isCurrent = m.workspace.id === ctx.workspace.id;
          const verifiedDomain = domainsByWs.get(m.workspace.id) ?? null;
          const url = publicUrlFor({
            workspaceId: m.workspace.id,
            workspaceSlug: m.workspace.slug,
            customDomain: verifiedDomain,
            isSingleTenant: isSingleTenantInstance,
          });
          return (
            <li
              key={m.workspace.id}
              className={`rounded-xl border bg-card p-4 transition${
                isCurrent ? " border-primary/40 ring-1 ring-primary/20" : ""
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-sm font-bold text-white">
                    {m.workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{m.workspace.name}</h3>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {m.workspace.slug}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {m.role}
                  </Badge>
                  {isCurrent && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                      Activo
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-3 flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1.5 font-mono text-[11px]">
                <Globe className="size-3 flex-shrink-0 text-muted-foreground" />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate hover:text-foreground"
                >
                  {url}
                </a>
                <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-end gap-2">
                {!isCurrent && <SwitchToButton slug={m.workspace.slug} />}
                <Button
                  asChild
                  size="sm"
                  variant={isCurrent ? "default" : "ghost"}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Link href={isCurrent ? "/admin" : "/admin/ajustes/dominio"}>
                    {isCurrent ? "Ir al dashboard" : "Ajustes"}
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {memberships.length === 1 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <Plus className="mx-auto mb-2 size-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">¿Necesitas otro sitio?</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Cada sitio es totalmente independiente. Puedes tener un blog personal, un portfolio y un
            sitio de cliente, todos aquí.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/sitios/nuevo">
              <Plus className="size-3.5" />
              Crear nuevo sitio
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
