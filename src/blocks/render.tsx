import { shouldShow } from "@/blocks/audience";
import { MotionHero, type MotionHeroVariant } from "@/blocks/motion-hero/client";
import { type BlockSpec, getBlockSpec, isSafeUrl, validateProps } from "@/blocks/registry";
import {
  MichaelBento,
  MichaelContactFooter,
  MichaelExplorations,
  MichaelHero,
  MichaelJournal,
  MichaelStats,
} from "@/blocks/spectacular/agency-spotlight-sections";
import {
  MagazineCategories,
  MagazineFeatured,
  MagazineMasthead,
  MagazineNewsletter,
  MagazineStories,
} from "@/blocks/spectacular/blog-particles-sections";
import { MintHero, MintPerks, MintRoadmap } from "@/blocks/spectacular/coming-soon-sections";
import {
  NimbusCommunity,
  NimbusDocsGrid,
  NimbusHero,
  NimbusQuickStart,
} from "@/blocks/spectacular/docs-aurora-sections";
import {
  F1Calendar,
  F1ChampionsHistory,
  F1Constructors,
  F1ConstructorsTable,
  F1Cta,
  F1DriverOfTheDay,
  F1Drivers,
  F1Hero,
  F1LastRacePodium,
  F1Season2026,
  F1SeasonBanner,
  F1Standings,
  F1Stats,
  F1Tracks,
} from "@/blocks/spectacular/f1-grand-prix-sections";
import {
  SecurifyHero,
  SecurityCta,
  SecurityPillars,
  SecurityPricing,
  SecuritySectors,
} from "@/blocks/spectacular/launch-marquee-sections";
import {
  SubstackArchive,
  SubstackFooter,
  SubstackHeader,
  SubstackHero,
  SubstackPreview,
  SubstackPricing,
  SubstackTestimonial,
} from "@/blocks/spectacular/newsletter-typewriter-sections";
import {
  JackAbout,
  JackCta,
  JackHero,
  JackMarquee,
  JackProjects,
  JackServices,
} from "@/blocks/spectacular/portfolio-spotlight-sections";
import {
  AsmeAbout,
  AsmeCta,
  AsmeFeaturedVideo,
  AsmeHero,
  AsmeServiceCards,
  AsmeSplitVision,
} from "@/blocks/spectacular/saas-magnetic-sections";
import type { BlockNode, Breakpoint, RenderContext, ViewerContext } from "@/blocks/types";
import { renderDoc } from "@/lib/render-doc";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

type RenderProps = {
  layout: BlockNode[];
  ctx: RenderContext;
  /** Si es preview en builder, oculta nodos hidden por breakpoint */
  breakpoint?: Breakpoint;
};

const GUEST: ViewerContext = {
  isAuthenticated: false,
  email: null,
  isActive: false,
  tierId: null,
  country: null,
  device: "desktop",
  utm: {},
  hour: null,
};

export function RenderLayout({ layout, ctx, breakpoint }: RenderProps): ReactNode {
  const viewer = ctx.viewer ?? GUEST;
  const bypass = ctx.bypassGates === true;
  // Pre-procesado: aplica audience + paywall y devuelve el árbol "trimado"
  // donde el truncado del paywall se propaga HACIA ARRIBA (sin contenido
  // post-paywall a NINGÚN nivel del árbol — patrón Substack estricto).
  const trimmed = bypass ? layout : trimLayoutForViewer(layout, viewer, ctx.abMap).layout;
  const visible = trimmed.filter((n) => !n.hidden?.[breakpoint ?? "desktop"]);
  const editMode = ctx.editMode === true;
  return (
    <>
      {visible.map((node) => {
        const rendered = renderNode(node, ctx, breakpoint);
        if (!editMode) return <Fragment key={node.id}>{rendered}</Fragment>;
        return (
          <div
            key={node.id}
            data-csm-block-id={node.id}
            data-csm-block-kind={node.kind}
            className="csm-edit-target relative outline-offset-[-2px] hover:outline hover:outline-2 hover:outline-violet-400/70"
          >
            {rendered}
          </div>
        );
      })}
    </>
  );
}

/**
 * Recorre el árbol y devuelve {layout, truncated}:
 *  - Bloques con audiencia que no matchea → omitidos.
 *  - Paywall con gate-OK → omitido (su contenido sigue accesible).
 *  - Paywall con gate-FAIL → conservado como ÚLTIMO bloque + truncated:true.
 *  - truncated:true se propaga hacia arriba: cualquier sibling DESPUÉS del
 *    contenedor donde se truncó también se omite.
 */
function trimLayoutForViewer(
  layout: BlockNode[],
  viewer: ViewerContext,
  abMap: RenderContext["abMap"],
): { layout: BlockNode[]; truncated: boolean } {
  const out: BlockNode[] = [];
  for (const node of layout) {
    if (!shouldShow(node.audience, viewer)) continue;

    if (node.kind === "paywall") {
      const props = validateProps("paywall", node.props);
      if (!gateAllows(props, viewer)) {
        out.push(node);
        return { layout: out, truncated: true };
      }
      // Gate permite: omitir el bloque paywall pero seguir.
      continue;
    }

    // A/B test: el bloque "ab" elige uno de sus children "ab-variant" según
    // la variant resuelta para su testKey. Si no hay test activo o no
    // matchea, mostramos el primer child (control).
    if (node.kind === "ab") {
      const props = validateProps("ab", node.props);
      const testKey = typeof props.testKey === "string" ? props.testKey : "";
      const children = node.children ?? [];
      if (children.length === 0) continue;
      const resolved = testKey && abMap ? abMap.get(testKey) : null;
      const targetVariantId = resolved?.variantId ?? null;
      // Filtra a los hijos ab-variant; otros hijos no válidos se ignoran
      const variantChildren = children.filter((c) => c.kind === "ab-variant");
      const pool = variantChildren.length > 0 ? variantChildren : children;
      let chosen: BlockNode | null = null;
      if (targetVariantId) {
        chosen =
          pool.find((c) => {
            const cprops = c.props ?? {};
            return (cprops as Record<string, unknown>).variantId === targetVariantId;
          }) ?? null;
      }
      if (!chosen) chosen = pool[0] ?? null;
      if (!chosen) continue;
      // Recurse en los hijos del variant elegido
      const sub = trimLayoutForViewer(chosen.children ?? [], viewer, abMap);
      // Aplanamos: el wrapper "ab-variant" no aporta semántica visual.
      out.push(...sub.layout);
      if (sub.truncated) return { layout: out, truncated: true };
      continue;
    }

    if (node.children?.length) {
      const sub = trimLayoutForViewer(node.children, viewer, abMap);
      out.push({ ...node, children: sub.layout });
      if (sub.truncated) return { layout: out, truncated: true };
      continue;
    }

    out.push(node);
  }
  return { layout: out, truncated: false };
}

function gateAllows(props: Record<string, unknown>, viewer: ViewerContext): boolean {
  const gateType =
    props.gateType === "logged-in" || props.gateType === "specific-tiers"
      ? props.gateType
      : "any-tier";
  if (gateType === "logged-in") return viewer.isAuthenticated;
  if (gateType === "any-tier") return viewer.isActive;
  // specific-tiers
  if (!viewer.isActive || !viewer.tierId) return false;
  const tierIds = Array.isArray(props.tierIds) ? (props.tierIds as string[]) : [];
  if (tierIds.length === 0) return viewer.isActive;
  return tierIds.includes(viewer.tierId);
}

