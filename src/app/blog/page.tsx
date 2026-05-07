import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace, listPublishedPostsForWorkspace } from "@/lib/entries";
import { resolveActiveTheme } from "@/themes/active";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

function quickReadingTime(text: string | null): number {
  if (!text) return 3;
  const words = text.trim().split(/\s+/).length;
  // excerpt approximates ~5% of full post → multiply ×6 for total
  return Math.max(1, Math.round((words * 6) / 220));
}

// F11a: multi-tenant por Host del request — el contenido depende del workspace
// resuelto en `getDefaultPublicWorkspace()`. No es cacheable globalmente.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog",
  description: "Últimas publicaciones",
};

export default async function BlogIndex() {
  if (!features.database) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Blog</h1>
        <p className="mt-3 text-muted-foreground">
          Conecta una base de datos para publicar contenido.
        </p>
      </main>
    );
  }

  const ws = await getDefaultPublicWorkspace();
  if (!ws) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Aún no hay blogs publicados</h1>
        <p className="mt-3 text-muted-foreground">Crea tu cuenta y comparte tu primer post.</p>
        <Link
          href="/registro"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] px-5 py-3 text-sm font-medium text-white shadow-md"
        >
          Empezar <ArrowRight className="size-4" />
        </Link>
      </main>
    );
  }

  const posts = await listPublishedPostsForWorkspace(ws.slug, 60);
  const { spec } = await resolveActiveTheme(ws.id);
  const layout = spec.layouts.list;
  const isFeed = layout === "feed-chrono";
  const cols = layout === "grid-3" ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <ThemeShell workspaceId={ws.id} override={spec}>
      <PublicNav workspace={ws} />
      <main className="mx-auto px-4 py-12 md:py-20" style={{ maxWidth: "var(--th-container-max)" }}>
        <header className="mb-10 flex flex-col items-start gap-3 md:mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--th-radius-pill)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] px-3 py-1 text-xs font-medium text-[color:var(--th-fg-muted)]">
            <Sparkles className="size-3" /> {ws.name}
          </span>
          <h1
            className="text-4xl font-bold leading-tight tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--th-font-display)" }}
          >
            Blog
          </h1>
          <p className="text-lg text-[color:var(--th-fg-muted)]">
            {posts.length === 0
              ? "Aún no hay posts publicados."
              : `${posts.length} ${posts.length === 1 ? "publicación" : "publicaciones"} recientes.`}
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-[var(--th-radius-xl)] border border-dashed border-[color:var(--th-border)] p-10 text-center text-[color:var(--th-fg-muted)]">
            Sigue volviendo — pronto habrá contenido aquí.
          </div>
        ) : isFeed ? (
          <ul className="space-y-8 border-t border-[color:var(--th-border)]">
            {posts.map((p) => {
              const reading = quickReadingTime(p.excerpt);
              return (
                <li key={p.id} className="border-b border-[color:var(--th-border)] pb-8">
                  <Link href={`/blog/${p.slug}`} className="group block">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                      {p.publishedAt
                        ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
                            new Date(p.publishedAt),
                          )
                        : ""}
                      <span className="mx-2">·</span>
                      {reading} min
                    </p>
                    <h2
                      className="mt-2 text-3xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-[color:var(--th-brand)]"
                      style={{ fontFamily: "var(--th-font-display)" }}
                    >
                      {p.title}
                    </h2>
                    {p.excerpt ? (
                      <p
                        className="mt-3 line-clamp-3 text-[color:var(--th-fg-muted)]"
                        style={{ fontFamily: "var(--th-font-serif)" }}
                      >
                        {p.excerpt}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className={`grid gap-6 ${cols}`}>
            {posts.map((p) => {
              const reading = quickReadingTime(p.excerpt);
              return (
                <li key={p.id}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="group block h-full rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-6 transition-all hover:border-[color:var(--th-brand)] hover:shadow-[var(--th-shadow-lg)]"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                      {p.publishedAt
                        ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
                            new Date(p.publishedAt),
                          )
                        : ""}
                      <span className="mx-2">·</span>
                      {reading} min
                    </p>
                    <h2
                      className="mt-2 text-2xl font-semibold leading-tight tracking-tight group-hover:text-[color:var(--th-brand)]"
                      style={{ fontFamily: "var(--th-font-display)" }}
                    >
                      {p.title}
                    </h2>
                    {p.excerpt ? (
                      <p className="mt-2 line-clamp-3 text-[color:var(--th-fg-muted)]">
                        {p.excerpt}
                      </p>
                    ) : null}
                    <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--th-brand)]">
                      Leer{" "}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </ThemeShell>
  );
}
