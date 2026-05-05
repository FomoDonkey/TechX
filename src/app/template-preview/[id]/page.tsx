import "@/templates/showcase/_lib/styles.css";
import { requireUser } from "@/auth/server";
import { RenderLayout } from "@/blocks/render";
import type { RenderContext } from "@/blocks/types";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";
import { getShowcase } from "@/templates/showcase";
import { getPageTemplate } from "@/templates/page-templates";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DemoCursor } from "./demo-cursor";

export const metadata: Metadata = {
  title: "Template preview",
  robots: { index: false, follow: false },
};

/**
 * Renderiza una plantilla — usando primero el **showcase component** custom
 * (full-spectacle al nivel motionsites.ai), o haciendo fallback al render
 * block-based si no hay showcase para ese id.
 *
 * Auth: editor+ del workspace (mismo gate que la galería).
 */
export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const ctx = await requireWorkspace("editor");
  const { id } = await params;
  const template = getPageTemplate(id);
  if (!template) notFound();

  const Showcase = getShowcase(id);
  if (Showcase) {
    return (
      <main className="csm-template-preview min-h-screen overflow-x-hidden">
        <DemoCursor />
        <Showcase />
      </main>
    );
  }

  // Fallback: block render con tema CSS vars del template.
  const layout = template.buildLayout();
  const renderCtx: RenderContext = {
    workspaceId: ctx.workspace.id,
    mediaMap: new Map(),
    symbolMap: new Map(),
    bypassGates: true,
    editMode: false,
  };
  const themeStyle = template.theme.vars as CSSProperties;

  return (
    <main
      className={cn(
        "csm-template-preview min-h-screen overflow-x-hidden bg-background text-foreground",
        template.theme.bodyClass,
      )}
      style={themeStyle}
    >
      <DemoCursor />
      <RenderLayout layout={layout} ctx={renderCtx} breakpoint="desktop" />
    </main>
  );
}
