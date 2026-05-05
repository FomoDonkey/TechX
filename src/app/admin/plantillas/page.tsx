import { requireUser } from "@/auth/server";
import { requireWorkspace } from "@/lib/workspace";
import { PAGE_TEMPLATES, TEMPLATE_CATEGORIES } from "@/templates/page-templates";
import type { Metadata } from "next";
import { TemplatesGallery } from "./gallery";

export const metadata: Metadata = { title: "Plantillas de página" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  await requireWorkspace("editor");
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;

  const summary = PAGE_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    accent: t.accent,
    tags: t.tags,
    suggestedTitle: t.suggestedTitle,
    blockCount: t.buildLayout().length,
  }));

  return (
    <div className="relative isolate min-h-screen">
      {/* Aurora background sutil — solo en /plantillas */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(155,92,255,0.18),transparent)] blur-3xl" />
        <div className="absolute top-1/3 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,93,177,0.14),transparent)] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(64,200,255,0.12),transparent)] blur-3xl" />
      </div>

      <TemplatesGallery templates={summary} categories={TEMPLATE_CATEGORIES} errorMsg={errorMsg} />
    </div>
  );
}