function renderPaywallCard(props: Record<string, unknown>, viewer: ViewerContext): ReactNode {
  const title = (props.title as string) || "Contenido para miembros";
  const message = (props.message as string) || "Suscríbete para seguir leyendo.";
  const ctaLabel = (props.ctaLabel as string) || "Hacerme miembro";
  const ctaHref = (props.ctaHref as string) || "/miembros";
  const secondaryLabel = (props.secondaryLabel as string) || "";
  const secondaryHref = (props.secondaryHref as string) || "/miembros";
  const teaser = props.teaser === "hard" ? "hard" : "fade";

  return (
    <section className="relative">
      {teaser === "fade" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background"
        />
      ) : null}
      <div className="mx-auto max-w-2xl rounded-3xl border bg-card/40 p-8 text-center backdrop-blur">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
          <Icons.Lock className="size-5" />
        </div>
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href={ctaHref}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/40"
          >
            {ctaLabel}
          </Link>
          {secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
        {!viewer.isAuthenticated ? (
          <p className="mt-4 text-xs text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/miembros" className="underline underline-offset-2">
              Inicia sesión
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function renderNode(node: BlockNode, ctx: RenderContext, bp?: Breakpoint): ReactNode {
  const spec = getBlockSpec(node.kind);
  if (!spec) return null;
  const props = validateProps(node.kind, node.props);
  const children = node.children?.length ? (
    <RenderLayout layout={node.children} ctx={ctx} breakpoint={bp} />
  ) : null;
  return (
    <BlockRender spec={spec} kind={node.kind} props={props} ctx={ctx} bp={bp}>
      {children}
    </BlockRender>
  );
}

function BlockRender({
  spec,
  kind,
  props,
  ctx,
  bp,
  children,
}: {
  spec: BlockSpec;
  kind: string;
  props: Record<string, unknown>;
  ctx: RenderContext;
  bp?: Breakpoint;
  children: ReactNode;
}): ReactNode {
  switch (kind) {
    case "section":
      return renderSection(props, ctx, children);
    case "container":
      return renderContainer(props, children);
    case "columns":
      return renderColumns(props, children);
    case "heading":
      return renderHeading(props);
    case "text":
      return renderText(props);
    case "rich":
      return renderRich(props);
    case "image":
      return renderImage(props, ctx);
    case "gallery":
      return renderGallery(props, ctx);
    case "video":
      return renderVideo(props);
    case "embed":
      return renderEmbed(props);
    case "button":
      return renderButton(props);
    case "cta":
      return renderCta(props);
    case "hero":
      return renderHero(props, ctx);
    case "motion-hero":
      return renderMotionHero(props);
    case "features-grid":
      return renderFeaturesGrid(props);
    case "pricing":
      return renderPricing(props);
    case "testimonials":
      return renderTestimonials(props, ctx);
    case "faq":
      return renderFaq(props);
    case "footer-cols":
      return renderFooterCols(props);
    case "spacer":
      return renderSpacer(props);
    case "divider":
      return renderDivider(props);
    case "symbol":
      return renderSymbol(props, ctx, bp);
    case "paywall":
      // El paywall se procesa en RenderLayout para poder truncar siblings.
      // Si llega aquí (p.ej. preview en builder con bypassGates) renderizamos
      // el card siempre como visualización informativa.
      return renderPaywallCard(props, ctx.viewer ?? GUEST);
    case "ab":
      // En render normal "ab" se procesa en trimLayoutForViewer y nunca llega
      // aquí. Si llega (bypassGates), mostramos un wrapper informativo con
      // todas las variants apiladas para que el builder vea ambas.
      return renderAbPreview(props, children);
    case "ab-variant":
      // Idem: con bypass mostramos su contenido directamente.
      return <div data-ab-variant={String(props.variantId ?? "")}>{children}</div>;

    // ============================================================
    // Bloques de plantillas espectaculares (tpl-*).
    // Cada uno delega 1:1 en su client component. Las props llegan ya
    // validadas por el Zod schema vía `validateProps()`.
    // ============================================================
    case "tpl-asme-hero":
      return renderAsmeHero(props);
    case "tpl-asme-about":
      return <AsmeAbout {...(props as Record<string, never>)} />;
    case "tpl-asme-featured-video":
      return <AsmeFeaturedVideo {...(props as Record<string, never>)} />;
    case "tpl-asme-split-vision":
      return <AsmeSplitVision {...(props as Record<string, never>)} />;
    case "tpl-asme-service-cards":
      return renderAsmeServiceCards(props);
    case "tpl-asme-cta":
      return <AsmeCta {...(props as Record<string, never>)} />;

    case "tpl-jack-hero":
      return renderJackHero(props);
    case "tpl-jack-marquee":
      return renderJackMarquee(props);
    case "tpl-jack-about":
      return <JackAbout {...(props as Record<string, never>)} />;
    case "tpl-jack-services":
      return renderJackServices(props);
    case "tpl-jack-projects":
      return renderJackProjects(props);
    case "tpl-jack-cta":
      return <JackCta {...(props as Record<string, never>)} />;

    case "tpl-michael-hero":
      return renderMichaelHero(props);
    case "tpl-michael-bento":
      return renderMichaelBento(props);
    case "tpl-michael-journal":
      return renderMichaelJournal(props);
    case "tpl-michael-explorations":
      return renderMichaelExplorations(props);
    case "tpl-michael-stats":
      return renderMichaelStats(props);
    case "tpl-michael-contact-footer":
      return renderMichaelContactFooter(props);

    case "tpl-mint-hero":
      return renderMintHero(props);
    case "tpl-mint-perks":
      return renderMintPerks(props);
    case "tpl-mint-roadmap":
      return renderMintRoadmap(props);

    case "tpl-nimbus-hero":
      return renderNimbusHero(props);
    case "tpl-nimbus-docs-grid":
      return renderNimbusDocsGrid(props);
    case "tpl-nimbus-quick-start":
      return renderNimbusQuickStart(props);
    case "tpl-nimbus-community":
      return <NimbusCommunity {...(props as Record<string, never>)} />;

    case "tpl-securify-hero":
      return renderSecurifyHero(props);
    case "tpl-security-sectors":
      return renderSecuritySectors(props);
    case "tpl-security-pillars":
      return renderSecurityPillars(props);
    case "tpl-security-pricing":
      return renderSecurityPricing(props);
    case "tpl-security-cta":
      return <SecurityCta {...(props as Record<string, never>)} />;

    case "tpl-magazine-masthead":
      return renderMagazineMasthead(props);
    case "tpl-magazine-featured":
      return renderMagazineFeatured(props);
    case "tpl-magazine-categories":
      return renderMagazineCategories(props);
    case "tpl-magazine-stories":
      return renderMagazineStories(props);
    case "tpl-magazine-newsletter":
      return <MagazineNewsletter {...(props as Record<string, never>)} />;

    case "tpl-substack-header":
      return <SubstackHeader {...(props as Record<string, never>)} />;
    case "tpl-substack-hero":
      return <SubstackHero {...(props as Record<string, never>)} />;
    case "tpl-substack-preview":
      return renderSubstackPreview(props);
    case "tpl-substack-testimonial":
      return <SubstackTestimonial {...(props as Record<string, never>)} />;
    case "tpl-substack-pricing":
      return renderSubstackPricing(props);
    case "tpl-substack-archive":
      return renderSubstackArchive(props);
    case "tpl-substack-footer":
      return renderSubstackFooter(props);

    case "tpl-f1-hero":
      return <F1Hero {...(props as Record<string, never>)} />;
    case "tpl-f1-drivers":
      return <F1Drivers {...(props as Record<string, never>)} />;
    case "tpl-f1-constructors":
      return <F1Constructors {...(props as Record<string, never>)} />;
    case "tpl-f1-calendar":
      return <F1Calendar {...(props as Record<string, never>)} />;
    case "tpl-f1-stats":
      return <F1Stats {...(props as Record<string, never>)} />;
    case "tpl-f1-standings":
      return <F1Standings {...(props as Record<string, never>)} />;
    case "tpl-f1-constructors-table":
      return <F1ConstructorsTable {...(props as Record<string, never>)} />;
    case "tpl-f1-tracks":
      return <F1Tracks {...(props as Record<string, never>)} />;
    case "tpl-f1-last-race":
      return <F1LastRacePodium {...(props as Record<string, never>)} />;
    case "tpl-f1-dotd":
      return <F1DriverOfTheDay {...(props as Record<string, never>)} />;
    case "tpl-f1-2026":
      return <F1Season2026 {...(props as Record<string, never>)} />;
    case "tpl-f1-season-banner":
      return <F1SeasonBanner {...(props as Record<string, never>)} />;
    case "tpl-f1-champions":
      return <F1ChampionsHistory {...(props as Record<string, never>)} />;
    case "tpl-f1-cta":
      return <F1Cta {...(props as Record<string, never>)} />;

    default:
      return (
        <div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
          Bloque desconocido: {spec.label}
        </div>
      );
  }
}

// ============================================================
// Helpers de render para bloques tpl-* que tienen normalización
// de props no triviales (legacy/shape variants del inspector).
// ============================================================
function renderAsmeHero(props: Record<string, unknown>): ReactNode {
  // socials puede llegar como string[] o {key}[] desde el inspector
  const rawSocials = props.socials;
  let socials: Array<"instagram" | "twitter" | "globe"> = [];
  if (Array.isArray(rawSocials)) {
    socials = rawSocials
      .map((it) => {
        if (typeof it === "string") return it as "instagram" | "twitter" | "globe";
        if (it && typeof it === "object" && typeof (it as { key?: unknown }).key === "string") {
          return (it as { key: string }).key as "instagram" | "twitter" | "globe";
        }
        return null;
      })
      .filter(
        (x): x is "instagram" | "twitter" | "globe" =>
          x === "instagram" || x === "twitter" || x === "globe",
      );
  }
  const navItemsRaw = Array.isArray(props.navItems)
    ? (props.navItems as Array<{ label?: unknown; href?: unknown }>)
    : [];
  const navItems = navItemsRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  return (
    <AsmeHero
      brand={s(props, "brand") || undefined}
      navItems={navItems.length > 0 ? navItems : undefined}
      signupText={s(props, "signupText") || undefined}
      loginText={s(props, "loginText") || undefined}
      loginHref={s(props, "loginHref") || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      titleHtml={s(props, "titleHtml") || undefined}
      emailPlaceholder={s(props, "emailPlaceholder") || undefined}
      subtitle={s(props, "subtitle") || undefined}
      manifestoText={s(props, "manifestoText") || undefined}
      socials={socials.length > 0 ? socials : undefined}
    />
  );
}

function renderAsmeServiceCards(props: Record<string, unknown>): ReactNode {
  const cardsRaw = Array.isArray(props.cards)
    ? (props.cards as Array<Record<string, unknown>>)
    : [];
  const cards = cardsRaw.map((c) => ({
    tag: typeof c.tag === "string" ? c.tag : "",
    title: typeof c.title === "string" ? c.title : "",
    desc: typeof c.desc === "string" ? c.desc : "",
    videoUrl: typeof c.videoUrl === "string" ? c.videoUrl : "",
  }));
  return (
    <AsmeServiceCards
      anchorId={s(props, "anchorId") || undefined}
      sectionTitle={s(props, "sectionTitle") || undefined}
      sectionEyebrow={s(props, "sectionEyebrow") || undefined}
      cards={cards.length > 0 ? cards : undefined}
    />
  );
}

function renderJackHero(props: Record<string, unknown>): ReactNode {
  const navItemsRaw = Array.isArray(props.navItems)
    ? (props.navItems as Array<{ label?: unknown; href?: unknown }>)
    : [];
  const navItems = navItemsRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  return (
    <JackHero
      navItems={navItems.length > 0 ? navItems : undefined}
      titleText={s(props, "titleText") || undefined}
      portraitUrl={s(props, "portraitUrl") || undefined}
      bottomCopy={s(props, "bottomCopy") || undefined}
      contactText={s(props, "contactText") || undefined}
      contactHref={s(props, "contactHref") || undefined}
    />
  );
}

function renderJackMarquee(props: Record<string, unknown>): ReactNode {
  const rawGifs = props.gifs;
  let gifs: string[] = [];
  if (Array.isArray(rawGifs)) {
    gifs = rawGifs
      .map((it) => {
        if (typeof it === "string") return it;
        if (it && typeof it === "object" && typeof (it as { src?: unknown }).src === "string") {
          return (it as { src: string }).src;
        }
        return null;
      })
      .filter((x): x is string => !!x);
  }
  return (
    <JackMarquee
      gifs={gifs.length > 0 ? gifs : undefined}
      splitAt={n(props, "splitAt", 11) || undefined}
    />
  );
}

function renderJackServices(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    n: typeof it.n === "string" ? it.n : "01",
    name: typeof it.name === "string" ? it.name : "",
    desc: typeof it.desc === "string" ? it.desc : "",
  }));
  return (
    <JackServices
      anchorId={s(props, "anchorId") || undefined}
      title={s(props, "title") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

function renderJackProjects(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    number: typeof it.number === "string" ? it.number : "01",
    category: typeof it.category === "string" ? it.category : "",
    name: typeof it.name === "string" ? it.name : "",
    liveButtonText: typeof it.liveButtonText === "string" ? it.liveButtonText : "Live Project",
    img1: typeof it.img1 === "string" ? it.img1 : "",
    img2: typeof it.img2 === "string" ? it.img2 : "",
    img3: typeof it.img3 === "string" ? it.img3 : "",
  }));
  return (
    <JackProjects
      anchorId={s(props, "anchorId") || undefined}
      title={s(props, "title") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

// ============================================================
// Michael (agency-spotlight) — helpers
// ============================================================
function flattenStringArray(raw: unknown, key: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (typeof it === "string") return it;
      if (
        it &&
        typeof it === "object" &&
        typeof (it as Record<string, unknown>)[key] === "string"
      ) {
        return (it as Record<string, string>)[key]!;
      }
      return null;
    })
    .filter((x): x is string => !!x);
}

function renderMichaelHero(props: Record<string, unknown>): ReactNode {
  const navItemsRaw = Array.isArray(props.navItems)
    ? (props.navItems as Array<{ label?: unknown; href?: unknown }>)
    : [];
  const navItems = navItemsRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  const loadingWords = flattenStringArray(props.loadingWords, "label");
  const cycleWords = flattenStringArray(props.cycleWords, "label");
  return (
    <MichaelHero
      showLoading={typeof props.showLoading === "boolean" ? props.showLoading : undefined}
      loadingWords={loadingWords.length > 0 ? loadingWords : undefined}
      loadingDurationMs={n(props, "loadingDurationMs", 0) || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      navInitials={s(props, "navInitials") || undefined}
      navItems={navItems.length > 0 ? navItems : undefined}
      navCtaText={s(props, "navCtaText") || undefined}
      navCtaHref={s(props, "navCtaHref") || undefined}
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      preCycleText={s(props, "preCycleText") || undefined}
      cycleWords={cycleWords.length > 0 ? cycleWords : undefined}
      cycleIntervalMs={n(props, "cycleIntervalMs", 0) || undefined}
      postCycleText={s(props, "postCycleText") || undefined}
      description={s(props, "description") || undefined}
      primaryButtonText={s(props, "primaryButtonText") || undefined}
      secondaryButtonText={s(props, "secondaryButtonText") || undefined}
      scrollLabel={s(props, "scrollLabel") || undefined}
    />
  );
}

function renderMichaelBento(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    title: typeof it.title === "string" ? it.title : "",
    img: typeof it.img === "string" ? it.img : "",
    span: typeof it.span === "string" ? it.span : "md:col-span-6",
    aspect: typeof it.aspect === "string" ? it.aspect : "aspect-[16/10]",
  }));
  return (
    <MichaelBento
      anchorId={s(props, "anchorId") || undefined}
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      ctaText={s(props, "ctaText") || undefined}
      ctaHref={s(props, "ctaHref") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

function renderMichaelJournal(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    title: typeof it.title === "string" ? it.title : "",
    minutes: typeof it.minutes === "string" ? it.minutes : "",
    date: typeof it.date === "string" ? it.date : "",
    img: typeof it.img === "string" ? it.img : "",
  }));
  return (
    <MichaelJournal
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      ctaText={s(props, "ctaText") || undefined}
      ctaHref={s(props, "ctaHref") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

function renderMichaelExplorations(props: Record<string, unknown>): ReactNode {
  const images = flattenStringArray(props.images, "src");
  return (
    <MichaelExplorations
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      images={images.length > 0 ? images : undefined}
      splitAt={n(props, "splitAt", 0) || undefined}
      factorLeft={typeof props.factorLeft === "number" ? props.factorLeft : undefined}
      factorRight={typeof props.factorRight === "number" ? props.factorRight : undefined}
    />
  );
}

function renderMichaelStats(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    value: typeof it.value === "string" ? it.value : "",
    label: typeof it.label === "string" ? it.label : "",
  }));
  return <MichaelStats items={items.length > 0 ? items : undefined} />;
}

// ============================================================
// Mint (coming-soon-typewriter) — helpers
// ============================================================
function renderMintHero(props: Record<string, unknown>): ReactNode {
  const labelsRaw =
    props.countdownLabels && typeof props.countdownLabels === "object"
      ? (props.countdownLabels as Record<string, unknown>)
      : {};
  const countdownLabels = {
    days: typeof labelsRaw.days === "string" ? labelsRaw.days : "días",
    hours: typeof labelsRaw.hours === "string" ? labelsRaw.hours : "horas",
    minutes: typeof labelsRaw.minutes === "string" ? labelsRaw.minutes : "min",
    seconds: typeof labelsRaw.seconds === "string" ? labelsRaw.seconds : "seg",
  };
  return (
    <MintHero
      logoLabel={s(props, "logoLabel") || undefined}
      notifyButtonText={s(props, "notifyButtonText") || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      badge={s(props, "badge") || undefined}
      titleHtml={s(props, "titleHtml") || undefined}
      description={s(props, "description") || undefined}
      targetDate={s(props, "targetDate") || undefined}
      countdownLabels={countdownLabels}
      emailPlaceholder={s(props, "emailPlaceholder") || undefined}
      successMessage={s(props, "successMessage") || undefined}
      disclaimer={s(props, "disclaimer") || undefined}
    />
  );
}

function renderMintPerks(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.perks)
    ? (props.perks as Array<Record<string, unknown>>)
    : [];
  const perks = itemsRaw.map((it) => ({
    icon: typeof it.icon === "string" ? it.icon : "Sparkles",
    title: typeof it.title === "string" ? it.title : "",
    desc: typeof it.desc === "string" ? it.desc : "",
  }));
  return (
    <MintPerks
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      perks={perks.length > 0 ? perks : undefined}
    />
  );
}

// ============================================================
// Magazine (blog-particles) — helpers
// ============================================================
function renderMagazineMasthead(props: Record<string, unknown>): ReactNode {
  const navLinks = flattenStringArray(props.navLinks, "label");
  return (
    <MagazineMasthead
      issueNumber={s(props, "issueNumber") || undefined}
      publicationName={s(props, "publicationName") || undefined}
      subscribeText={s(props, "subscribeText") || undefined}
      navLinks={navLinks.length > 0 ? navLinks : undefined}
    />
  );
}

function renderMagazineFeatured(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.sidebarItems)
    ? (props.sidebarItems as Array<Record<string, unknown>>)
    : [];
  const sidebarItems = itemsRaw.map((it) => ({
    cat: typeof it.cat === "string" ? it.cat : "",
    title: typeof it.title === "string" ? it.title : "",
    author: typeof it.author === "string" ? it.author : "",
    minutes: typeof it.minutes === "string" ? it.minutes : "",
    cover: typeof it.cover === "string" ? it.cover : "",
  }));
  return (
    <MagazineFeatured
      featuredCategory={s(props, "featuredCategory") || undefined}
      featuredTitle={s(props, "featuredTitle") || undefined}
      featuredHook={s(props, "featuredHook") || undefined}
      featuredAuthor={s(props, "featuredAuthor") || undefined}
      featuredMinutes={s(props, "featuredMinutes") || undefined}
      featuredDate={s(props, "featuredDate") || undefined}
      featuredCover={s(props, "featuredCover") || undefined}
      sidebarLabel={s(props, "sidebarLabel") || undefined}
      sidebarItems={sidebarItems.length > 0 ? sidebarItems : undefined}
    />
  );
}

