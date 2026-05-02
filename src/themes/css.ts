import type { ThemeColorTokens, ThemeSpec } from "./types";

function colorVars(prefix: string, c: ThemeColorTokens): string[] {
  return [
    `--${prefix}-bg:${c.bg}`,
    `--${prefix}-bg-muted:${c.bgMuted}`,
    `--${prefix}-bg-elevated:${c.bgElevated}`,
    `--${prefix}-fg:${c.fg}`,
    `--${prefix}-fg-muted:${c.fgMuted}`,
    `--${prefix}-fg-subtle:${c.fgSubtle}`,
    `--${prefix}-border:${c.border}`,
    `--${prefix}-border-strong:${c.borderStrong}`,
    `--${prefix}-brand:${c.brand}`,
    `--${prefix}-brand-fg:${c.brandFg}`,
    `--${prefix}-accent:${c.accent}`,
    `--${prefix}-accent-fg:${c.accentFg}`,
    `--${prefix}-ring:${c.ring}`,
    `--${prefix}-surface:${c.surface}`,
    `--${prefix}-surface-fg:${c.surfaceFg}`,
  ];
}

/**
 * Alias the global Tailwind tokens (--background, --primary, etc.) to the theme's
 * tokens within the theme scope. This way every block render that uses
 * `bg-background` / `text-primary` automatically picks up the theme — no per-block changes.
 */
function aliasGlobalTokens(c: ThemeColorTokens): string[] {
  return [
    `--background:${c.bg}`,
    `--foreground:${c.fg}`,
    `--card:${c.bgElevated}`,
    `--card-foreground:${c.fg}`,
    `--popover:${c.bgElevated}`,
    `--popover-foreground:${c.fg}`,
    `--primary:${c.brand}`,
    `--primary-foreground:${c.brandFg}`,
    `--secondary:${c.surface}`,
    `--secondary-foreground:${c.surfaceFg}`,
    `--muted:${c.bgMuted}`,
    `--muted-foreground:${c.fgMuted}`,
    `--accent:${c.accent}`,
    `--accent-foreground:${c.accentFg}`,
    `--border:${c.border}`,
    `--input:${c.border}`,
    `--ring:${c.ring}`,
    `--brand-1:${c.brand}`,
    `--brand-2:${c.accent}`,
    `--brand-3:${c.brand}`,
  ];
}

/**
 * Generate <style> content for a theme — to be inlined in <head>
 * of the public site so the workspace's chosen theme paints
 * tokens at zero runtime cost.
 *
 * Strategy: define theme tokens scoped to `[data-csm-theme]`. The
 * public layout wraps the site with this attribute. Light/dark map
 * is provided via :root and .dark variants on the same scope.
 */
export function themeCss(spec: ThemeSpec): string {
  const { tokens } = spec;
  const lightVars = [
    ...colorVars("th", tokens.colors.light),
    ...aliasGlobalTokens(tokens.colors.light),
  ];
  const darkVars = [
    ...colorVars("th", tokens.colors.dark),
    ...aliasGlobalTokens(tokens.colors.dark),
  ];

  const radiusVars = [
    `--th-radius-sm:${tokens.radius.sm}`,
    `--th-radius-md:${tokens.radius.md}`,
    `--th-radius-lg:${tokens.radius.lg}`,
    `--th-radius-xl:${tokens.radius.xl}`,
    `--th-radius-pill:${tokens.radius.pill}`,
    `--radius:${tokens.radius.lg}`,
  ];
  const shadowVars = [
    `--th-shadow-sm:${tokens.shadow.sm}`,
    `--th-shadow-md:${tokens.shadow.md}`,
    `--th-shadow-lg:${tokens.shadow.lg}`,
    `--th-shadow-glow:${tokens.shadow.glow}`,
  ];
  const fontVars = [
    `--th-font-sans:${tokens.fonts.sans}`,
    `--th-font-serif:${tokens.fonts.serif}`,
    `--th-font-mono:${tokens.fonts.mono}`,
    `--th-font-display:${tokens.fonts.display}`,
    `--font-sans:${tokens.fonts.sans}`,
    `--font-serif:${tokens.fonts.serif}`,
    `--font-mono:${tokens.fonts.mono}`,
    `--font-display:${tokens.fonts.display}`,
  ];
  const motionVars = [
    `--th-motion-duration:${tokens.motion.duration}`,
    `--th-motion-ease:${tokens.motion.ease}`,
  ];
  const containerVars = [
    `--th-container-max:${tokens.containerMax}`,
    `--th-prose-padding:${tokens.prosePadding}`,
  ];

  const staticVars = [...radiusVars, ...shadowVars, ...fontVars, ...motionVars, ...containerVars];

  return [
    `[data-csm-theme="${spec.slug}"]{${[...lightVars, ...staticVars].join(";")}}`,
    `[data-csm-theme="${spec.slug}"].dark,.dark [data-csm-theme="${spec.slug}"]{${darkVars.join(";")}}`,
  ].join("");
}

/**
 * Build a Google Fonts <link> URL (via fonts.bunny.net for privacy)
 * for theme display + serif fonts. Returns null if all fonts are local.
 */
export function themeFontsLink(spec: ThemeSpec): string | null {
  const want: string[] = [];
  const display = primaryFont(spec.tokens.fonts.display);
  const serif = primaryFont(spec.tokens.fonts.serif);
  const sans = primaryFont(spec.tokens.fonts.sans);
  for (const f of [display, serif, sans]) {
    if (!f) continue;
    if (LOCAL_FONTS.has(f)) continue;
    if (!want.includes(f)) want.push(f);
  }
  if (want.length === 0) return null;
  const families = want
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`)
    .join("&");
  return `https://fonts.bunny.net/css?${families}&display=swap`;
}

const LOCAL_FONTS = new Set(["Geist Sans", "Geist Mono", "JetBrains Mono"]);

function primaryFont(stack: string): string | null {
  const match = stack.match(/^"([^"]+)"/);
  return match?.[1] ?? null;
}
