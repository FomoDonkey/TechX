import type { ThemeSpec } from "./types";

const baseRadius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  pill: "9999px",
} as const;

const sharpRadius = {
  sm: "0.125rem",
  md: "0.25rem",
  lg: "0.375rem",
  xl: "0.5rem",
  pill: "9999px",
} as const;

const generousRadius = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  pill: "9999px",
} as const;

const baseMotion = { duration: "200ms", ease: "cubic-bezier(0.32, 0.72, 0, 1)" };

/**
 * MAGAZINE — editorial, serif, drop-cap, dramatic
 */
const magazine: ThemeSpec = {
  slug: "magazine",
  name: "Magazine",
  tagline: "Editorial cinematográfico",
  description:
    "Tipografía serif imponente, hero a sangre, capitulares y citas de columna. Para revistas, longform y redacciones.",
  preview: { gradient: "linear-gradient(135deg,#0e0d12 0%,#5b1e2c 50%,#d97757 100%)", emoji: "📰" },
  tokens: {
    colors: {
      light: {
        bg: "oklch(0.99 0.005 65)",
        bgMuted: "oklch(0.96 0.01 65)",
        bgElevated: "oklch(1 0 0)",
        fg: "oklch(0.18 0.02 50)",
        fgMuted: "oklch(0.42 0.02 50)",
        fgSubtle: "oklch(0.62 0.015 50)",
        border: "oklch(0.9 0.015 60)",
        borderStrong: "oklch(0.78 0.02 60)",
        brand: "oklch(0.45 0.18 28)",
        brandFg: "oklch(0.99 0.005 60)",
        accent: "oklch(0.62 0.18 45)",
        accentFg: "oklch(0.99 0.005 60)",
        ring: "oklch(0.45 0.18 28 / 0.5)",
        surface: "oklch(0.97 0.01 60)",
        surfaceFg: "oklch(0.18 0.02 50)",
      },
      dark: {
        bg: "oklch(0.13 0.02 30)",
        bgMuted: "oklch(0.18 0.02 30)",
        bgElevated: "oklch(0.21 0.025 30)",
        fg: "oklch(0.97 0.01 60)",
        fgMuted: "oklch(0.78 0.015 60)",
        fgSubtle: "oklch(0.6 0.015 60)",
        border: "oklch(0.28 0.025 30)",
        borderStrong: "oklch(0.4 0.03 30)",
        brand: "oklch(0.72 0.16 30)",
        brandFg: "oklch(0.13 0.02 30)",
        accent: "oklch(0.78 0.16 50)",
        accentFg: "oklch(0.13 0.02 30)",
        ring: "oklch(0.72 0.16 30 / 0.5)",
        surface: "oklch(0.18 0.02 30)",
        surfaceFg: "oklch(0.97 0.01 60)",
      },
    },
    radius: sharpRadius,
    shadow: {
      sm: "0 1px 2px 0 oklch(0 0 0 / 0.06)",
      md: "0 6px 20px -4px oklch(0 0 0 / 0.1)",
      lg: "0 20px 50px -12px oklch(0 0 0 / 0.18)",
      glow: "0 0 60px -10px oklch(0.45 0.18 28 / 0.4)",
    },
    fonts: {
      sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
      serif: '"Lora", "Source Serif Pro", "Georgia", serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
      display: '"Lora", "Playfair Display", serif',
    },
    motion: baseMotion,
    containerMax: "76rem",
    prosePadding: "1.5rem",
  },
  layouts: {
    post: "magazine",
    list: "grid-2",
    hero: "magazine",
    showToc: false,
    showAuthor: true,
    showReadingTime: true,
    showRelated: true,
    showShareBar: true,
    showSubscribeCta: true,
  },
  blockStyles: {
    heading: { wrapper: "font-serif tracking-tight" },
    text: { wrapper: "font-serif text-lg leading-relaxed" },
    hero: { wrapper: "magazine-hero" },
  },
  ogTemplate: {
    background: { kind: "gradient", from: "oklch(0.18 0.02 50)", to: "oklch(0.45 0.18 28)" },
    accent: "oklch(0.78 0.16 50)",
    font: { display: '"Lora", serif', body: '"Inter", sans-serif' },
    showLogo: true,
    showAuthor: true,
    showDate: true,
    layout: "left",
  },
  isBuiltin: true,
};