function renderMagazineCategories(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    name: typeof it.name === "string" ? it.name : "",
    count: typeof it.count === "number" ? it.count : Number(it.count) || 0,
    color: typeof it.color === "string" ? it.color : "#7c2d12",
  }));
  return (
    <MagazineCategories
      title={s(props, "title") || undefined}
      totalLabel={s(props, "totalLabel") || undefined}
      totalSuffix={s(props, "totalSuffix") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

function renderMagazineStories(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    cat: typeof it.cat === "string" ? it.cat : "",
    title: typeof it.title === "string" ? it.title : "",
    excerpt: typeof it.excerpt === "string" ? it.excerpt : "",
    cover: typeof it.cover === "string" ? it.cover : "",
  }));
  return (
    <MagazineStories
      title={s(props, "title") || undefined}
      ctaText={s(props, "ctaText") || undefined}
      ctaHref={s(props, "ctaHref") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

// ============================================================
// Substack (newsletter-typewriter) — helpers
// ============================================================
function renderSubstackPreview(props: Record<string, unknown>): ReactNode {
  const paragraphs = flattenStringArray(props.paragraphs, "text");
  return (
    <SubstackPreview
      eyebrow={s(props, "eyebrow") || undefined}
      issueNumber={s(props, "issueNumber") || undefined}
      title={s(props, "title") || undefined}
      meta={s(props, "meta") || undefined}
      paragraphs={paragraphs.length > 0 ? paragraphs : undefined}
      paywallTitle={s(props, "paywallTitle") || undefined}
      paywallDescription={s(props, "paywallDescription") || undefined}
      paywallButtonText={s(props, "paywallButtonText") || undefined}
    />
  );
}

function renderSubstackPricing(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.tiers)
    ? (props.tiers as Array<Record<string, unknown>>)
    : [];
  const tiers = itemsRaw.map((it) => {
    const featuresRaw = it.features;
    let features: string[] = [];
    if (Array.isArray(featuresRaw)) {
      features = featuresRaw.filter((f): f is string => typeof f === "string");
    } else if (typeof featuresRaw === "string") {
      features = featuresRaw
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean);
    }
    return {
      label: typeof it.label === "string" ? it.label : "",
      price: typeof it.price === "string" ? it.price : "",
      period: typeof it.period === "string" ? it.period : undefined,
      subPeriod: typeof it.subPeriod === "string" ? it.subPeriod : undefined,
      features,
      buttonText: typeof it.buttonText === "string" ? it.buttonText : "",
      recommended: it.recommended === true,
      recommendedText: typeof it.recommendedText === "string" ? it.recommendedText : undefined,
    };
  });
  return (
    <SubstackPricing
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      tiers={tiers.length > 0 ? tiers : undefined}
    />
  );
}

