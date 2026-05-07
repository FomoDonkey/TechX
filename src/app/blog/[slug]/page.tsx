import { CommentsSection } from "@/components/public/comments-section";
import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { env } from "@/env";
import { features } from "@/env";
import { getDefaultPublicWorkspace, getPublishedPostBySlug } from "@/lib/entries";
import { buildToc, readingTimeMinutes, renderDoc } from "@/lib/render-doc";
import { resolveActiveTheme } from "@/themes/active";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// F11a: multi-tenant por Host. Ver nota en src/app/blog/page.tsx.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!features.database) return { title: "Blog" };
  const ws = await getDefaultPublicWorkspace();
  if (!ws) return { title: "Blog" };
  const { slug } = await params;
  const found = await getPublishedPostBySlug(ws.slug, slug);
  if (!found) return { title: "No encontrado" };
  const { entry } = found;
  const title = entry.seo?.title ?? entry.title;
  const description = entry.seo?.description ?? entry.excerpt ?? "Publicado en CSM";
  const ogUrl = entry.seo?.ogImage
    ? entry.seo.ogImage
    : `${env.NEXT_PUBLIC_APP_URL}/api/og/article/${entry.id}`;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${entry.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/blog/${entry.slug}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: entry.title }],
      publishedTime: entry.publishedAt?.toISOString(),
      modifiedTime: entry.updatedAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!features.database) notFound();
  const ws = await getDefaultPublicWorkspace();
  if (!ws) notFound();
  const { slug } = await params;
  const found = await getPublishedPostBySlug(ws.slug, slug);
  if (!found) notFound();
  const { entry, workspaceName } = found;

  const toc = buildToc(entry.body);
  const reading = readingTimeMinutes(entry.bodyText ?? "");
  const dateLabel = entry.publishedAt
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(entry.publishedAt))
    : "";
  const { spec } = await resolveActiveTheme(ws.id);
  const post = spec.layouts.post;
  const showToc = spec.layouts.showToc && toc.length > 2;
  const showReading = spec.layouts.showReadingTime;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.title,
    description: entry.seo?.description ?? entry.excerpt ?? undefined,
    datePublished: entry.publishedAt?.toISOString(),
    dateModified: entry.updatedAt.toISOString(),
    image: entry.seo?.ogImage,
    publisher: { "@type": "Organization", name: workspaceName },
    mainEntityOfPage: { "@type": "WebPage", "@id": `/blog/${entry.slug}` },
  };

  const containerClass =
    post === "narrow"
      ? "mx-auto max-w-2xl px-4 pt-10 pb-24 md:px-6"
      : post === "magazine"
        ? "mx-auto max-w-4xl px-4 pt-10 pb-24 md:px-8"
        : post === "wide"
          ? "mx-auto max-w-5xl px-4 pt-10 pb-24 md:px-8"
          : post === "docs"
            ? "mx-auto max-w-7xl px-4 pt-10 pb-24 md:px-8 grid gap-10 lg:grid-cols-[1fr,260px]"
            : "mx-auto max-w-3xl px-4 pt-10 pb-24 md:px-8";

  return (
    <ThemeShell workspaceId={ws.id} override={spec}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw <script> content; we escape '<' to neutralise injection
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PublicNav workspace={ws} />
      <main className={containerClass}>
        <div>
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-1 text-sm text-[color:var(--th-fg-muted)] hover:text-[color:var(--th-fg)]"
          >
            ← Volver al blog
          </Link>
          <header className="border-b border-[color:var(--th-border)] pb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--th-fg-subtle)]">
              {workspaceName} · {dateLabel}
              {showReading ? <> · {reading} min lectura</> : null}
            </p>
            <h1
              className={
                post === "magazine"
                  ? "mt-3 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl"
                  : "mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl"
              }
              style={{ fontFamily: "var(--th-font-display)" }}
            >
              {entry.title}
            </h1>
            {entry.excerpt ? (
              <p
                className="mt-4 text-lg text-[color:var(--th-fg-muted)] md:text-xl"
                style={{ fontFamily: post === "narrow" ? "var(--th-font-serif)" : undefined }}
              >
                {entry.excerpt}
              </p>
            ) : null}
          </header>

          {showToc && post !== "docs" ? (
            <nav className="my-8 rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] p-5">
              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                Índice
              </p>
              <ul className="space-y-1.5 text-sm">
                {toc.map((it) => (
                  <li
                    key={it.id}
                    className="text-[color:var(--th-fg-muted)] hover:text-[color:var(--th-fg)]"
                    style={{ paddingLeft: `${(it.level - 2) * 12}px` }}
                  >
                    <a href={`#${it.id}`}>{it.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <article
            className="mt-6"
            style={
              post === "narrow"
                ? { fontFamily: "var(--th-font-serif)" }
                : post === "magazine"
                  ? { fontFamily: "var(--th-font-serif)" }
                  : undefined
            }
          >
            {renderDoc(entry.body)}
          </article>

          <CommentsSection entryId={entry.id} slug={entry.slug} />

          {spec.layouts.showSubscribeCta ? (
            <aside className="mt-16 rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] p-8 text-center">
              <h3
                className="text-2xl font-semibold tracking-tight"
                style={{ fontFamily: "var(--th-font-display)" }}
              >
                Suscríbete a {workspaceName}
              </h3>
              <p className="mt-2 text-[color:var(--th-fg-muted)]">
                Recibe nuevas publicaciones en tu bandeja.
              </p>
              <Link
                href="/suscribir"
                className="mt-5 inline-flex items-center gap-2 rounded-[var(--th-radius-pill)] bg-[color:var(--th-brand)] px-5 py-2.5 text-sm font-medium text-[color:var(--th-brand-fg)] shadow-[var(--th-shadow-md)] transition-transform hover:scale-[1.02]"
              >
                Suscribirme
              </Link>
            </aside>
          ) : (
            <footer className="mt-16 border-t border-[color:var(--th-border)] pt-8 text-sm text-[color:var(--th-fg-muted)]">
              <p>
                ¿Te ha gustado?{" "}
                <Link href="/blog" className="text-[color:var(--th-brand)] hover:underline">
                  Mira más posts de {workspaceName}
                </Link>
                .
              </p>
            </footer>
          )}
        </div>
        {post === "docs" && toc.length > 0 ? (
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                En esta página
              </p>
              <ul className="space-y-1.5 text-sm">
                {toc.map((it) => (
                  <li
                    key={it.id}
                    className="text-[color:var(--th-fg-muted)] hover:text-[color:var(--th-fg)]"
                    style={{ paddingLeft: `${(it.level - 2) * 12}px` }}
                  >
                    <a href={`#${it.id}`}>{it.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}
      </main>
    </ThemeShell>
  );
}
