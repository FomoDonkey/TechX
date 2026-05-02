import { type BlockNode, EMPTY_LAYOUT, normalizeLayout } from "@/blocks/types";
import { db } from "@/db/client";
import { type Page, pages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { isReservedSlug, slugify } from "@/lib/slug";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

export type PageListItem = Pick<
  Page,
  | "id"
  | "path"
  | "title"
  | "locale"
  | "status"
  | "isHome"
  | "publishedAt"
  | "updatedAt"
  | "createdAt"
>;

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

/** Normaliza un path: empieza por "/", sin trailing slash (excepto root "/"), sin // */
export function normalizePath(input: string): string {
  let p = input.trim().toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  // restringir caracteres permitidos (segmentos slug-style)
  p = p
    .split("/")
    .map((seg, i) => {
      if (i === 0) return ""; // primer split antes del / inicial
      return slugify(seg) || seg.replace(/[^a-z0-9-]/g, "-");
    })
    .join("/");
  if (!p || p === "/") return "/";
  return p;
}

const RESERVED_PATHS = new Set([
  "/admin",
  "/api",
  "/login",
  "/registro",
  "/onboarding",
  "/olvide",
  "/invitacion",
  "/preview",
]);

export function isReservedPath(path: string): boolean {
  if (RESERVED_PATHS.has(path)) return true;
  for (const r of RESERVED_PATHS) if (path.startsWith(`${r}/`)) return true;
  // El primer segmento como reserva-de-slug también queda fuera (login, admin…)
  const first = path.split("/").filter(Boolean)[0];
  if (first && isReservedSlug(first)) return true;
  return false;
}

export async function listPages(
  workspaceId: string,
  opts: { status?: Page["status"] | "all"; q?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: PageListItem[]; total: number; counts: Record<string, number> }> {
  if (!db) {
    return { rows: [], total: 0, counts: { all: 0, draft: 0, published: 0, archived: 0 } };
  }
  const baseWhere = eq(pages.workspaceId, workspaceId);
  const where =
    opts.status && opts.status !== "all"
      ? and(baseWhere, eq(pages.status, opts.status))
      : baseWhere;
  const search = opts.q?.trim();
  const finalWhere = search
    ? and(
        where,
        sql`(${pages.title} ILIKE ${`%${search}%`} OR ${pages.path} ILIKE ${`%${search}%`})`,
      )
    : where;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [rows, totalRow, statusCountsRows] = await Promise.all([
    db
      .select({
        id: pages.id,
        path: pages.path,
        title: pages.title,
        locale: pages.locale,
        status: pages.status,
        isHome: pages.isHome,
        publishedAt: pages.publishedAt,
        updatedAt: pages.updatedAt,
        createdAt: pages.createdAt,
      })
      .from(pages)
      .where(finalWhere)
      .orderBy(desc(pages.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(pages).where(finalWhere),
    db
      .select({ status: pages.status, n: sql<number>`count(*)::int` })
      .from(pages)
      .where(baseWhere)
      .groupBy(pages.status),
  ]);

  const counts: Record<string, number> = { all: 0, draft: 0, published: 0, archived: 0 };
  let total = 0;
  for (const c of statusCountsRows) {
    counts[c.status] = c.n;
    total += c.n;
  }
  counts.all = total;
  return { rows, total: totalRow[0]?.n ?? 0, counts };
}

export async function getPageById(workspaceId: string, id: string): Promise<Page | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getPublishedPageByPath(
  workspaceId: string,
  path: string,
  locale = "es",
): Promise<Page | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.path, path),
        eq(pages.locale, locale),
        eq(pages.status, "published"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getPublishedHome(workspaceId: string, locale = "es"): Promise<Page | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.locale, locale),
        eq(pages.status, "published"),
        eq(pages.isHome, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CreatePageInput = {
  workspaceId: string;
  authorId: string;
  title: string;
  path?: string;
  locale?: string;
};

export async function createPage(input: CreatePageInput): Promise<Page> {
  if (!db) throw new Error("DB not configured");
  const title = input.title.trim() || "Nueva página";
  const locale = input.locale ?? "es";
  const basePath = normalizePath(input.path ?? `/${slugify(title) || "pagina"}`);
  if (isReservedPath(basePath)) throw new Error(`Ruta "${basePath}" reservada`);

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 8) {
    const path =
      attempt === 0
        ? await ensureUniquePagePath(input.workspaceId, basePath, locale)
        : `${basePath}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const [created] = await db
        .insert(pages)
        .values({
          workspaceId: input.workspaceId,
          path,
          title,
          locale,
          status: "draft",
          layout: EMPTY_LAYOUT,
          authorId: input.authorId,
          updatedById: input.authorId,
        })
        .returning();
      if (!created) throw new Error("No se pudo crear la página");
      await logActivity({
        workspaceId: input.workspaceId,
        actorId: input.authorId,
        action: "page.created",
        targetType: "page",
        targetId: created.id,
        meta: { path, title },
      });
      return created;
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
      attempt += 1;
    }
  }
  throw lastErr ?? new Error("No se pudo asignar una ruta única");
}

export async function ensureUniquePagePath(
  workspaceId: string,
  base: string,
  locale: string,
  ignoreId?: string,
): Promise<string> {
  if (!db) return base;
  const candidate = base || "/";
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const tryWith = n === 0 ? candidate : normalizePath(`${candidate}-${n}`);
    const existing = await db
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(eq(pages.workspaceId, workspaceId), eq(pages.path, tryWith), eq(pages.locale, locale)),
      )
      .limit(1);
    const collision = existing[0];
    if (!collision || collision.id === ignoreId) return tryWith;
    n += 1;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

export type UpdatePageInput = {
  workspaceId: string;
  id: string;
  userId: string;
  title?: string;
  path?: string;
  locale?: string;
  status?: Page["status"];
  layout?: BlockNode[];
  seo?: Page["seo"];
  isHome?: boolean;
};

export async function updatePage(input: UpdatePageInput): Promise<Page> {
  if (!db) throw new Error("DB not configured");
  const existing = await getPageById(input.workspaceId, input.id);
  if (!existing) throw new Error("Página no encontrada");

  const patch: Partial<Page> = { updatedAt: new Date(), updatedById: input.userId };
  if (input.title !== undefined) patch.title = input.title.trim() || existing.title;
  if (input.locale !== undefined) patch.locale = input.locale;
  if (input.layout !== undefined) patch.layout = normalizeLayout(input.layout);
  if (input.seo !== undefined) patch.seo = input.seo;
  if (input.path !== undefined) {
    const newPath = normalizePath(input.path);
    if (isReservedPath(newPath)) throw new Error(`Ruta "${newPath}" reservada`);
    if (newPath !== existing.path) {
      patch.path = await ensureUniquePagePath(
        input.workspaceId,
        newPath,
        input.locale ?? existing.locale,
        input.id,
      );
    }
  }
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "published" && !existing.publishedAt) {
      patch.publishedAt = new Date();
    }
  }
  if (input.isHome === true) patch.isHome = true;
  else if (input.isHome === false) patch.isHome = false;

  // Si la página se marca como home, desetear OTRAS pages home del mismo locale
  // dentro de la misma transacción para garantizar consistencia (evita estado
  // donde no hay home si el segundo UPDATE falla, o donde hay 2 homes si race).
  // ne() excluye explícitamente al row actual del unset.
  const [updated] = await db.transaction(async (tx) => {
    if (input.isHome === true) {
      await tx
        .update(pages)
        .set({ isHome: false })
        .where(
          and(
            eq(pages.workspaceId, input.workspaceId),
            eq(pages.locale, input.locale ?? existing.locale),
            eq(pages.isHome, true),
            ne(pages.id, input.id),
          ),
        );
    }
    return tx
      .update(pages)
      .set(patch)
      .where(and(eq(pages.workspaceId, input.workspaceId), eq(pages.id, input.id)))
      .returning();
  });
  if (!updated) throw new Error("No se pudo actualizar la página");
  return updated;
}

export async function deletePage(workspaceId: string, id: string): Promise<void> {
  if (!db) throw new Error("DB not configured");
  await db.delete(pages).where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, id)));
}

export async function listPublishedPaths(workspaceId: string, locale = "es"): Promise<string[]> {
  if (!db) return [];
  const rows = await db
    .select({ path: pages.path })
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.locale, locale),
        eq(pages.status, "published"),
      ),
    )
    .orderBy(asc(pages.path));
  return rows.map((r) => r.path);
}
