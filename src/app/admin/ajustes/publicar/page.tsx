/**
 * F11b — /admin/ajustes/publicar
 *
 * Wizard "publicar al mundo": detecta el estado del deploy actual y guía
 * al usuario por los pasos restantes para que su sitio sea visible desde
 * internet.
 *
 * Estados:
 *  - LOCAL: te ofrece 4 plataformas (Vercel/Railway/Render/self-host)
 *  - DEPLOYED: te confirma que ya estás público + opción dominio propio
 */

import { listCustomDomains } from "@/domain/custom";
import { getDeployState, suggestDeployTargets } from "@/domain/deploy-state";
import { publicUrlFor } from "@/domain/resolver";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { PublishClient } from "./client";

export const metadata: Metadata = { title: "Publicar al mundo · techx" };
export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const ctx = await requireWorkspace("admin");

  const customDomains = await listCustomDomains(ctx.workspace.id);
  const verifiedDomain = customDomains.find((d) => d.verifiedAt) ?? null;

  const state = await getDeployState({
    workspaceId: ctx.workspace.id,
    workspaceSlug: ctx.workspace.slug,
    customDomain: verifiedDomain?.domain,
  });

  // Si está deployado, mostramos la URL canónica del deploy host (la que verá
  // el visitante). Si está en local, mostramos la `/s/<slug>` para preview
  // pero el wizard insistirá en que mueva a un host real.
  const liveUrl = state.deployHost
    ? `https://${state.deployHost}`
    : publicUrlFor({
        workspaceId: ctx.workspace.id,
        workspaceSlug: ctx.workspace.slug,
        customDomain: verifiedDomain?.domain,
        isSingleTenant: true,
      });

  const targets = suggestDeployTargets({
    // Cuando el usuario clone CSM, quizá tenga un fork. De momento, link
    // genérico — podemos añadir auto-detect del repo en F11c.
    repoUrl: process.env.CSM_REPO_URL,
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Publicar al mundo</h1>
        <p className="text-sm text-muted-foreground">
          Tu sitio existe — falta que sea accesible desde internet. Aquí están los pasos para que
          cualquiera lo vea desde su PC, móvil o tablet, 24/7.
        </p>
      </header>

      <PublishClient
        state={state}
        liveUrl={liveUrl}
        verifiedDomain={verifiedDomain?.domain ?? null}
        targets={targets}
        workspaceSlug={ctx.workspace.slug}
        workspaceName={ctx.workspace.name}
      />
    </div>
  );
}
