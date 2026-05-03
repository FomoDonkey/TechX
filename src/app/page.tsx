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
import { WhyCSM } from "@/components/marketing/why";
import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import type { Workspace } from "@/db/schema";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { getPublishedHome, getPublishedPageByPath } from "@/lib/pages";
import { runRedirect } from "@/redirects/runtime";
import { headers } from "next/headers";

export const revalidate = 60;

async function resolveHomePage(): Promise<{
  layout: ReturnType<typeof normalizeLayout>;
  ctx: Awaited<ReturnType<typeof resolveLayout>>;
  ws: Workspace;
} | null> {
  if (!features.database) return null;
  try {
    const ws = await getDefaultPublicWorkspace();
    if (!ws) return null;
    const home = (await getPublishedHome(ws.id)) ?? (await getPublishedPageByPath(ws.id, "/"));
    if (!home) return null;
    const layout = normalizeLayout(home.layout);
    const ctx = await resolveLayout(ws.id, layout, { followSymbols: true });
    return { layout, ctx, ws };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  if (host) {
    // Si una regla "/" → … aplica, redirige antes de renderizar.
    await runRedirect({ host, path: "/" });
  }
  const home = await resolveHomePage();
  if (home) {
    return (
      <ThemeShell workspaceId={home.ws.id}>
        <PublicNav workspace={home.ws} />
        <main className="relative isolate overflow-hidden">
          <RenderLayout layout={home.layout} ctx={home.ctx} breakpoint="desktop" />
        </main>
      </ThemeShell>
    );
  }
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <AuroraBackground />
      <MarketingNav />
      <Hero />
      <Features />
      <WhyCSM />
      <Stack />
      <Roadmap />
      <CTA />
      <Footer />
    </main>
  );
}
