import { ThemeShell } from "@/components/public/theme-shell";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { hybridSearch } from "@/search";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Buscar",
    description: "Búsqueda semántica en el contenido publicado",
    robots: { index: false },
  };
}

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

export default async function PublicSearch(props: SearchPageProps) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const ws = await getDefaultPublicWorkspace();
  if (!ws) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Buscar</h1>
        <p className="mt-2 text-muted-foreground">No hay workspace público configurado.</p>
      </main>
    );
  }
  const results = q
    ? await hybridSearch({ workspaceId: ws.id, query: q, scope: "published", limit: 20 })
    : [];

  return (
    <ThemeShell workspaceId={ws.id}>
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight">Buscar</h1>
        <form action="/buscar" method="get" className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="¿Qué buscas?"
              className="w-full rounded-full border border-border bg-card py-3 pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </form>

        {q ? (
          <section className="mt-8">
            <p className="mb-4 text-sm text-muted-foreground">
              {results.length} resultado{results.length === 1 ? "" : "s"} para "{q}"
            </p>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-muted-foreground">
                Nada por aquí. Prueba con otras palabras.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {results.map((r) => (
                  <li key={r.id} className="py-5">
                    <a href={`/blog/${r.slug}`} className="block group">
                      <h2 className="text-xl font-semibold group-hover:text-primary">{r.title}</h2>
                      {r.snippet ? (
                        <p
                          className="mt-1 text-sm text-muted-foreground"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: snippet escapado y solo permite <mark>
                          dangerouslySetInnerHTML={{ __html: r.snippet }}
                        />
                      ) : r.excerpt ? (
                        <p className="mt-1 text-sm text-muted-foreground">{r.excerpt}</p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {r.publishedAt ? (
                          <time dateTime={new Date(r.publishedAt).toISOString()}>
                            {new Date(r.publishedAt).toLocaleDateString("es-ES")}
                          </time>
                        ) : null}
                        {r.authorName ? <span>· {r.authorName}</span> : null}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Empieza a escribir. La búsqueda combina coincidencia textual y similitud semántica.
          </p>
        )}
      </main>
    </ThemeShell>
  );
}
