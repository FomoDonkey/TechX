import { shouldShow } from "@/blocks/audience";
import { type BlockSpec, getBlockSpec, validateProps } from "@/blocks/registry";
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
  const trimmed = bypass ? layout : trimLayoutForViewer(layout, viewer).layout;
  const visible = trimmed.filter((n) => !n.hidden?.[breakpoint ?? "desktop"]);
  return (
    <>
      {visible.map((node) => (
        <Fragment key={node.id}>{renderNode(node, ctx, breakpoint)}</Fragment>
      ))}
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

    if (node.children?.length) {
      const sub = trimLayoutForViewer(node.children, viewer);
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
    default:
      return (
        <div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
          Bloque desconocido: {spec.label}
        </div>
      );
  }
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

function parseLink(line: string): { text: string; href: string } | null {
  const idx = line.indexOf("|");
  if (idx === -1) return null;
  const text = line.slice(0, idx).trim();
  const href = line.slice(idx + 1).trim();
  if (!text || !href) return null;
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
