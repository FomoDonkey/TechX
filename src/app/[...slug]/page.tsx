import { RenderLayout } from "@/blocks/render";
import { resolveLayout } from "@/blocks/resolve";
import { normalizeLayout } from "@/blocks/types";
import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { getPublishedPageByPath } from "@/lib/pages";
import { runRedirect } from "@/redirects/runtime";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

// `revalidate = 60` da ISR on-demand. NO uso `force-static` porque la lista de
// páginas publicadas se descubre dinámicamente desde la DB (sin generateStaticParams).
export const revalidate = 60;

const SLUG_SEGMENT = /^[a-z0-9-]+$/;

/**
 * Construye un path normalizado desde los segmentos del catch-all.
 * Lowercase + valida slug-safe (a-z 0-9 -). Devuelve null si CUALQUIER segmento
 * tras lowercasing tiene caracteres no permitidos. Esto evita que el catch-all
 * intente fetchar para URLs como `/_next/...`, `/.well-known/...`, `/foo bar`,
 * encoded chars, etc. — todos van directos a 404 sin tocar DB.
 */
function pathFromSlug(slug: string[] | undefined): string | null {
  if (!slug || slug.length === 0) return "/";
  const lowered = slug.map((s) => s.toLowerCase());
  for (const seg of lowered) {
    if (!SLUG_SEGMENT.test(seg)) return null;
  }
  return `/${lowered.join("/")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = pathFromSlug(slug);
  if (!path || !features.database) return { title: "Página no encontrada" };
  try {
    const ws = await getDefaultPublicWorkspace();
    if (!ws) return { title: "Página no encontrada" };
    const page = await getPublishedPageByPath(ws.id, path);
    if (!page) return { title: "Página no encontrada" };
    return {
      title: page.seo?.title ?? `${page.title} · ${ws.name}`,
      description: page.seo?.description ?? undefined,
      openGraph: {
        title: page.seo?.title ?? page.title,
        description: page.seo?.description ?? undefined,
        images: page.seo?.ogImage ? [{ url: page.seo.ogImage }] : undefined,
        type: "website",
      },
    };
  } catch {
    return { title: "CSM" };
  }
}

export default async function PublicPageCatchAll({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const path = pathFromSlug(slug);
  if (!path || !features.database) notFound();
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  if (host) {
    // Si una regla de redirect aplica, lanza throw (no retorna). Si no, sigue.
    await runRedirect({ host, path });
  }
  let pageData: {
    layout: ReturnType<typeof normalizeLayout>;
    ctx: Awaited<ReturnType<typeof resolveLayout>>;
  } | null = null;
  try {
    const ws = await getDefaultPublicWorkspace();
    if (!ws) notFound();
    const page = await getPublishedPageByPath(ws.id, path);
    if (!page) notFound();
    const layout = normalizeLayout(page.layout);
    const ctx = await resolveLayout(ws.id, layout, { followSymbols: true });
    pageData = { layout, ctx };
  } catch (err) {
    // Re-lanza notFound() (digest NEXT_NOT_FOUND); cualquier otro error → 404
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String(err.digest).startsWith("NEXT_")
    ) {
      throw err;
    }
    notFound();
  }
  if (!pageData) notFound();
  const ws = await getDefaultPublicWorkspace();
  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="relative isolate overflow-hidden">
        <RenderLayout layout={pageData.layout} ctx={pageData.ctx} breakpoint="desktop" />
      </main>
    </ThemeShell>
  );
}
