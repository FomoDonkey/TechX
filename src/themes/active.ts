import "server-only";
import { db } from "@/db/client";
import { themes, workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { BUILTIN_THEMES, DEFAULT_THEME_SLUG, getBuiltinTheme } from "./builtins";
import type { ResolvedTheme, ThemeSpec } from "./types";

/**
 * Resolve a theme spec by slug for a given workspace.
 * Custom themes (in DB) take precedence over builtins with the same slug.
 */
export async function resolveTheme(
  workspaceId: string,
  slug: string | null | undefined,
): Promise<ResolvedTheme> {
  const target = slug ?? DEFAULT_THEME_SLUG;
  if (db) {
    try {
      const rows = await db
        .select()
        .from(themes)
        .where(and(eq(themes.workspaceId, workspaceId), eq(themes.slug, target)))
        .limit(1);
      const row = rows[0];
      // Solo tratamos como custom si la fila tiene una shape mínima válida
      // (`tokens.colors.light/dark`). Una fila vacía no debe disfrazarse de custom
      // y mostrarse en la galería como "Custom" cuando hereda todo del builtin.
      if (row && hasValidTokens(row.tokens)) {
        const spec = themeRowToSpec(row);
        if (spec) return { spec, source: "custom", id: row.id };
      }
    } catch {
      // fall through to builtin
    }
  }
  return { spec: getBuiltinTheme(target), source: "builtin" };
}

function hasValidTokens(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { colors?: { light?: unknown; dark?: unknown } };
  return Boolean(v.colors?.light && v.colors?.dark);
}

/**
 * Resolve the active theme for a workspace by reading workspaces.activeThemeSlug.
 */
export async function resolveActiveTheme(workspaceId: string): Promise<ResolvedTheme> {
  let activeSlug: string | null = DEFAULT_THEME_SLUG;
  if (db) {
    try {
      const rows = await db
        .select({ slug: workspaces.activeThemeSlug })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
      activeSlug = rows[0]?.slug ?? DEFAULT_THEME_SLUG;
    } catch {
      // keep default
    }
  }
  return resolveTheme(workspaceId, activeSlug);
}

/**
 * List all themes available to a workspace: builtins + custom (DB).
 */
export async function listAvailableThemes(workspaceId: string): Promise<{
  builtins: ThemeSpec[];
  customs: { id: string; spec: ThemeSpec; basedOn: string | null }[];
}> {
  const customs: { id: string; spec: ThemeSpec; basedOn: string | null }[] = [];
  if (db) {
    try {
      const rows = await db.select().from(themes).where(eq(themes.workspaceId, workspaceId));
      for (const row of rows) {
        const spec = themeRowToSpec(row);
        if (spec) customs.push({ id: row.id, spec, basedOn: row.basedOn ?? null });
      }
    } catch {
      // ignore
    }
  }
  return { builtins: [...BUILTIN_THEMES], customs };
}

function themeRowToSpec(row: typeof themes.$inferSelect): ThemeSpec | null {
  const base = row.basedOn ? getBuiltinTheme(row.basedOn) : getBuiltinTheme(DEFAULT_THEME_SLUG);
  const tokens = (row.tokens as ThemeSpec["tokens"] | null) ?? base.tokens;
  const layouts = (row.layouts as ThemeSpec["layouts"] | null) ?? base.layouts;
  const blockStyles =
    (row.blockOverrides as ThemeSpec["blockStyles"] | null) ?? base.blockStyles ?? {};
  const ogTemplate = (row.ogTemplate as ThemeSpec["ogTemplate"] | null) ?? base.ogTemplate;
  return {
    slug: row.slug,
    name: row.name ?? base.name,
    tagline: base.tagline,
    description: row.description ?? base.description,
    preview: base.preview,
    tokens,
    layouts,
    blockStyles,
    ogTemplate,
    isBuiltin: false,
    basedOn: row.basedOn ?? base.slug,
  };
}