/**
 * PORTFOLIO — minimal, monochrome, generous whitespace
 */
const portfolio: ThemeSpec = {
  slug: "portfolio",
  name: "Portfolio",
  tagline: "Galería minimal y silenciosa",
  description:
    "Negros profundos, espacios generosos, full-bleed images. Para creativos, fotógrafos y studios.",
  preview: { gradient: "linear-gradient(135deg,#0a0a0a 0%,#1f1f1f 100%)", emoji: "🎨" },
  tokens: {
    colors: {
      light: {
        bg: "oklch(0.99 0 0)",
        bgMuted: "oklch(0.96 0 0)",
        bgElevated: "oklch(1 0 0)",
        fg: "oklch(0.12 0 0)",
        fgMuted: "oklch(0.4 0 0)",
        fgSubtle: "oklch(0.6 0 0)",
        border: "oklch(0.92 0 0)",
        borderStrong: "oklch(0.8 0 0)",
        brand: "oklch(0.12 0 0)",
        brandFg: "oklch(0.99 0 0)",
        accent: "oklch(0.55 0 0)",
        accentFg: "oklch(0.99 0 0)",
        ring: "oklch(0.12 0 0 / 0.4)",
        surface: "oklch(0.97 0 0)",
        surfaceFg: "oklch(0.12 0 0)",
      },
      dark: {
        bg: "oklch(0.08 0 0)",
        bgMuted: "oklch(0.13 0 0)",
        bgElevated: "oklch(0.16 0 0)",
        fg: "oklch(0.98 0 0)",
        fgMuted: "oklch(0.72 0 0)",
        fgSubtle: "oklch(0.55 0 0)",
        border: "oklch(0.22 0 0)",
        borderStrong: "oklch(0.35 0 0)",
        brand: "oklch(0.98 0 0)",
        brandFg: "oklch(0.08 0 0)",
        accent: "oklch(0.7 0 0)",
        accentFg: "oklch(0.08 0 0)",
        ring: "oklch(0.98 0 0 / 0.4)",
        surface: "oklch(0.13 0 0)",
        surfaceFg: "oklch(0.98 0 0)",
      },
    },
    radius: { sm: "0", md: "0", lg: "0", xl: "0", pill: "9999px" },
    shadow: {
      sm: "none",
      md: "none",
      lg: "0 30px 80px -30px oklch(0 0 0 / 0.5)",
      glow: "none",
    },
    fonts: {
      sans: '"Geist Sans", ui-sans-serif, system-ui, sans-serif',
      serif: '"Geist Sans", serif',
      mono: '"Geist Mono", ui-monospace, monospace',
      display: '"Geist Sans", sans-serif',
      weights: { display: [300, 500], body: [300, 400] },
    },
    motion: { duration: "350ms", ease: "cubic-bezier(0.16, 1, 0.3, 1)" },
    containerMax: "80rem",
    prosePadding: "2rem",
  },
  layouts: {
    post: "minimal",
    list: "grid-2",
    hero: "minimal",
    showToc: false,
    showAuthor: true,
    showReadingTime: false,
    showRelated: true,
    showShareBar: false,
    showSubscribeCta: false,
  },
  blockStyles: {
    heading: { wrapper: "font-light tracking-tight" },
    text: { wrapper: "font-light leading-relaxed" },
    image: { wrapper: "full-bleed" },
  },
  ogTemplate: {
    background: { kind: "solid", from: "oklch(0.08 0 0)" },
    accent: "oklch(0.98 0 0)",
    font: { display: '"Geist Sans", sans-serif', body: '"Geist Sans", sans-serif' },
    showLogo: true,
    showAuthor: false,
    showDate: false,
    layout: "centered",
  },
  isBuiltin: true,
};

/**
 * DOCS — technical, sidebar, sticky ToC, mono-heavy
 */