function renderSubstackArchive(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    n: typeof it.n === "string" ? it.n : "",
    title: typeof it.title === "string" ? it.title : "",
    excerpt: typeof it.excerpt === "string" ? it.excerpt : "",
    minutes: typeof it.minutes === "string" ? it.minutes : "",
    date: typeof it.date === "string" ? it.date : "",
    free: it.free === true,
  }));
  return (
    <SubstackArchive
      title={s(props, "title") || undefined}
      ctaText={s(props, "ctaText") || undefined}
      ctaHref={s(props, "ctaHref") || undefined}
      items={items.length > 0 ? items : undefined}
      freeLabel={s(props, "freeLabel") || undefined}
      premiumLabel={s(props, "premiumLabel") || undefined}
    />
  );
}

function renderSubstackFooter(props: Record<string, unknown>): ReactNode {
  const linksRaw = Array.isArray(props.links)
    ? (props.links as Array<Record<string, unknown>>)
    : [];
  const links = linksRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  return (
    <SubstackFooter
      copyright={s(props, "copyright") || undefined}
      links={links.length > 0 ? links : undefined}
    />
  );
}

// ============================================================
// Securify (launch-marquee) — helpers
// ============================================================
function renderSecurifyHero(props: Record<string, unknown>): ReactNode {
  const navItemsRaw = Array.isArray(props.navItems)
    ? (props.navItems as Array<{ label?: unknown; href?: unknown }>)
    : [];
  const navItems = navItemsRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  const wordsRaw = Array.isArray(props.staggeredWords)
    ? (props.staggeredWords as Array<Record<string, unknown>>)
    : [];
  const staggeredWords = wordsRaw.map((w) => ({
    text: typeof w.text === "string" ? w.text : "",
    position: typeof w.position === "string" ? w.position : "",
  }));
  const statsRaw = Array.isArray(props.stats)
    ? (props.stats as Array<Record<string, unknown>>)
    : [];
  const stats = statsRaw.map((st) => ({
    value: typeof st.value === "string" ? st.value : "",
    label: typeof st.label === "string" ? st.label : "",
    position: typeof st.position === "string" ? st.position : "",
    divisor: (st.divisor === "right" ? "right" : "left") as "left" | "right",
    alignRight: st.alignRight === true,
  }));
  return (
    <SecurifyHero
      brand={s(props, "brand") || undefined}
      navItems={navItems.length > 0 ? navItems : undefined}
      ctaText={s(props, "ctaText") || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      staggeredWords={staggeredWords.length > 0 ? staggeredWords : undefined}
      description={s(props, "description") || undefined}
      descriptionPosition={s(props, "descriptionPosition") || undefined}
      stats={stats.length > 0 ? stats : undefined}
      widgetEyebrow={s(props, "widgetEyebrow") || undefined}
      widgetText={s(props, "widgetText") || undefined}
      widgetButtonText={s(props, "widgetButtonText") || undefined}
    />
  );
}

function renderSecuritySectors(props: Record<string, unknown>): ReactNode {
  const sectors = flattenStringArray(props.sectors, "label");
  return (
    <SecuritySectors
      eyebrow={s(props, "eyebrow") || undefined}
      sectors={sectors.length > 0 ? sectors : undefined}
      duration={n(props, "duration", 0) || undefined}
    />
  );
}

function renderSecurityPillars(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.pillars)
    ? (props.pillars as Array<Record<string, unknown>>)
    : [];
  const pillars = itemsRaw.map((it) => ({
    n: typeof it.n === "string" ? it.n : "01",
    title: typeof it.title === "string" ? it.title : "",
    desc: typeof it.desc === "string" ? it.desc : "",
  }));
  return (
    <SecurityPillars
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      pillars={pillars.length > 0 ? pillars : undefined}
    />
  );
}

