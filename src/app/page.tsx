import { getOrCreateAnonIdSSR } from "@/ab/anon-id";
import { resolveTestsForKeys } from "@/ab/engine";
import { collectAbKeys } from "@/ab/keys";
import { extractClientIp, recordImpressionsFromMap } from "@/ab/tracking";
import { RenderLayout } from "@/blocks/render";
import { resolveLayout } from "@/blocks/resolve";
import { normalizeLayout } from "@/blocks/types";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { CTA } from "@/components/marketing/cta";
import { Features } from "@/components/marketing/features";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { MarketingNav } from "@/components/marketing/nav";
import { Roadmap } from "@/components/marketing/roadmap";
import { Stack } from "@/components/marketing/stack";
import { WhyCSM as WhyTechx } from "@/components/marketing/why";
import { LiveEditOverlay } from "@/components/public/live-edit/overlay";
import { getLiveEditState } from "@/components/public/live-edit/server";
import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import type { Workspace } from "@/db/schema";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { getPublishedHome, getPublishedPageByPath } from "@/lib/pages";
import { getViewerContext } from "@/payments/current-member";
import { runRedirect } from "@/redirects/runtime";
import { headers } from "next/headers";
import { after } from "next/server";

// Si la home tiene paywall/personalización, debe renderizarse por request.
export const dynamic = "force-dynamic";

async function resolveHomePage(): Promise<{
  layout: ReturnType<typeof normalizeLayout>;
  ctx: Awaited<ReturnType<typeof resolveLayout>>;
  ws: Workspace;
  page: { id: string; title: string; path: string; workspaceId: string };
} | null> {
  if (!features.database) return null;
  try {
    const ws = await getDefaultPublicWorkspace();
    if (!ws) return null;
    const home = (await getPublishedHome(ws.id)) ?? (await getPublishedPageByPath(ws.id, "/"));
    if (!home) return null;
    const layout = normalizeLayout(home.layout);
    const [ctx, viewer, anon] = await Promise.all([
      resolveLayout(ws.id, layout, { followSymbols: true }),
      getViewerContext(ws.id),
      getOrCreateAnonIdSSR(),
    ]);
    ctx.viewer = viewer;
    const abKeys = collectAbKeys(layout);
    if (abKeys.length > 0) {
      try {
        const hdrs = await headers();
        const cip = extractClientIp(hdrs);
        const resolutions = await resolveTestsForKeys(ws.id, anon.anonId, abKeys, cip);
        const compact = new Map<string, { testId: string; variantId: string }>();
        for (const [k, r] of resolutions) {
          compact.set(k, { testId: r.testId, variantId: r.variantId });
        }
        ctx.abMap = compact;
        const wsId = ws.id;
        const aid = anon.anonId;
        after(async () => {
          try {
            await recordImpressionsFromMap(resolutions, wsId, aid, cip);
          } catch {
            /* best-effort */
          }
        });
      } catch {
        /* render normal con control */
      }
    }
    return {
      layout,
      ctx,
      ws,
      page: { id: home.id, title: home.title, path: home.path, workspaceId: ws.id },
    };
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  if (host) {
    // Si una regla "/" → … aplica, redirige antes de renderizar.
    await runRedirect({ host, path: "/" });
  }
  const home = await resolveHomePage();
  if (home) {
    const liveEdit = await getLiveEditState(home.ws.id, sp);
    if (liveEdit.active) home.ctx.editMode = true;
    return (
      <ThemeShell workspaceId={home.ws.id}>
        <PublicNav workspace={home.ws} />
        <main className="relative isolate overflow-hidden">
          <RenderLayout layout={home.layout} ctx={home.ctx} breakpoint="desktop" />
        </main>
        {liveEdit.active ? (
          <LiveEditOverlay
            pageId={home.page.id}
            pagePath={home.page.path}
            pageTitle={home.page.title}
            layout={home.layout}
          />
        ) : null}
      </ThemeShell>
    );
  }
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <AuroraBackground />
      <MarketingNav />
      <Hero />
      <Features />
      <WhyTechx />
      <Stack />
      <Roadmap />
      <CTA />
      <Footer />
    </main>
  );
}
