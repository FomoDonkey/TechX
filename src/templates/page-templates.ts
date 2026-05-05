/**
 * Catálogo de plantillas de página predefinidas.
 *
 * Cada template combina bloques del registry en un layout listo para insertar
 * como página nueva. Las composiciones están diferenciadas — no son todas
 * "hero + features + pricing + cta": un portfolio se ve como portfolio, un
 * blog como blog, un newsletter como Substack, etc.
 *
 * NO confundir con "Temas" (`/admin/temas`) — los temas reescriben tipografías
 * y paletas globalmente; los templates son composiciones de contenido.
 */

import { type BlockNode, newId } from "@/blocks/types";

export type PageTemplateCategory = "saas" | "portfolio" | "blog" | "newsletter" | "launch";

/**
 * Mini-tema visual de la plantilla. Sobreescribe las CSS variables del
 * preview wrapper para dar paleta + tipografía propia a cada plantilla.
 *
 * Las vars override los defaults globales (`--background`, `--foreground`,
 * `--primary`, `--card`, `--muted`, `--accent`, `--border`...). Aplicado en
 * `/template-preview/[id]` sobre el `<main>`. Bloques internos heredan vía
 * Tailwind tokens (`bg-background`, `text-foreground`, etc).
 */
export type TemplateTheme = {
  /** CSS custom properties a inyectar en el wrapper. */
  vars: Record<string, string>;
  /** Clase extra al body (ej: `font-serif`). */
  bodyClass?: string;
};

export type PageTemplate = {
  id: string;
  name: string;
  description: string;
  category: PageTemplateCategory;
  /** Hero variant que predomina (se usa en chips/etiquetas, no para preview). */
  accent: "aurora" | "magnetic" | "spotlight" | "typewriter" | "marquee" | "particles";
  /** Tags visibles bajo el card. */
  tags: string[];
  /** Título sugerido al crear la página. */
  suggestedTitle: string;
  /** Tema visual aplicado al preview wrapper. */
  theme: TemplateTheme;
  /** Constructor del layout — lazy para que cada uso tenga ids frescos. */
  buildLayout: () => BlockNode[];
};

// ---- helpers para construir nodos ----

function node(kind: string, props: Record<string, unknown>, children?: BlockNode[]): BlockNode {
  const n: BlockNode = { id: newId(), kind, props };
  if (children && children.length > 0) n.children = children;
  return n;
}

const motionHero = (variant: PageTemplate["accent"], props: Record<string, unknown>): BlockNode =>
  node("motion-hero", { variant, ...props });

const section = (props: Record<string, unknown>, children: BlockNode[]): BlockNode =>
  node("section", props, children);

const container = (props: Record<string, unknown>, children: BlockNode[]): BlockNode =>
  node("container", props, children);

const columns = (props: Record<string, unknown>, children: BlockNode[]): BlockNode =>
  node("columns", props, children);

const heading = (text: string, level: 1 | 2 | 3 = 2, align = "center"): BlockNode =>
  node("heading", { text, level, align, size: "lg" });

const text = (body: string, align = "center", size = "md"): BlockNode =>
  node("text", { text: body, align, size, maxWidth: "lg" });

const featuresGrid = (
  title: string,
  subtitle: string,
  items: Array<{ icon: string; title: string; description: string }>,
): BlockNode =>
  node("features-grid", {
    title,
    subtitle,
    columns: items.length === 4 ? 4 : items.length === 6 ? 3 : 3,
    items,
  });

const pricing = (
  title: string,
  items: Array<{
    name: string;
    price: string;
    period?: string;
    features: string[];
    ctaText: string;
    ctaHref: string;
    highlighted?: boolean;
  }>,
): BlockNode => node("pricing", { title, items });

const testimonials = (
  title: string,
  items: Array<{ quote: string; author: string; role?: string }>,
): BlockNode => node("testimonials", { title, items });

const faq = (title: string, items: Array<{ question: string; answer: string }>): BlockNode =>
  node("faq", { title, items });

const cta = (title: string, subtitle: string, primaryText: string, primaryHref = "#"): BlockNode =>
  node("cta", { title, subtitle, primaryText, primaryHref });

const spacer = (size: "sm" | "md" | "lg" = "md"): BlockNode => node("spacer", { size });

const divider = (): BlockNode => node("divider", {});