function renderSecurityPricing(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.tiers)
    ? (props.tiers as Array<Record<string, unknown>>)
    : [];
  const tiers = itemsRaw.map((it) => {
    const featuresRaw = it.features;
    let features: string[] = [];
    if (Array.isArray(featuresRaw)) {
      features = featuresRaw.filter((f): f is string => typeof f === "string");
    } else if (typeof featuresRaw === "string") {
      features = featuresRaw
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean);
    }
    return {
      label: typeof it.label === "string" ? it.label : "",
      price: typeof it.price === "string" ? it.price : "",
      period: typeof it.period === "string" ? it.period : undefined,
      features,
      buttonText: typeof it.buttonText === "string" ? it.buttonText : "",
      featured: it.featured === true,
      highlight: typeof it.highlight === "string" ? it.highlight : undefined,
    };
  });
  return (
    <SecurityPricing
      anchorId={s(props, "anchorId") || undefined}
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      tiers={tiers.length > 0 ? tiers : undefined}
    />
  );
}

// ============================================================
// Nimbus (docs-aurora) — helpers
// ============================================================
function renderNimbusHero(props: Record<string, unknown>): ReactNode {
  const navItemsRaw = Array.isArray(props.navItems)
    ? (props.navItems as Array<Record<string, unknown>>)
    : [];
  const navItems = navItemsRaw.map((it) => ({
    label: typeof it.label === "string" ? it.label : "",
    href: typeof it.href === "string" ? it.href : "#",
    chevron: it.chevron === true,
  }));
  const logos = flattenStringArray(props.logos, "label");
  return (
    <NimbusHero
      brand={s(props, "brand") || undefined}
      navItems={navItems.length > 0 ? navItems : undefined}
      loginText={s(props, "loginText") || undefined}
      signupText={s(props, "signupText") || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      titleHtml={s(props, "titleHtml") || undefined}
      description={s(props, "description") || undefined}
      ctaText={s(props, "ctaText") || undefined}
      marqueeLabel={s(props, "marqueeLabel") || undefined}
      logos={logos.length > 0 ? logos : undefined}
    />
  );
}

function renderNimbusDocsGrid(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    icon: typeof it.icon === "string" ? it.icon : "FileText",
    title: typeof it.title === "string" ? it.title : "",
    desc: typeof it.desc === "string" ? it.desc : "",
    href: typeof it.href === "string" ? it.href : "#",
  }));
  return (
    <NimbusDocsGrid
      anchorId={s(props, "anchorId") || undefined}
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      items={items.length > 0 ? items : undefined}
    />
  );
}

function renderNimbusQuickStart(props: Record<string, unknown>): ReactNode {
  const steps = flattenStringArray(props.steps, "label");
  return (
    <NimbusQuickStart
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      description={s(props, "description") || undefined}
      steps={steps.length > 0 ? steps : undefined}
      codeFilename={s(props, "codeFilename") || undefined}
      code={s(props, "code") || undefined}
    />
  );
}

function renderMintRoadmap(props: Record<string, unknown>): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const items = itemsRaw.map((it) => ({
    date: typeof it.date === "string" ? it.date : "",
    label: typeof it.label === "string" ? it.label : "",
    done: it.done === true,
  }));
  return (
    <MintRoadmap
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      items={items.length > 0 ? items : undefined}
      doneLabel={s(props, "doneLabel") || undefined}
      pendingLabel={s(props, "pendingLabel") || undefined}
    />
  );
}

function renderMichaelContactFooter(props: Record<string, unknown>): ReactNode {
  const rawSocials = props.socials;
  type SocialKey = "twitter" | "linkedin" | "github" | "messageCircle";
  let socials: SocialKey[] = [];
  if (Array.isArray(rawSocials)) {
    socials = rawSocials
      .map((it): SocialKey | null => {
        if (typeof it === "string") {
          if (it === "twitter" || it === "linkedin" || it === "github" || it === "messageCircle") {
            return it;
          }
          return null;
        }
        if (it && typeof it === "object" && typeof (it as { key?: unknown }).key === "string") {
          const k = (it as { key: string }).key;
          if (k === "twitter" || k === "linkedin" || k === "github" || k === "messageCircle") {
            return k;
          }
        }
        return null;
      })
      .filter((x): x is SocialKey => !!x);
  }
  return (
    <MichaelContactFooter
      anchorId={s(props, "anchorId") || undefined}
      videoUrl={s(props, "videoUrl") || undefined}
      marqueeText={s(props, "marqueeText") || undefined}
      marqueeIterations={n(props, "marqueeIterations", 0) || undefined}
      marqueeDuration={n(props, "marqueeDuration", 0) || undefined}
      eyebrow={s(props, "eyebrow") || undefined}
      title={s(props, "title") || undefined}
      emailLabel={s(props, "emailLabel") || undefined}
      emailHref={s(props, "emailHref") || undefined}
      socials={socials.length > 0 ? socials : undefined}
      statusText={s(props, "statusText") || undefined}
      copyright={s(props, "copyright") || undefined}
    />
  );
}

function renderAbPreview(props: Record<string, unknown>, children: ReactNode): ReactNode {
  const testKey = typeof props.testKey === "string" ? props.testKey : "";
  return (
    <div className="my-4 rounded-2xl border border-dashed border-violet-500/50 bg-violet-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-violet-300">
        <Icons.FlaskConical className="size-3.5" />
        A/B Test{testKey ? ` · ${testKey}` : ""}{" "}
        <span className="text-muted-foreground">· preview todas las variants</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ---------------- helpers de tokens ----------------
const ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const SIZE_TEXT: Record<string, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};
const SIZE_HEADING: Record<string, string> = {
  sm: "text-2xl md:text-3xl",
  md: "text-3xl md:text-4xl",
  lg: "text-4xl md:text-5xl",
  xl: "text-5xl md:text-7xl",
};
const MAXW: Record<string, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-5xl",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-none",
};
const COLS: Record<string, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
};
const COL_ALIGN: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};
const ASPECT: Record<string, string> = {
  auto: "",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "9/16": "aspect-[9/16]",
};

