import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { env, features } from "@/env";
import { getAuthorByHandle, isValidHandle } from "@/lib/authors";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// F11a: multi-tenant por Host.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  if (!features.database || !isValidHandle(handle)) return { title: "Autor" };
  const ws = await getDefaultPublicWorkspace();
  if (!ws) return { title: "Autor" };
  const found = await getAuthorByHandle(ws.id, handle);
  if (!found) return { title: "Autor no encontrado" };
  const title = `${found.author.name} · ${ws.name}`;
  const description = found.author.bio ?? `Publicaciones de ${found.author.name}`;
  return {
    title,
    description,
    alternates: { canonical: `/autor/${handle}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!features.database) notFound();
  const { handle } = await params;
  if (!isValidHandle(handle)) notFound();
  const ws = await getDefaultPublicWorkspace();
  if (!ws) notFound();
  const found = await getAuthorByHandle(ws.id, handle);
  if (!found) notFound();

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: found.author.name,
      image: found.author.image ?? undefined,
      url: `${base}/autor/${handle}`,
      sameAs: [
        found.author.website,
        found.author.twitter ? `https://twitter.com/${found.author.twitter}` : null,
      ].filter(Boolean),
      description: found.author.bio ?? undefined,
    },
  };

  return (
    <ThemeShell workspaceId={ws.id}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw <script> content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header className="flex flex-col items-center gap-3 border-b border-[color:var(--th-border)] pb-10 text-center">
          {found.author.image ? (
            <img
              src={found.author.image}
              alt={found.author.name}
              className="size-24 rounded-full ring-2 ring-[color:var(--th-border)]"
            />
          ) : (
            <span className="flex size-24 items-center justify-center rounded-full bg-[color:var(--th-surface)] text-3xl font-bold">
              {found.author.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--th-font-display)" }}
          >
            {found.author.name}
          </h1>
          {found.author.bio ? (
            <p className="max-w-prose text-[color:var(--th-fg-muted)]">{found.author.bio}</p>
          ) : null}
          {found.author.website || found.author.twitter ? (
            <div className="flex gap-3 text-sm text-[color:var(--th-brand)]">
              {found.author.website ? (
                <a
                  href={found.author.website}
                  className="hover:underline"
                  rel="noopener noreferrer"
                >
                  Web
                </a>
              ) : null}
              {found.author.twitter ? (
                <a
                  href={`https://twitter.com/${found.author.twitter}`}
                  className="hover:underline"
                  rel="noopener noreferrer"
                >
                  @{found.author.twitter}
                </a>
              ) : null}
            </div>
          ) : null}
        </header>

        <h2 className="mt-10 mb-6 text-sm uppercase tracking-[0.2em] text-[color:var(--th-fg-subtle)]">
          {found.posts.length} {found.posts.length === 1 ? "publicación" : "publicaciones"}
        </h2>
        <ul className="space-y-6">
          {found.posts.map((p) => (
            <li key={p.id} className="border-b border-[color:var(--th-border)] pb-6 last:border-0">
              <Link href={`/blog/${p.slug}`} className="group block">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--th-fg-subtle)]">
                  {p.publishedAt
                    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(p.publishedAt)
                    : ""}
                </p>
                <h3
                  className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight group-hover:text-[color:var(--th-brand)]"
                  style={{ fontFamily: "var(--th-font-display)" }}
                >
                  {p.title}
                </h3>
                {p.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-[color:var(--th-fg-muted)]">{p.excerpt}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </ThemeShell>
  );
}
