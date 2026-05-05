import { getOrCreateAnonIdSSR } from "@/ab/anon-id";
import { resolveTestsForKeys } from "@/ab/engine";
import { collectAbKeys } from "@/ab/keys";
import { extractClientIp, recordImpressionsFromMap } from "@/ab/tracking";
import { RenderLayout } from "@/blocks/render";
import { resolveLayout } from "@/blocks/resolve";
import { normalizeLayout } from "@/blocks/types";
import { LiveEditOverlay } from "@/components/public/live-edit/overlay";
import { getLiveEditState } from "@/components/public/live-edit/server";
import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { getPublishedPageByPath } from "@/lib/pages";
import { getViewerContext } from "@/payments/current-member";
import { runRedirect } from "@/redirects/runtime";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

// Páginas con paywall y personalización deben renderizarse por request
// (cookies de miembro, geo, UA). El cache se desactiva implícitamente al
// usar headers()/cookies(), pero forzamos para claridad.
export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
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
    page: { id: string; title: string; path: string; workspaceId: string };
  } | null = null;
  try {
    const ws = await getDefaultPublicWorkspace();
    if (!ws) notFound();
    const page = await getPublishedPageByPath(ws.id, path);
    if (!page) notFound();
    const layout = normalizeLayout(page.layout);
    const [ctx, viewer, anon] = await Promise.all([
      resolveLayout(ws.id, layout, { followSymbols: true }),
      getViewerContext(ws.id),
      getOrCreateAnonIdSSR(),
    ]);
    ctx.viewer = viewer;
    // Resuelve A/B tests referenciados (sticky por anon). Side-effect:
    // persiste assignments. Si DB falla, devuelve mapa vacío.
    const abKeys = collectAbKeys(layout);
    if (abKeys.length > 0) {
      try {
        const cip = extractClientIp(hdrs);
        const resolutions = await resolveTestsForKeys(ws.id, anon.anonId, abKeys, cip);
        const compact = new Map<string, { testId: string; variantId: string }>();
        for (const [k, r] of resolutions) {
          compact.set(k, { testId: r.testId, variantId: r.variantId });
        }
        ctx.abMap = compact;
        const wsId = ws.id;
        const aid = anon.anonId;
        // Off-band tracking: impressions se graban tras el flush sin
        // bloquear TTFB. `after()` ejecuta en background con runtime garantías.
        after(async () => {
          try {
            await recordImpressionsFromMap(resolutions, wsId, aid, cip);
          } catch {
            /* best-effort */
          }
        });
      } catch {
        // A/B caído → render normal con primer variant (control)
      }
    }
    pageData = {
      layout,
      ctx,
      page: { id: page.id, title: page.title, path: page.path, workspaceId: ws.id },
    };
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
  const liveEdit = await getLiveEditState(pageData.page.workspaceId, sp);
  if (liveEdit.active) pageData.ctx.editMode = true;
  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="relative isolate overflow-hidden">
        <RenderLayout layout={pageData.layout} ctx={pageData.ctx} breakpoint="desktop" />
      </main>
      {liveEdit.active ? (
        <LiveEditOverlay
          pageId={pageData.page.id}
          pagePath={pageData.page.path}
          pageTitle={pageData.page.title}
          layout={pageData.layout}
        />
      ) : null}
    </ThemeShell>
  );
}