const docs: ThemeSpec = {
  slug: "docs",
  name: "Docs",
  tagline: "Documentación técnica nítida",
  description:
    "Sidebar navegable, ToC sticky, code blocks de primera. Para SDK docs, knowledge bases y reference sites.",
  preview: { gradient: "linear-gradient(135deg,#0b1220 0%,#1e3a8a 50%,#7c3aed 100%)", emoji: "📚" },
  tokens: {
    colors: {
      light: {
        bg: "oklch(0.99 0.003 250)",
        bgMuted: "oklch(0.97 0.005 250)",
        bgElevated: "oklch(1 0 0)",
        fg: "oklch(0.2 0.02 250)",
        fgMuted: "oklch(0.45 0.02 250)",
        fgSubtle: "oklch(0.6 0.015 250)",
        border: "oklch(0.92 0.01 250)",
        borderStrong: "oklch(0.82 0.015 250)",
        brand: "oklch(0.55 0.22 270)",
        brandFg: "oklch(0.99 0 0)",
        accent: "oklch(0.7 0.18 200)",
        accentFg: "oklch(0.99 0 0)",
        ring: "oklch(0.55 0.22 270 / 0.5)",
        surface: "oklch(0.96 0.005 250)",
        surfaceFg: "oklch(0.2 0.02 250)",
      },
      dark: {
        bg: "oklch(0.13 0.02 250)",
        bgMuted: "oklch(0.16 0.025 250)",
        bgElevated: "oklch(0.19 0.03 250)",
        fg: "oklch(0.96 0.01 250)",
        fgMuted: "oklch(0.78 0.02 250)",
        fgSubtle: "oklch(0.6 0.02 250)",
        border: "oklch(0.25 0.03 250)",
        borderStrong: "oklch(0.38 0.04 250)",
        brand: "oklch(0.72 0.2 270)",
        brandFg: "oklch(0.13 0.02 250)",
        accent: "oklch(0.78 0.16 200)",
        accentFg: "oklch(0.13 0.02 250)",
        ring: "oklch(0.72 0.2 270 / 0.5)",
        surface: "oklch(0.16 0.025 250)",
        surfaceFg: "oklch(0.96 0.01 250)",
      },
    },
    radius: baseRadius,
    shadow: {
      sm: "0 1px 2px 0 oklch(0 0 0 / 0.04)",
      md: "0 4px 12px -2px oklch(0 0 0 / 0.06)",
      lg: "0 12px 32px -8px oklch(0 0 0 / 0.1)",
      glow: "0 0 40px -8px oklch(0.55 0.22 270 / 0.35)",
    },
    fonts: {
      sans: '"Inter", "Geist Sans", ui-sans-serif, system-ui, sans-serif',
      serif: '"Inter", sans-serif',
      mono: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
      display: '"Inter", sans-serif',
    },
    motion: baseMotion,
    containerMax: "90rem",
    prosePadding: "1.25rem",
  },
  layouts: {
    post: "docs",
    list: "tree-sections",
    hero: "centered",
    showToc: true,
    showAuthor: false,
    showReadingTime: false,
    showRelated: false,
    showShareBar: false,
    showSubscribeCta: false,
  },
  blockStyles: {
    heading: { wrapper: "font-sans tracking-tight" },
  },
  ogTemplate: {
    background: { kind: "gradient", from: "oklch(0.13 0.02 250)", to: "oklch(0.55 0.22 270)" },
    accent: "oklch(0.78 0.16 200)",
    font: { display: '"Inter", sans-serif', body: '"JetBrains Mono", monospace' },
    showLogo: true,
    showAuthor: false,
    showDate: false,
    layout: "left",
  },
  isBuiltin: true,
};

/**
 * STOREFRONT — vibrant, neon accents, conversion-focused
 */