const gallery = (imgs: Array<{ src: string; alt: string }>, cols: 2 | 3 | 4 = 3): BlockNode =>
  node("gallery", { items: imgs, columns: cols, gap: "gap-3" });

const footerCols = (
  brand: string,
  tagline: string,
  cols: Array<{ title: string; links: string }>,
): BlockNode =>
  node("footer-cols", {
    brand,
    tagline,
    columns: cols,
    copyright: `© 2026 ${brand}. Todos los derechos reservados.`,
  });

// Imágenes placeholder de Unsplash (whitelisted en CSP del CMS).
const UNSPLASH = (id: string, w = 800, h = 600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop`;

// ============================================================
// THEMES — paletas distintivas por plantilla
// ============================================================
// Dark violet (default — vibe SaaS futurista)
const THEME_DARK_VIOLET: TemplateTheme = {
  vars: {
    "--background": "oklch(0.13 0.015 280)",
    "--foreground": "oklch(0.97 0.01 280)",
    "--card": "oklch(0.17 0.015 280)",
    "--muted": "oklch(0.22 0.015 280)",
    "--muted-foreground": "oklch(0.7 0.015 280)",
    "--primary": "oklch(0.72 0.2 290)",
    "--accent": "oklch(0.78 0.22 340)",
    "--border": "oklch(0.27 0.015 280)",
  },
};

// Brutalist black/white — Portfolio
const THEME_MONOCHROME: TemplateTheme = {
  vars: {
    "--background": "oklch(0.98 0 0)",
    "--foreground": "oklch(0.08 0 0)",
    "--card": "oklch(1 0 0)",
    "--muted": "oklch(0.93 0 0)",
    "--muted-foreground": "oklch(0.45 0 0)",
    "--primary": "oklch(0.08 0 0)",
    "--accent": "oklch(0.55 0.25 25)",
    "--border": "oklch(0.08 0 0)",
  },
};

// Mint freshness — Coming Soon
const THEME_MINT: TemplateTheme = {
  vars: {
    "--background": "oklch(0.98 0.02 165)",
    "--foreground": "oklch(0.18 0.04 170)",
    "--card": "oklch(1 0 0)",
    "--muted": "oklch(0.94 0.04 165)",
    "--muted-foreground": "oklch(0.45 0.05 170)",
    "--primary": "oklch(0.65 0.18 165)",
    "--accent": "oklch(0.7 0.18 175)",
    "--border": "oklch(0.85 0.04 165)",
  },
};

// Stripe-style indigo — Docs
const THEME_INDIGO: TemplateTheme = {
  vars: {
    "--background": "oklch(0.99 0.005 250)",
    "--foreground": "oklch(0.18 0.04 250)",
    "--card": "oklch(1 0 0)",
    "--muted": "oklch(0.95 0.02 245)",
    "--muted-foreground": "oklch(0.45 0.04 250)",
    "--primary": "oklch(0.5 0.2 250)",
    "--accent": "oklch(0.6 0.22 240)",
    "--border": "oklch(0.88 0.02 245)",
  },
};

// Cream + serif — Magazine vibe
const THEME_PAPER: TemplateTheme = {
  vars: {
    "--background": "oklch(0.97 0.025 80)",
    "--foreground": "oklch(0.18 0.03 60)",
    "--card": "oklch(1 0.01 80)",
    "--muted": "oklch(0.92 0.03 80)",
    "--muted-foreground": "oklch(0.4 0.04 60)",
    "--primary": "oklch(0.32 0.08 35)",
    "--accent": "oklch(0.55 0.18 30)",
    "--border": "oklch(0.83 0.03 80)",
  },
  bodyClass: "csm-theme-serif",
};

// Black + neon yellow — Brutalist startup B2B
const THEME_BRUTAL_YELLOW: TemplateTheme = {
  vars: {
    "--background": "oklch(0.08 0.005 110)",
    "--foreground": "oklch(0.98 0.02 100)",
    "--card": "oklch(0.13 0.01 110)",
    "--muted": "oklch(0.18 0.01 110)",
    "--muted-foreground": "oklch(0.7 0.02 100)",
    "--primary": "oklch(0.95 0.22 105)",
    "--accent": "oklch(0.92 0.2 95)",
    "--border": "oklch(0.95 0.22 105)",
  },
};

// Sepia + serif — Substack newsletter
const THEME_SEPIA: TemplateTheme = {
  vars: {
    "--background": "oklch(0.95 0.018 60)",
    "--foreground": "oklch(0.2 0.04 40)",
    "--card": "oklch(0.98 0.012 60)",
    "--muted": "oklch(0.9 0.025 60)",
    "--muted-foreground": "oklch(0.42 0.05 45)",
    "--primary": "oklch(0.4 0.12 30)",
    "--accent": "oklch(0.55 0.16 35)",
    "--border": "oklch(0.78 0.04 50)",
  },
  bodyClass: "csm-theme-serif",
};

// Pure black + neon orange — Agency premium
const THEME_NEON_AGENCY: TemplateTheme = {
  vars: {
    "--background": "oklch(0.06 0 0)",
    "--foreground": "oklch(0.98 0 0)",
    "--card": "oklch(0.11 0 0)",
    "--muted": "oklch(0.16 0 0)",
    "--muted-foreground": "oklch(0.65 0 0)",
    "--primary": "oklch(0.78 0.2 50)",
    "--accent": "oklch(0.85 0.22 55)",
    "--border": "oklch(0.2 0 0)",
  },
};

// ============================================================
// TEMPLATES — cada una con composición DISTINTA
// ============================================================

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ---------------------------------------------------------------
  // 1. SaaS clásico — la única con estructura "tradicional" hero+features+pricing
  // ---------------------------------------------------------------
  {
    id: "saas-magnetic",
    name: "SaaS Magnético — Asme Liquid Glass",
    description:
      "Hero fullscreen con vídeo crossfade + glass nav, about italic, vídeo destacado con glass card, split innovación×visión, 2 service cards y CTA glass. Espectáculo Asme 1:1.",
    category: "saas",
    accent: "magnetic",
    tags: ["SaaS", "Liquid Glass", "Vídeo HLS"],
    suggestedTitle: "Producto SaaS",
    theme: THEME_DARK_VIOLET,
    buildLayout: () => [
      // Cada nodo usa los defaults definidos en el spec del block — el render
      // los aplica via validateProps(). Aquí pasamos {} para que entren los
      // defaults del spec (que ya son la versión espectacular completa).
      node("tpl-asme-hero", {}),
      node("tpl-asme-about", {}),
      node("tpl-asme-featured-video", {}),
      node("tpl-asme-split-vision", {}),
      node("tpl-asme-service-cards", {}),
      node("tpl-asme-cta", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 2. Portfolio — Jack 3D Creator (sticky stack, magnetic portrait, marquee)
  // ---------------------------------------------------------------
  {
    id: "portfolio-spotlight",
    name: "Portfolio Spotlight — Jack 3D Creator",
    description:
      "Hero magnético + retrato + marquee scroll-driven 21 GIFs en 2 filas + char-reveal about con corners 3D + 5 servicios numerados + 3 sticky stacking project cards. Estilo Kanit dark.",
    category: "portfolio",
    accent: "spotlight",
    tags: ["Portfolio", "3D Creator", "Sticky Stack"],
    suggestedTitle: "Estudio creativo",
    theme: THEME_MONOCHROME,
    buildLayout: () => [
      node("tpl-jack-hero", {}),
      node("tpl-jack-marquee", {}),
      node("tpl-jack-about", {}),
      node("tpl-jack-services", {}),
      node("tpl-jack-projects", {}),
      node("tpl-jack-cta", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 3. Coming Soon — Mint Pre-launch (countdown live + email capture + roadmap)
  // ---------------------------------------------------------------
  {
    id: "coming-soon-typewriter",
    name: "Coming Soon — Mint Pre-Launch",
    description:
      "Hero countdown live (días/h/min/seg) con vídeo bg + email capture liquid-glass + 3 perks + roadmap timeline. Paleta mint #4ee0a5.",
    category: "launch",
    accent: "typewriter",
    tags: ["Pre-lanzamiento", "Countdown", "Email Capture"],
    suggestedTitle: "Próximamente",
    theme: THEME_MINT,
    buildLayout: () => [
      node("tpl-mint-hero", {}),
      node("tpl-mint-perks", {}),
      node("tpl-mint-roadmap", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 4. Docs / Producto — Nimbus / Power AI (gradient hero + docs grid + code sample)
  // ---------------------------------------------------------------
  {
    id: "docs-aurora",
    name: "Docs / Producto — Nimbus AI",
    description:
      "Hero gradient indigo→purple→amber con vídeo bg + nav + logo marquee + docs grid 6 + quick-start split con code sample + community Discord CTA.",
    category: "saas",
    accent: "aurora",
    tags: ["Docs", "AI", "Gradient"],
    suggestedTitle: "Documentación",
    theme: THEME_INDIGO,
    buildLayout: () => [
      node("tpl-nimbus-hero", {}),
      node("tpl-nimbus-docs-grid", {}),
      node("tpl-nimbus-quick-start", {}),
      node("tpl-nimbus-community", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 5. Blog Magazine — Magazine paper editorial cálido
  // ---------------------------------------------------------------
  {
    id: "blog-particles",
    name: "Blog Magazine — Editorial Paper",
    description:
      "Masthead serif + featured story 8/4 con sidebar + categorías grid colored sobre dark + 3-col stories + newsletter inline. Tipografía Newsreader serif cálido.",
    category: "blog",
    accent: "particles",
    tags: ["Blog", "Magazine", "Editorial Paper"],
    suggestedTitle: "Blog",
    theme: THEME_PAPER,
    buildLayout: () => [
      node("tpl-magazine-masthead", {}),
      node("tpl-magazine-featured", {}),
      node("tpl-magazine-categories", {}),
      node("tpl-magazine-stories", {}),
      node("tpl-magazine-newsletter", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 6. Product Launch B2B — Securify+Targo (staggered headline + glass widget + pricing clipped)
  // ---------------------------------------------------------------
  {
    id: "launch-marquee",
    name: "Product Launch B2B — Securify Dark",
    description:
      "Hero staggered con vídeo bg + 3 stats absolutas + glass widget consultoría + sectors marquee + 3 pillars + pricing 2-tier con clipped corners + CTA. B2B premium dark.",
    category: "launch",
    accent: "marquee",
    tags: ["Lanzamiento", "B2B", "Dark", "Clipped"],
    suggestedTitle: "Lanzamiento producto",
    theme: THEME_BRUTAL_YELLOW,
    buildLayout: () => [
      node("tpl-securify-hero", {}),
      node("tpl-security-sectors", {}),
      node("tpl-security-pillars", {}),
      node("tpl-security-pricing", {}),
      node("tpl-security-cta", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 7. Newsletter Substack premium
  // ---------------------------------------------------------------
  {
    id: "newsletter-typewriter",
    name: "Newsletter Premium — Substack",
    description:
      "Header serif + hero italic con signup card + preview número con paywall fade + testimonio gigante + pricing 2-tier elegante + archive list con badges Free/Premium + footer.",
    category: "newsletter",
    accent: "typewriter",
    tags: ["Newsletter", "Substack", "Paywall Fade"],
    suggestedTitle: "Mi newsletter",
    theme: THEME_SEPIA,
    buildLayout: () => [
      node("tpl-substack-header", {}),
      node("tpl-substack-hero", {}),
      node("tpl-substack-preview", {}),
      node("tpl-substack-testimonial", {}),
      node("tpl-substack-pricing", {}),
      node("tpl-substack-archive", {}),
      node("tpl-substack-footer", {}),
    ],
  },

  // ---------------------------------------------------------------
  // 8. Agencia Brutal — Michael Smith Editorial Dark
  // ---------------------------------------------------------------
  {
    id: "agency-spotlight",
    name: "Agencia Brutal — Michael Smith Editorial",
    description:
      "Loading screen counter + glass nav + role cycling + bento 4 asimétrico + journal pills + parallax explorations + stats + footer marquee gigante. HLS video.",
    category: "portfolio",
    accent: "spotlight",
    tags: ["Agencia", "Editorial Dark", "HLS Video"],
    suggestedTitle: "Agencia",
    theme: THEME_NEON_AGENCY,
    buildLayout: () => [
      node("tpl-michael-hero", {}),
      node("tpl-michael-bento", {}),
      node("tpl-michael-journal", {}),
      node("tpl-michael-explorations", {}),
      node("tpl-michael-stats", {}),
      node("tpl-michael-contact-footer", {}),
    ],
  },
];

export function getPageTemplate(id: string): PageTemplate | null {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? null;
}

export const TEMPLATE_CATEGORIES: Array<{
  value: PageTemplateCategory | "all";
  label: string;
}> = [
  { value: "all", label: "Todas" },
  { value: "saas", label: "SaaS" },
  { value: "portfolio", label: "Portfolio" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "launch", label: "Lanzamiento" },
];
