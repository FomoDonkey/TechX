import { aiFeatures } from "@/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { indexCoverage } from "@/search";
import { AskChat } from "./ask-chat";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const ctx = await requireWorkspace("author");
  const coverage = await indexCoverage(ctx.workspace.id);
  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col px-4 py-6 md:px-8">
      <header className="mb-4 space-y-1">
        <h1 className="font-display text-3xl font-bold">Ask CSM</h1>
        <p className="text-sm text-muted-foreground">
          Chat RAG sobre tu contenido publicado. Cita inline ([1], [2]…) los fragmentos que usa.
          {!aiFeatures.hasAny ? (
            <span className="ml-1 rounded bg-warning/15 px-1.5 py-0.5 text-warning">
              Sin clave de IA — respuestas mock.
            </span>
          ) : null}
          {coverage.total > 0 && coverage.withEmbedding < coverage.total ? (
            <span className="ml-1 text-xs">
              · {coverage.withEmbedding}/{coverage.total} indexadas (
              <a href="/admin/buscar" className="underline">
                procesar
              </a>
              )
            </span>
          ) : null}
        </p>
      </header>
      <AskChat workspaceSlug={ctx.workspace.slug} />
    </div>
  );
}
