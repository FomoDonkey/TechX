/**
 * Theme system types — pure data, zero runtime deps.
 * Safe to import from client and server.
 */

export type ThemeSlug = string;

export interface ThemeColorTokens {
  bg: string;
  bgMuted: string;
  bgElevated: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  border: string;
  borderStrong: string;
  brand: string;
  brandFg: string;
  accent: string;
  accentFg: string;
  ring: string;
  surface: string;
  surfaceFg: string;
}

export interface ThemeRadiusTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: string;
}

export interface ThemeShadowTokens {
  sm: string;
  md: string;
  lg: string;
  glow: string;
}

export interface ThemeFontTokens {
  sans: string;
  serif: string;
  mono: string;
  display: string;
  link?: string;
  weights?: { display?: number[]; body?: number[]; mono?: number[] };
}

export interface ThemeMotionTokens {
  duration: string;
  ease: string;
}

export interface ThemeTokens {
  colors: { light: ThemeColorTokens; dark: ThemeColorTokens };
  radius: ThemeRadiusTokens;
  shadow: ThemeShadowTokens;
  fonts: ThemeFontTokens;
  motion: ThemeMotionTokens;
  containerMax: string;
  prosePadding: string;
}

export type PostLayoutKind = "magazine" | "narrow" | "wide" | "docs" | "minimal";
export type ListLayoutKind = "grid-2" | "grid-3" | "list-rich" | "feed-chrono" | "tree-sections";
export type HeroLayoutKind = "centered" | "split" | "magazine" | "minimal" | "bold";

export interface ThemeLayouts {
  post: PostLayoutKind;
  list: ListLayoutKind;
  hero: HeroLayoutKind;
  showToc: boolean;
  showAuthor: boolean;
  showReadingTime: boolean;
  showRelated: boolean;
  showShareBar: boolean;
  showSubscribeCta: boolean;
}

export type BlockStyleClass = string;

export interface BlockStyleOverride {
  wrapper?: BlockStyleClass;
  inner?: BlockStyleClass;
  heading?: BlockStyleClass;
  text?: BlockStyleClass;
  cta?: BlockStyleClass;
}

export interface ThemeOgTemplate {
  background: { kind: "gradient" | "solid"; from?: string; to?: string; angle?: number };
  accent: string;
  font: { display: string; body: string };
  showLogo: boolean;
  showAuthor: boolean;
  showDate: boolean;
  layout: "centered" | "left" | "split";
}

export interface ThemeSpec {
  slug: ThemeSlug;
  name: string;
  tagline: string;
  description: string;
  preview: { gradient: string; emoji: string };
  tokens: ThemeTokens;
  layouts: ThemeLayouts;
  blockStyles?: Record<string, BlockStyleOverride>;
  ogTemplate: ThemeOgTemplate;
  isBuiltin: boolean;
  basedOn?: ThemeSlug;
}

export interface ResolvedTheme {
  spec: ThemeSpec;
  source: "builtin" | "custom";
  id?: string;
}