function s(props: Record<string, unknown>, key: string, fallback = ""): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}
function n(props: Record<string, unknown>, key: string, fallback = 0): number {
  const v = props[key];
  return typeof v === "number" ? v : Number(v) || fallback;
}
function b(props: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = props[key];
  return typeof v === "boolean" ? v : fallback;
}

// ---------------- bloques ----------------

function renderSection(
  props: Record<string, unknown>,
  ctx: RenderContext,
  children: ReactNode,
): ReactNode {
  const bg = s(props, "background", "transparent");
  const padding = s(props, "padding", "py-20 px-6");
  const align = s(props, "align", "center");
  const bgImageId = s(props, "backgroundImage");
  const bgUrl = bgImageId ? (ctx.mediaMap.get(bgImageId)?.url ?? null) : null;
  const style: React.CSSProperties = {};
  if (bg && bg !== "transparent") style.backgroundColor = bg;
  if (bgUrl) {
    style.backgroundImage = `url("${bgUrl}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  return (
    <section className={cn("w-full", padding, ALIGN[align])} style={style}>
      {children}
    </section>
  );
}

function renderContainer(props: Record<string, unknown>, children: ReactNode): ReactNode {
  const max = MAXW[s(props, "maxWidth", "lg")] ?? MAXW.lg;
  const gap = s(props, "gap", "gap-6");
  return <div className={cn("mx-auto flex w-full flex-col", max, gap)}>{children}</div>;
}

function renderColumns(props: Record<string, unknown>, children: ReactNode): ReactNode {
  const count = String(n(props, "count", 2));
  const gap = s(props, "gap", "gap-6");
  const align = COL_ALIGN[s(props, "align", "stretch")] ?? "items-stretch";
  return (
    <div className={cn("mx-auto grid w-full max-w-5xl", COLS[count] ?? COLS["2"], gap, align)}>
      {children}
    </div>
  );
}

function renderHeading(props: Record<string, unknown>): ReactNode {
  const text = s(props, "text");
  const level = Math.min(6, Math.max(1, n(props, "level", 2)));
  const size = SIZE_HEADING[s(props, "size", "xl")] ?? SIZE_HEADING.xl;
  const align = ALIGN[s(props, "align", "left")] ?? "";
  const color = s(props, "color");
  const style = color ? { color } : undefined;
  const className = cn("font-display font-semibold leading-tight tracking-tight", size, align);
  switch (level) {
    case 1:
      return (
        <h1 className={className} style={style}>
          {text}
        </h1>
      );
    case 2:
      return (
        <h2 className={className} style={style}>
          {text}
        </h2>
      );
    case 3:
      return (
        <h3 className={className} style={style}>
          {text}
        </h3>
      );
    case 4:
      return (
        <h4 className={className} style={style}>
          {text}
        </h4>
      );
    case 5:
      return (
        <h5 className={className} style={style}>
          {text}
        </h5>
      );
    default:
      return (
        <h6 className={className} style={style}>
          {text}
        </h6>
      );
  }
}

function renderText(props: Record<string, unknown>): ReactNode {
  const text = s(props, "text");
  const size = SIZE_TEXT[s(props, "size", "md")] ?? SIZE_TEXT.md;
  const align = ALIGN[s(props, "align", "left")] ?? "";
  const color = s(props, "color");
  const style = color ? { color } : undefined;
  return (
    <p className={cn("leading-relaxed text-foreground/85", size, align)} style={style}>
      {parseInlineMarkdown(text)}
    </p>
  );
}

function renderRich(props: Record<string, unknown>): ReactNode {
  const doc = props.doc;
  return <div className="prose prose-neutral max-w-none dark:prose-invert">{renderDoc(doc)}</div>;
}

function focalPosition(
  m: { focalX: number | null; focalY: number | null } | undefined,
): string | undefined {
  if (!m) return undefined;
  const x = typeof m.focalX === "number" ? m.focalX : 50;
  const y = typeof m.focalY === "number" ? m.focalY : 50;
  if (x === 50 && y === 50) return undefined;
  return `${x}% ${y}%`;
}

function renderImage(props: Record<string, unknown>, ctx: RenderContext): ReactNode {
  const id = s(props, "src");
  const m = id ? ctx.mediaMap.get(id) : undefined;
  const alt = s(props, "alt") || m?.alt || "";
  const width = s(props, "width", "full");
  const ratio = s(props, "aspectRatio", "auto");
  const rounded = b(props, "rounded", true);
  const widthCls =
    width === "sm"
      ? "max-w-[320px]"
      : width === "md"
        ? "max-w-[640px]"
        : width === "lg"
          ? "max-w-[960px]"
          : "w-full";
  if (!m?.url) {
    return (
      <div
        className={cn(
          "mx-auto flex aspect-video items-center justify-center rounded border border-dashed bg-muted/30 text-xs text-muted-foreground",
          widthCls,
          rounded && "rounded-2xl",
        )}
      >
        Sin imagen
      </div>
    );
  }
  return (
    <div
      className={cn("mx-auto overflow-hidden", widthCls, rounded && "rounded-2xl", ASPECT[ratio])}
    >
      <Image
        src={m.url}
        alt={alt}
        width={m.width ?? 1280}
        height={m.height ?? 720}
        className="h-full w-full object-cover"
        style={{ objectPosition: focalPosition(m) }}
        sizes="(max-width: 768px) 100vw, 1280px"
      />
    </div>
  );
}

function renderGallery(props: Record<string, unknown>, ctx: RenderContext): ReactNode {
  const itemsRaw = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const cols = String(n(props, "columns", 3));
  const gap = s(props, "gap", "gap-3");
  return (
    <div className={cn("mx-auto grid w-full max-w-5xl", COLS[cols] ?? COLS["3"], gap)}>
      {itemsRaw.map((it, i) => {
        const id = typeof it.src === "string" ? it.src : "";
        const m = id ? ctx.mediaMap.get(id) : undefined;
        const alt = (typeof it.alt === "string" ? it.alt : "") || m?.alt || "";
        if (!m?.url) {
          return (
            <div
              key={`g-${i}-${id}`}
              className="aspect-square rounded-xl border border-dashed bg-muted/30"
            />
          );
        }
        return (
          <div key={`g-${i}-${id}`} className="aspect-square overflow-hidden rounded-xl">
            <Image
              src={m.url}
              alt={alt}
              width={m.width ?? 800}
              height={m.height ?? 800}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              style={{ objectPosition: focalPosition(m) }}
              sizes="(max-width: 768px) 50vw, 320px"
            />
          </div>
        );
      })}
    </div>
  );
}

function videoEmbedUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return raw;
  } catch {
    return null;
  }
}

function renderVideo(props: Record<string, unknown>): ReactNode {
  const url = videoEmbedUrl(s(props, "url"));
  const ratio = ASPECT[s(props, "aspectRatio", "16/9")] ?? ASPECT["16/9"];
  if (!url) {
    return (
      <div className="mx-auto flex aspect-video w-full max-w-3xl items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
        Sin URL de vídeo
      </div>
    );
  }
  return (
    <div className={cn("mx-auto w-full max-w-3xl overflow-hidden rounded-xl", ratio)}>
      <iframe
        src={url}
        title="Vídeo"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}

function renderEmbed(props: Record<string, unknown>): ReactNode {
  const url = s(props, "url");
  const height = n(props, "height", 480);
  if (!url) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center rounded-xl border border-dashed p-12 text-xs text-muted-foreground">
        Sin URL para embeber
      </div>
    );
  }
  return (
    <iframe
      src={url}
      title="Embed"
      className="mx-auto w-full max-w-3xl rounded-xl border"
      style={{ height }}
      loading="lazy"
    />
  );
}

const BTN_VARIANTS: Record<string, string> = {
  primary: "bg-foreground text-background hover:opacity-90 shadow-sm",
  secondary: "bg-primary/12 text-foreground hover:bg-primary/20",
  ghost: "hover:bg-muted",
  outline: "border border-foreground/15 hover:bg-muted",
};
const BTN_SIZES: Record<string, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-13 px-6 text-base rounded-xl",
};

function renderButton(props: Record<string, unknown>): ReactNode {
  const text = s(props, "text", "Botón");
  const href = s(props, "href", "#");
  const variant = s(props, "variant", "primary");
  const size = s(props, "size", "md");
  const align = s(props, "align", "left");
  return (
    <div
      className={cn(
        "flex w-full",
        align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start",
      )}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 font-medium transition-all",
          BTN_VARIANTS[variant] ?? BTN_VARIANTS.primary,
          BTN_SIZES[size] ?? BTN_SIZES.md,
        )}
      >
        {text}
      </Link>
    </div>
  );
}

function renderCta(props: Record<string, unknown>): ReactNode {
  const eyebrow = s(props, "eyebrow");
  const title = s(props, "title");
  const subtitle = s(props, "subtitle");
  const align = s(props, "align", "center");
  const primaryText = s(props, "primaryText");
  const primaryHref = s(props, "primaryHref", "#");
  const secondaryText = s(props, "secondaryText");
  const secondaryHref = s(props, "secondaryHref", "#");
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-5",
        ALIGN[align],
        align === "center" && "items-center",
      )}
    >
      {eyebrow ? (
        <span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      ) : null}
      {title ? (
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p className="max-w-prose text-pretty text-base leading-relaxed text-foreground/80 md:text-lg">
          {parseInlineMarkdown(subtitle)}
        </p>
      ) : null}
      {primaryText || secondaryText ? (
        <div className={cn("mt-2 flex flex-wrap gap-3", align === "center" && "justify-center")}>
          {primaryText ? (
            <Link
              href={primaryHref}
              className={cn(
                "inline-flex items-center gap-2 font-medium transition-all",
                BTN_VARIANTS.primary,
                BTN_SIZES.lg,
              )}
            >
              {primaryText}
            </Link>
          ) : null}
          {secondaryText ? (
            <Link
              href={secondaryHref}
              className={cn(
                "inline-flex items-center gap-2 font-medium transition-all",
                BTN_VARIANTS.outline,
                BTN_SIZES.lg,
              )}
            >
              {secondaryText}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderHero(props: Record<string, unknown>, ctx: RenderContext): ReactNode {
  const badge = s(props, "badge");
  const title = s(props, "title");
  const subtitle = s(props, "subtitle");
  const primaryText = s(props, "primaryText");
  const primaryHref = s(props, "primaryHref", "#");
  const secondaryText = s(props, "secondaryText");
  const secondaryHref = s(props, "secondaryHref", "#");
  const layout = s(props, "layout", "centered");
  const background = s(props, "background", "aurora");
  const imgId = s(props, "image");
  const m = imgId ? ctx.mediaMap.get(imgId) : undefined;

  const bg =
    background === "aurora"
      ? "absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.78_0.18_290_/.18),transparent_70%),radial-gradient(40%_40%_at_80%_100%,oklch(0.72_0.25_340_/.15),transparent_60%)]"
      : background === "grid"
        ? "absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0.7_0_0_/.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.7_0_0_/.06)_1px,transparent_1px)] bg-[size:48px_48px]"
        : "";

  const TitleAndCopy = (
    <>
      {badge ? (
        <span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
          {badge}
        </span>
      ) : null}
      {title ? (
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p className="max-w-prose text-pretty text-base leading-relaxed text-foreground/80 md:text-xl">
          {parseInlineMarkdown(subtitle)}
        </p>
      ) : null}
      {primaryText || secondaryText ? (
        <div className={cn("mt-4 flex flex-wrap gap-3", layout === "centered" && "justify-center")}>
          {primaryText ? (
            <Link
              href={primaryHref}
              className={cn(
                "inline-flex items-center gap-2 font-medium transition-all",
                BTN_VARIANTS.primary,
                BTN_SIZES.lg,
              )}
            >
              {primaryText}
            </Link>
          ) : null}
          {secondaryText ? (
            <Link
              href={secondaryHref}
              className={cn(
                "inline-flex items-center gap-2 font-medium transition-all",
                BTN_VARIANTS.outline,
                BTN_SIZES.lg,
              )}
            >
              {secondaryText}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (layout === "split" && m?.url) {
    return (
      <div className="relative isolate w-full">
        <div className={bg} />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
          <div className="flex flex-col gap-5">{TitleAndCopy}</div>
          <div className="overflow-hidden rounded-2xl">
            <Image
              src={m.url}
              alt={m.alt ?? ""}
              width={m.width ?? 1200}
              height={m.height ?? 900}
              className="h-full w-full object-cover"
              style={{ objectPosition: focalPosition(m) }}
              sizes="(max-width: 768px) 100vw, 600px"
              priority
            />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative isolate w-full">
      <div className={bg} />
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-6 py-24 text-center md:py-32">
        {TitleAndCopy}
      </div>
    </div>
  );
}

function renderMotionHero(props: Record<string, unknown>): ReactNode {
  const allowed: MotionHeroVariant[] = [
    "aurora",
    "magnetic",
    "spotlight",
    "typewriter",
    "marquee",
    "particles",
  ];
  const rawVariant = s(props, "variant");
  const variant: MotionHeroVariant = allowed.includes(rawVariant as MotionHeroVariant)
    ? (rawVariant as MotionHeroVariant)
    : "aurora";

  // marqueeItems puede llegar como string[] (defaults legacy) o {label}[] (Inspector items).
  const rawItems = props.marqueeItems;
  let marqueeItems: string[] | undefined;
  if (Array.isArray(rawItems)) {
    marqueeItems = rawItems
      .map((it) => {
        if (typeof it === "string") return it;
        if (it && typeof it === "object" && typeof (it as { label?: unknown }).label === "string") {
          return (it as { label: string }).label;
        }
        return null;
      })
      .filter((x): x is string => !!x);
  }

  return (
    <MotionHero
      variant={variant}
      title={s(props, "title") || "Construye algo espectacular"}
      badge={s(props, "badge") || undefined}
      subtitle={s(props, "subtitle") || undefined}
      primaryText={s(props, "primaryText") || undefined}
      primaryHref={(isSafeUrl(s(props, "primaryHref")) ? s(props, "primaryHref") : "#") || "#"}
      secondaryText={s(props, "secondaryText") || undefined}
      secondaryHref={
        (isSafeUrl(s(props, "secondaryHref")) ? s(props, "secondaryHref") : "#") || "#"
      }
      marqueeItems={marqueeItems}
    />
  );
}

function lucideIcon(name: string, className?: string): ReactNode {
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[name];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}

function renderFeaturesGrid(props: Record<string, unknown>): ReactNode {
  const title = s(props, "title");
  const subtitle = s(props, "subtitle");
  const cols = String(n(props, "columns", 3));
  const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
  return (
    <div className="mx-auto w-full max-w-6xl">
      {title || subtitle ? (
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          {title ? (
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-prose text-base text-foreground/75 md:text-lg">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className={cn("grid gap-6", COLS[cols] ?? COLS["3"])}>
        {items.map((it, i) => {
          const icon = typeof it.icon === "string" ? it.icon : "Sparkles";
          const ititle = typeof it.title === "string" ? it.title : "";
          const idesc = typeof it.description === "string" ? it.description : "";
          return (
            <div
              key={`f-${i}-${ititle}`}
              className="group flex flex-col gap-3 rounded-2xl border bg-card/40 p-6 backdrop-blur transition-colors hover:bg-card/60"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {lucideIcon(icon, "size-5")}
              </div>
              <h3 className="font-display text-lg font-semibold">{ititle}</h3>
              <p className="text-sm leading-relaxed text-foreground/75">{idesc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderPricing(props: Record<string, unknown>): ReactNode {
  const title = s(props, "title");
  const subtitle = s(props, "subtitle");
  const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
  return (
    <div className="mx-auto w-full max-w-6xl">
      {title || subtitle ? (
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          {title ? (
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="max-w-prose text-foreground/75">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className={cn("grid gap-6", items.length >= 3 ? COLS["3"] : COLS["2"])}>
        {items.map((it, i) => {
          const name = String(it.name ?? "Plan");
          const price = String(it.price ?? "0");
          const currency = String(it.currency ?? "€");
          const interval = String(it.interval ?? "mes");
          const features = String(it.features ?? "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const cta = String(it.cta ?? "Elegir");
          const href = String(it.href ?? "#");
          const highlight = Boolean(it.highlight);
          return (
            <div
              key={`p-${i}-${name}`}
              className={cn(
                "flex flex-col gap-5 rounded-2xl border p-7",
                highlight ? "border-primary bg-primary/8 ring-2 ring-primary/30" : "bg-card/40",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">{name}</h3>
                {highlight ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] uppercase tracking-wider text-primary">
                    Popular
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">
                  {currency}
                  {price}
                </span>
                <span className="text-sm text-foreground/65">/{interval}</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {features.map((f, j) => (
                  <li key={`f-${j}-${f.slice(0, 8)}`} className="flex items-start gap-2">
                    {lucideIcon("Check", "mt-0.5 size-4 shrink-0 text-primary")}
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                className={cn(
                  "mt-auto inline-flex items-center justify-center gap-2 font-medium transition-all",
                  highlight ? BTN_VARIANTS.primary : BTN_VARIANTS.outline,
                  BTN_SIZES.md,
                )}
              >
                {cta}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderTestimonials(props: Record<string, unknown>, ctx: RenderContext): ReactNode {
  const title = s(props, "title");
  const cols = String(n(props, "columns", 2));
  const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
  return (
    <div className="mx-auto w-full max-w-6xl">
      {title ? (
        <h2 className="mb-10 text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
      ) : null}
      <div className={cn("grid gap-6", COLS[cols] ?? COLS["2"])}>
        {items.map((it, i) => {
          const quote = String(it.quote ?? "");
          const author = String(it.author ?? "");
          const role = String(it.role ?? "");
          const avatarId = typeof it.avatar === "string" ? it.avatar : "";
          const m = avatarId ? ctx.mediaMap.get(avatarId) : undefined;
          return (
            <figure
              key={`t-${i}-${author}`}
              className="flex flex-col gap-5 rounded-2xl border bg-card/40 p-7"
            >
              <blockquote className="text-pretty text-lg leading-relaxed text-foreground/90">
                “{quote}”
              </blockquote>
              <figcaption className="flex items-center gap-3">
                {m?.url ? (
                  <Image
                    src={m.url}
                    alt={author}
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {(author[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">{author}</div>
                  <div className="text-xs text-foreground/65">{role}</div>
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function renderFaq(props: Record<string, unknown>): ReactNode {
  const title = s(props, "title");
  const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
  return (
    <div className="mx-auto w-full max-w-3xl">
      {title ? (
        <h2 className="mb-8 text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-2">
        {items.map((it, i) => {
          const q = String(it.question ?? "");
          const a = String(it.answer ?? "");
          return (
            <details
              key={`q-${i}-${q.slice(0, 8)}`}
              className="group rounded-xl border bg-card/40 px-5 py-4 transition-colors open:bg-card/60"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-medium">
                <span>{q}</span>
                {lucideIcon(
                  "ChevronDown",
                  "size-4 shrink-0 transition-transform group-open:rotate-180",
                )}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                {parseInlineMarkdown(a)}
              </p>
            </details>
          );
        })}
      </div>
    </div>
  );
}

// Reutiliza `isSafeUrl` del registry para defense-in-depth en hrefs
// parseados desde longtext (footer columns) que NO pasan por validateProps
// individualmente. Bloquea javascript:/data:/file:/protocol-relative igual.
function parseLink(line: string): { text: string; href: string } | null {
  const idx = line.indexOf("|");
  if (idx === -1) return null;
  const text = line.slice(0, idx).trim();
  const href = line.slice(idx + 1).trim();
  if (!text || !href) return null;
  if (!isSafeUrl(href)) return null;
  return { text, href };
}

function renderFooterCols(props: Record<string, unknown>): ReactNode {
  const brand = s(props, "brand");
  const tagline = s(props, "tagline");
  const copyright = s(props, "copyright");
  const cols = Array.isArray(props.columns)
    ? (props.columns as Array<Record<string, unknown>>)
    : [];
  return (
    <footer className="mx-auto w-full max-w-6xl">
      <div className="grid gap-10 border-y py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="font-display text-lg font-semibold">{brand}</div>
          <p className="mt-2 text-sm text-foreground/70">{tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 md:col-span-3 md:grid-cols-3">
          {cols.map((c, i) => {
            const ctitle = String(c.title ?? "");
            const linksRaw = String(c.links ?? "")
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .map(parseLink)
              .filter((l): l is { text: string; href: string } => l !== null);
            return (
              <div key={`fc-${i}-${ctitle}`}>
                <div className="text-sm font-semibold">{ctitle}</div>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/75">
                  {linksRaw.map((l, j) => (
                    <li key={`fl-${j}-${l.href}`}>
                      <Link href={l.href} className="hover:text-foreground">
                        {l.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      {copyright ? (
        <div className="py-6 text-center text-xs text-foreground/55">{copyright}</div>
      ) : null}
    </footer>
  );
}

function renderSpacer(props: Record<string, unknown>): ReactNode {
  const size = s(props, "size", "md");
  const h: Record<string, string> = { sm: "h-4", md: "h-10", lg: "h-24", xl: "h-40" };
  return <div aria-hidden className={h[size] ?? "h-10"} />;
}

function renderDivider(props: Record<string, unknown>): ReactNode {
  const color = s(props, "color");
  return (
    <hr
      className="mx-auto w-full max-w-5xl border-foreground/10"
      style={color ? { borderColor: color } : undefined}
    />
  );
}

function renderSymbol(
  props: Record<string, unknown>,
  ctx: RenderContext,
  bp?: Breakpoint,
): ReactNode {
  const id = s(props, "symbolId");
  if (!id) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
        Selecciona un símbolo
      </div>
    );
  }
  const sym = ctx.symbolMap.get(id);
  if (!sym) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
        Símbolo no encontrado
      </div>
    );
  }
  return <RenderLayout layout={sym.layout} ctx={ctx} breakpoint={bp} />;
}

// ---------------- inline markdown ----------------
/** Soporte mínimo para **bold** y *italic* en strings de propiedades */
function parseInlineMarkdown(text: string): ReactNode {
  if (!text) return null;
  // Token simple: **x** → strong, *x* → em
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const boldStart = text.indexOf("**", i);
    const italStart = text.indexOf("*", i);
    let next = -1;
    let mode: "bold" | "ital" | null = null;
    if (boldStart !== -1 && (italStart === -1 || boldStart <= italStart)) {
      next = boldStart;
      mode = "bold";
    } else if (italStart !== -1) {
      next = italStart;
      mode = "ital";
    }
    if (next === -1 || mode === null) {
      parts.push(text.slice(i));
      break;
    }
    if (next > i) parts.push(text.slice(i, next));
    if (mode === "bold") {
      const end = text.indexOf("**", next + 2);
      if (end === -1) {
        parts.push(text.slice(next));
        break;
      }
      const inner = text.slice(next + 2, end);
      parts.push(<strong key={`b-${key++}`}>{inner}</strong>);
      i = end + 2;
    } else {
      const end = text.indexOf("*", next + 1);
      if (end === -1) {
        parts.push(text.slice(next));
        break;
      }
      const inner = text.slice(next + 1, end);
      parts.push(<em key={`i-${key++}`}>{inner}</em>);
      i = end + 1;
    }
  }
  return <>{parts}</>;
}