const storefront: ThemeSpec = {
  slug: "storefront",
  name: "Storefront",
  tagline: "Comercio que convierte",
  description:
    "Acentos neón, CTAs grandes, hero con producto al centro. Para tiendas, lanzamientos y SaaS marketing.",
  preview: { gradient: "linear-gradient(135deg,#0c1024 0%,#5b21b6 50%,#06b6d4 100%)", emoji: "🛒" },
  tokens: {
    colors: {
      light: {
        bg: "oklch(0.99 0.005 280)",
        bgMuted: "oklch(0.96 0.01 280)",
        bgElevated: "oklch(1 0 0)",
        fg: "oklch(0.16 0.03 280)",
        fgMuted: "oklch(0.42 0.03 280)",
        fgSubtle: "oklch(0.6 0.02 280)",
        border: "oklch(0.91 0.015 280)",
        borderStrong: "oklch(0.78 0.025 280)",
        brand: "oklch(0.55 0.25 295)",
        brandFg: "oklch(0.99 0 0)",
        accent: "oklch(0.78 0.18 195)",
        accentFg: "oklch(0.16 0.03 280)",
        ring: "oklch(0.55 0.25 295 / 0.55)",
        surface: "oklch(0.96 0.012 280)",
        surfaceFg: "oklch(0.16 0.03 280)",
      },
      dark: {
        bg: "oklch(0.1 0.03 280)",
        bgMuted: "oklch(0.14 0.035 280)",
        bgElevated: "oklch(0.18 0.04 280)",
        fg: "oklch(0.98 0.01 280)",
        fgMuted: "oklch(0.78 0.02 280)",
        fgSubtle: "oklch(0.6 0.02 280)",
        border: "oklch(0.24 0.04 280)",
        borderStrong: "oklch(0.38 0.05 280)",
        brand: "oklch(0.7 0.22 295)",
        brandFg: "oklch(0.1 0.03 280)",
        accent: "oklch(0.85 0.18 195)",
        accentFg: "oklch(0.1 0.03 280)",
        ring: "oklch(0.7 0.22 295 / 0.55)",
        surface: "oklch(0.14 0.035 280)",
        surfaceFg: "oklch(0.98 0.01 280)",
      },
    },
    radius: generousRadius,
    shadow: {
      sm: "0 2px 4px 0 oklch(0 0 0 / 0.06)",
      md: "0 8px 24px -4px oklch(0.55 0.25 295 / 0.18)",
      lg: "0 20px 60px -12px oklch(0.55 0.25 295 / 0.28)",
      glow: "0 0 80px -10px oklch(0.78 0.18 195 / 0.5)",
    },
    fonts: {
      sans: '"Geist Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
      serif: '"Geist Sans", sans-serif',
      mono: '"Geist Mono", ui-monospace, monospace',
      display: '"Geist Sans", sans-serif',
      weights: { display: [700, 800, 900], body: [400, 500] },
    },
    motion: { duration: "180ms", ease: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    containerMax: "84rem",
    prosePadding: "1.5rem",
  },
  layouts: {
    post: "wide",
    list: "grid-3",
    hero: "bold",
    showToc: false,
    showAuthor: false,
    showReadingTime: false,
    showRelated: true,
    showShareBar: true,
    showSubscribeCta: true,
  },
  blockStyles: {
    cta: { wrapper: "shadow-glow font-semibold uppercase tracking-wide" },
    hero: { wrapper: "storefront-hero" },
  },
  ogTemplate: {
    background: { kind: "gradient", from: "oklch(0.55 0.25 295)", to: "oklch(0.78 0.18 195)" },
    accent: "oklch(0.98 0.01 280)",
    font: { display: '"Geist Sans", sans-serif', body: '"Geist Sans", sans-serif' },
    showLogo: true,
    showAuthor: false,
    showDate: true,
    layout: "centered",
  },
  isBuiltin: true,
};

/**
 * NEWSLETTER — Substack-like, single column, drop-cap, subscribe CTA
 */
const newsletter: ThemeSpec = {
  slug: "newsletter",
  name: "Newsletter",
  tagline: "Para escritores con audiencia",
  description:
    "Una columna estrecha, capitulares, citas grandes y CTA de suscripción al final. Para Substack-style essays.",
  preview: { gradient: "linear-gradient(135deg,#fff7ed 0%,#fed7aa 50%,#ea580c 100%)", emoji: "✉️" },
  tokens: {
    colors: {
      light: {
        bg: "oklch(0.99 0.008 70)",
        bgMuted: "oklch(0.96 0.012 70)",
        bgElevated: "oklch(1 0 0)",
        fg: "oklch(0.18 0.02 50)",
        fgMuted: "oklch(0.42 0.025 50)",
        fgSubtle: "oklch(0.6 0.02 50)",
        border: "oklch(0.9 0.015 60)",
        borderStrong: "oklch(0.75 0.02 60)",
        brand: "oklch(0.62 0.18 45)",
        brandFg: "oklch(0.99 0.005 60)",
        accent: "oklch(0.45 0.22 25)",
        accentFg: "oklch(0.99 0.005 60)",
        ring: "oklch(0.62 0.18 45 / 0.5)",
        surface: "oklch(0.97 0.013 70)",
        surfaceFg: "oklch(0.18 0.02 50)",
      },
      dark: {
        bg: "oklch(0.14 0.02 30)",
        bgMuted: "oklch(0.18 0.025 30)",
        bgElevated: "oklch(0.21 0.03 30)",
        fg: "oklch(0.96 0.012 60)",
        fgMuted: "oklch(0.78 0.02 60)",
        fgSubtle: "oklch(0.6 0.02 60)",
        border: "oklch(0.27 0.03 30)",
        borderStrong: "oklch(0.4 0.04 30)",
        brand: "oklch(0.78 0.16 45)",
        brandFg: "oklch(0.14 0.02 30)",
        accent: "oklch(0.72 0.2 25)",
        accentFg: "oklch(0.14 0.02 30)",
        ring: "oklch(0.78 0.16 45 / 0.5)",
        surface: "oklch(0.18 0.025 30)",
        surfaceFg: "oklch(0.96 0.012 60)",
      },
    },
    radius: { sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", pill: "9999px" },
    shadow: {
      sm: "0 1px 3px 0 oklch(0 0 0 / 0.06)",
      md: "0 6px 18px -4px oklch(0 0 0 / 0.08)",
      lg: "0 18px 40px -12px oklch(0 0 0 / 0.14)",
      glow: "0 0 50px -10px oklch(0.62 0.18 45 / 0.35)",
    },
    fonts: {
      sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
      serif: '"Source Serif Pro", "Lora", "Georgia", serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
      display: '"Source Serif Pro", "Lora", serif',
      weights: { display: [600, 700], body: [400] },
    },
    motion: baseMotion,
    containerMax: "44rem",
    prosePadding: "1.5rem",
  },
  layouts: {
    post: "narrow",
    list: "feed-chrono",
    hero: "centered",
    showToc: false,
    showAuthor: true,
    showReadingTime: true,
    showRelated: false,
    showShareBar: true,
    showSubscribeCta: true,
  },
  blockStyles: {
    heading: { wrapper: "font-serif tracking-tight" },
    text: { wrapper: "font-serif text-[1.125rem] leading-[1.75]" },
  },
  ogTemplate: {
    background: { kind: "gradient", from: "oklch(0.96 0.012 70)", to: "oklch(0.85 0.1 60)" },
    accent: "oklch(0.45 0.22 25)",
    font: { display: '"Source Serif Pro", serif', body: '"Inter", sans-serif' },
    showLogo: true,
    showAuthor: true,
    showDate: true,
    layout: "left",
  },
  isBuiltin: true,
};

export const BUILTIN_THEMES: readonly ThemeSpec[] = [
  magazine,
  portfolio,
  docs,
  storefront,
  newsletter,
] as const;

export const BUILTIN_THEMES_BY_SLUG: Readonly<Record<string, ThemeSpec>> = Object.freeze(
  Object.fromEntries(BUILTIN_THEMES.map((t) => [t.slug, t])),
);

export const DEFAULT_THEME_SLUG = "magazine";

export function getBuiltinTheme(slug: string | null | undefined): ThemeSpec {
  if (slug && BUILTIN_THEMES_BY_SLUG[slug]) return BUILTIN_THEMES_BY_SLUG[slug];
  const fallback = BUILTIN_THEMES_BY_SLUG[DEFAULT_THEME_SLUG];
  if (!fallback) throw new Error("Default theme missing");
  return fallback;
}
