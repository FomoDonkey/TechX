import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { getTagPosts, isValidTagSlug } from "@/lib/tags";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// F11a: multi-tenant por Host.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!features.database || !isValidTagSlug(slug)) return { title: "Etiqueta" };
  const ws = await getDefaultPublicWorkspace();
  if (!ws) return { title: "Etiqueta" };
  const found = await getTagPosts(ws.id, slug);
  if (!found) return { title: "Etiqueta no encontrada" };
  const title = `${found.term.name} · ${ws.name}`;
  return {
    title,
    description: `Publicaciones etiquetadas con ${found.term.name}`,
    alternates: { canonical: `/tag/${slug}` },
    openGraph: { title, type: "website" },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!features.database) notFound();
  const { slug } = await params;
  if (!isValidTagSlug(slug)) notFound();
  const ws = await getDefaultPublicWorkspace();
  if (!ws) notFound();
  const found = await getTagPosts(ws.id, slug);
  if (!found) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Publicaciones de ${found.term.name}`,
    hasPart: found.posts.map((p) => ({
      "@type": "Article",
      headline: p.title,
      datePublished: p.publishedAt?.toISOString(),
    })),
  };

  return (
    <ThemeShell workspaceId={ws.id}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw <script> content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <header className="mb-10 flex flex-col gap-2 border-b border-[color:var(--th-border)] pb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--th-fg-subtle)]">
            {found.term.type === "category" ? "Categoría" : "Etiqueta"}
          </p>
          <h1
            className="text-3xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--th-font-display)" }}
          >
            #{found.term.name}
          </h1>
          <p className="text-[color:var(--th-fg-muted)]">
            {found.posts.length} {found.posts.length === 1 ? "publicación" : "publicaciones"}
          </p>
        </header>

        {found.posts.length === 0 ? (
          <p className="rounded-[var(--th-radius-xl)] border border-dashed border-[color:var(--th-border)] p-10 text-center text-[color:var(--th-fg-muted)]">
            Aún no hay publicaciones con esta etiqueta.
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {found.posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="group block h-full rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-6 transition-all hover:border-[color:var(--th-brand)] hover:shadow-[var(--th-shadow-lg)]"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                    {p.publishedAt
                      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
                          p.publishedAt,
                        )
                      : ""}
                  </p>
                  <h2
                    className="mt-2 text-2xl font-semibold leading-tight tracking-tight group-hover:text-[color:var(--th-brand)]"
                    style={{ fontFamily: "var(--th-font-display)" }}
                  >
                    {p.title}
                  </h2>
                  {p.excerpt ? (
                    <p className="mt-2 line-clamp-3 text-[color:var(--th-fg-muted)]">{p.excerpt}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ThemeShell>
  );
}
