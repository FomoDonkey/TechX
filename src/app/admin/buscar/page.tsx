import { embedFeatures } from "@/ai/embeddings";
import { aiFeatures } from "@/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { hybridSearch, indexCoverage } from "@/search";
import { ReindexBar } from "./reindex-bar";
import { SearchForm } from "./search-form";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; scope?: string }>;
};

export default async function AdminSearchPage(props: SearchPageProps) {
  const sp = await props.searchParams;
  const ctx = await requireWorkspace("author");
  const q = (sp.q ?? "").trim();
  const scope = sp.scope === "published" ? "published" : "all";

  const [results, coverage] = await Promise.all([
    q
      ? hybridSearch({
          workspaceId: ctx.workspace.id,
          query: q,
          scope,
          limit: 25,
        })
      : Promise.resolve([]),
    indexCoverage(ctx.workspace.id),
  ]);

  const coveragePct =
    coverage.total > 0 ? Math.round((coverage.withEmbedding / coverage.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Búsqueda híbrida</h1>
        <p className="text-sm text-muted-foreground">
          Combina BM25 (Postgres FTS) y similitud vectorial (pgvector) con Reciprocal Rank Fusion.
          {aiFeatures.hasAny ? null : (
            <>
              {" "}
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning">
                Sin clave de IA detectada — la parte semántica usa un embedding mock determinista.
              </span>
            </>
          )}
        </p>
      </header>

      <SearchForm initialQuery={q} initialScope={scope} />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm">
        <span className="font-medium">Cobertura del índice:</span>
        <span className="text-muted-foreground">
          {coverage.withEmbedding} / {coverage.total} ({coveragePct}%)
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${coveragePct}%` }} />
        </div>
        <ReindexBar />
        <span className="ml-auto text-xs text-muted-foreground">
          Embeddings:{" "}
          {embedFeatures.hasOpenai ? "OpenAI text-embedding-3-small" : "mock determinista"} ·{" "}
          {embedFeatures.dims} dims
        </span>
      </div>

      {q ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {results.length} resultado{results.length === 1 ? "" : "s"} para "{q}"
          </h2>
          {results.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              Sin resultados. Prueba a relajar la consulta o procesa los embeddings pendientes.
            </div>
          ) : (
            <ul className="space-y-3">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card/60"
                >
                  <a href={`/admin/contenido/${r.id}`} className="block space-y-1.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-semibold">{r.title}</h3>
                      <span className="text-[11px] text-muted-foreground">/{r.slug}</span>
                      <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                        FTS {r.ftsRank.toFixed(2)} · vec {r.vectorScore.toFixed(2)} · score{" "}
                        <strong className="text-foreground">{r.score.toFixed(2)}</strong>
                      </span>
                    </div>
                    {r.snippet ? (
                      <p
                        className="text-sm leading-relaxed text-muted-foreground"
                        // ts_headline ya envuelve <mark>...</mark>; sanitizamos en hybridSearch
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: snippet escapado y solo permite <mark>
                        dangerouslySetInnerHTML={{ __html: r.snippet }}
                      />
                    ) : r.excerpt ? (
                      <p className="text-sm text-muted-foreground">{r.excerpt}</p>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/20 p-8 text-center text-sm text-muted-foreground">
          Escribe una consulta arriba. Soporta operadores estilo Google: comillas para frase exacta,
          <code className="mx-1 rounded bg-muted/40 px-1">-palabra</code> para excluir,
          <code className="mx-1 rounded bg-muted/40 px-1">OR</code> para alternativa.
        </div>
      )}
    </div>
  );
}
