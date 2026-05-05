/**
 * Iframe-frame del page builder.
 *
 * Esta ruta se carga DENTRO de un `<iframe>` en el editor del page builder
 * (`/admin/paginas/[id]`). Sirve para que el preview por dispositivo
 * (móvil/tablet/escritorio) tenga su propio viewport — los breakpoints
 * Tailwind `md:`, `lg:` responden al ancho del iframe, no al de la ventana
 * del editor. Es decir: lo que ve el usuario al hacer clic en "móvil" es
 * exactamente lo que verá un visitante real en su móvil.
 *
 * Flujo de actualización en vivo:
 *  - El iframe carga la layout inicial desde la BD (último guardado).
 *  - El parent (page-builder) emite cambios via BroadcastChannel
 *    `csm:builder:${pageId}` con `{ type: "layout", layout, breakpoint }`.
 *  - Un client wrapper dentro del iframe escucha y re-renderiza.
 *  - Clicks en bloques del iframe se postMessage-an al parent para
 *    sincronizar la selección.
 */

import { requireUser } from "@/auth/server";
import { BuilderFrameClient } from "@/components/admin/builder/builder-frame-client";
import { getPageById } from "@/lib/pages";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Builder frame",
  robots: { index: false, follow: false },
};

export default async function BuilderFramePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  await requireUser();
  const ctx = await requireWorkspace("editor");
  const { pageId } = await params;
  if (!isUuid(pageId)) notFound();
  const page = await getPageById(ctx.workspace.id, pageId);
  if (!page) notFound();

  const layout = Array.isArray(page.layout) ? (page.layout as unknown[]) : [];

  return (
    <BuilderFrameClient pageId={pageId} workspaceId={ctx.workspace.id} initialLayout={layout} />
  );
}
