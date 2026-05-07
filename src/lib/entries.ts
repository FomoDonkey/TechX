import { db } from "@/db/client";
import { countInt, insertReturning, upsertNothing } from "@/db/dialect";
import { type Entry, collections, entries, revisions, workspaces } from "@/db/schema";
import { resolvePublicWorkspaceFromRequest } from "@/domain/resolver";
import { logActivity } from "@/lib/activity";
import { slugify, withSuffix } from "@/lib/slug";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export const POSTS_SLUG = "posts";
export const PAGES_SLUG = "pages";

export type EntryListItem = Pick<
  Entry,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "status"
  | "publishedAt"
  | "scheduledAt"
  | "updatedAt"
  | "createdAt"
  | "locale"
  | "authorId"
>;

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

/**
 * Devuelve la colección builtin (posts/pages) del workspace, creándola si no existe.
 * Útil porque algunos workspaces (creados por seed antiguo) podrían no tenerla.
 */
export async function getOrCreateBuiltinCollection(workspaceId: string, slug: string) {
  if (!db) throw new Error("DB not configured");
  const existing = await db
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.slug, slug)))
    .limit(1);
  if (existing[0]) return existing[0];

  const name = slug === POSTS_SLUG ? "Posts" : slug === PAGES_SLUG ? "Páginas" : slug;
  const icon = slug === POSTS_SLUG ? "newspaper" : "file-text";
  // upsertNothing + re-select para resolver carrera entre dos requests simultáneos
  // que detecten "no existe" antes de que ninguno haya insertado.
  await upsertNothing(collections, {
    values: {
      workspaceId,
      name,
      slug,
      icon,
      isBuiltin: true,
      description: slug === POSTS_SLUG ? "Entradas del blog" : "Páginas estáticas",
    },
    target: [collections.workspaceId, collections.slug],
  });

  const [final] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.slug, slug)))
    .limit(1);
  if (!final) throw new Error("No se pudo crear la colección builtin");
  return final;
}

/**
 * Asegura un slug único dentro de (workspace, collection, locale). Reintenta con sufijo
 * incremental hasta 8 veces si choca.
 */
export async function ensureUniqueEntrySlug(
  workspaceId: string,
  collectionId: string,
  locale: string,
  base: string,
  ignoreEntryId?: string,
): Promise<string> {
  if (!db) return base;
  const candidate = base || "sin-titulo";
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const tryWith = n === 0 ? candidate : withSuffix(candidate, n);
    const existing = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.workspaceId, workspaceId),
          eq(entries.collectionId, collectionId),
          eq(entries.locale, locale),
          eq(entries.slug, tryWith),
        ),
      )
      .limit(1);
    const collision = existing[0];
    if (!collision || collision.id === ignoreEntryId) return tryWith;
    n += 1;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

export type CreateEntryInput = {
  workspaceId: string;
  collectionId: string;
  authorId: string;
  title?: string;
  locale?: string;
};

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  if (!db) throw new Error("DB not configured");
  const title = input.title?.trim() || "Sin título";
  const locale = input.locale ?? "es";
  const baseSlug = slugify(title) || "sin-titulo";

  // Reintenta con sufijo si dos requests simultáneos pillan el mismo slug entre
  // ensureUniqueEntrySlug (read) e insert. Hasta 8 reintentos.
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 8) {
    const slug =
      attempt === 0
        ? await ensureUniqueEntrySlug(input.workspaceId, input.collectionId, locale, baseSlug)
        : `${baseSlug}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      // ID generado app-side para compatibilidad MySQL (no soporta RETURNING).
      const id = crypto.randomUUID();
      const created = (await insertReturning(entries, {
        id,
        workspaceId: input.workspaceId,
        collectionId: input.collectionId,
        title,
        slug,
        locale,
        status: "draft",
        body: EMPTY_DOC as unknown as Record<string, unknown>,
        bodyText: "",
        authorId: input.authorId,
        updatedById: input.authorId,
      })) as Entry;
      if (!created) throw new Error("No se pudo crear la entrada");

      await logActivity({
        workspaceId: input.workspaceId,
        actorId: input.authorId,
        action: "entry.created",
        targetType: "entry",
        targetId: created.id,
        meta: { title, slug },
      });

      return created;
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
      attempt += 1;
    }
  }
  throw lastErr ?? new Error("No se pudo asignar un slug único");
}

export type EntryListFilter = {
  workspaceId: string;
  collectionSlug?: string;
  status?: Entry["status"] | "all";
  q?: string;
  limit?: number;
  offset?: number;
};

export async function listEntries(filter: EntryListFilter): Promise<{
  rows: EntryListItem[];
  total: number;
  counts: Record<Entry["status"] | "all", number>;
}> {
  if (!db) {
    return {
      rows: [],
      total: 0,
      counts: {
        all: 0,
        draft: 0,
        review: 0,
        approved: 0,
        scheduled: 0,
        published: 0,
        archived: 0,
      },
    };
  }
  const slug = filter.collectionSlug ?? POSTS_SLUG;
  const coll = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.workspaceId, filter.workspaceId), eq(collections.slug, slug)))
    .limit(1);
  const collectionId = coll[0]?.id;
  if (!collectionId) {
    return {
      rows: [],
      total: 0,
      counts: {
        all: 0,
        draft: 0,
        review: 0,
        approved: 0,
        scheduled: 0,
        published: 0,
        archived: 0,
      },
    };
  }

  // F9b: el listing admin sólo muestra entries de main por defecto. Las entries
  // forkeadas en branches se ven desde /admin/branches/[id]. Esto evita que
  // bulk actions (publish/delete/etc) operen accidentalmente sobre forks.
  const baseWhere = [
    eq(entries.workspaceId, filter.workspaceId),
    eq(entries.collectionId, collectionId),
    isNull(entries.branchId),
  ];
  const where =
    filter.status && filter.status !== "all"
      ? and(...baseWhere, eq(entries.status, filter.status))
      : and(...baseWhere);
  const search = filter.q?.trim();
  const finalWhere = search
    ? and(
        where,
        sql`(${entries.title} ILIKE ${`%${search}%`} OR ${entries.bodyText} ILIKE ${`%${search}%`})`,
      )
    : where;

  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const [rows, totalRow, statusCounts] = await Promise.all([
    db
      .select({
        id: entries.id,
        title: entries.title,
        slug: entries.slug,
        excerpt: entries.excerpt,
        status: entries.status,
        publishedAt: entries.publishedAt,
        scheduledAt: entries.scheduledAt,
        updatedAt: entries.updatedAt,
        createdAt: entries.createdAt,
        locale: entries.locale,
        authorId: entries.authorId,
      })
      .from(entries)
      .where(finalWhere)
      .orderBy(desc(entries.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: countInt() }).from(entries).where(finalWhere),
    db
      .select({
        status: entries.status,
        n: countInt(),
      })
      .from(entries)
      .where(and(...baseWhere))
      .groupBy(entries.status),
  ]);

  const counts: Record<Entry["status"] | "all", number> = {
    all: 0,
    draft: 0,
    review: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  };
  for (const c of statusCounts) {
    counts[c.status] = c.n;
    counts.all += c.n;
  }

  return {
    rows,
    total: totalRow[0]?.n ?? 0,
    counts,
  };
}

export async function getEntryById(workspaceId: string, id: string): Promise<Entry | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), eq(entries.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getPublishedPostBySlug(
  workspaceSlug: string,
  postSlug: string,
): Promise<{ entry: Entry; workspaceName: string } | null> {
  if (!db) return null;
  const [row] = await db
    .select({ entry: entries, workspaceName: workspaces.name })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .innerJoin(workspaces, eq(workspaces.id, entries.workspaceId))
    .where(
      and(
        eq(workspaces.slug, workspaceSlug),
        eq(collections.slug, POSTS_SLUG),
        eq(entries.slug, postSlug),
        eq(entries.status, "published"),
        // F9b: nunca servir un fork de branch en el sitio público.
        isNull(entries.branchId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { entry: row.entry, workspaceName: row.workspaceName };
}

export async function listPublishedPostsForWorkspace(
  workspaceSlug: string,
  limit = 24,
): Promise<EntryListItem[]> {
  if (!db) return [];
  return db
    .select({
      id: entries.id,
      title: entries.title,
      slug: entries.slug,
      excerpt: entries.excerpt,
      status: entries.status,
      publishedAt: entries.publishedAt,
      scheduledAt: entries.scheduledAt,
      updatedAt: entries.updatedAt,
      createdAt: entries.createdAt,
      locale: entries.locale,
      authorId: entries.authorId,
    })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .innerJoin(workspaces, eq(workspaces.id, entries.workspaceId))
    .where(
      and(
        eq(workspaces.slug, workspaceSlug),
        eq(collections.slug, POSTS_SLUG),
        eq(entries.status, "published"),
        // F9b: el listado público nunca incluye forks de branches.
        isNull(entries.branchId),
      ),
    )
    .orderBy(desc(entries.publishedAt))
    .limit(limit);
}

/**
 * Workspace público para la petición actual.
 *
 * F11a — multi-tenant. Resuelve por (en orden):
 *   1. custom domain verificado (`Host` header)
 *   2. subdomain del `ROOT_DOMAIN`
 *   3. path-based `/s/<slug>/...` (cabecera `x-csm-path-slug` la inyecta el
 *      middleware)
 *   4. single-tenant fallback (1 solo workspace en la instancia)
 *
 * Si el slug usado pertenece al historial de slugs (rename < 30d), la
 * función devuelve el workspace actual; las páginas públicas que quieran
 * 301 al canónico deben usar `resolvePublicWorkspaceFromRequest()`
 * directamente y leer `redirectCanonical`.
 *
 * Devuelve `null` si no hay match → la página debe `notFound()`.
 *
 * Nota: el viejo comportamiento "más antiguo del sistema" sigue como
 * fallback de single-tenant.
 */
export async function getDefaultPublicWorkspace(): Promise<typeof workspaces.$inferSelect | null> {
  const resolved = await resolvePublicWorkspaceFromRequest();
  return resolved?.workspace ?? null;
}

export async function listLatestRevisions(entryId: string, limit = 20) {
  if (!db) return [];
  return db
    .select({
      id: revisions.id,
      summary: revisions.summary,
      authorId: revisions.authorId,
      createdAt: revisions.createdAt,
    })
    .from(revisions)
    .where(eq(revisions.entryId, entryId))
    .orderBy(desc(revisions.createdAt))
    .limit(limit);
}

/**
 * Lee una revisión validando que pertenece a una entry del workspace dado.
 * Defense-in-depth: aunque el caller principal (`restoreRevisionAction`) ya
 * compara `rev.entryId` contra una entry del workspace activo, este helper
 * está exportado para futuros consumidores (CLI, GraphQL, REST). Sin el JOIN
 * por workspace, un caller que confíe ciegamente en este resultado podría
 * leakear contenido entre tenants.
 */
export async function getRevision(id: string, workspaceId: string) {
  if (!db) return null;
  const [row] = await db
    .select({
      id: revisions.id,
      entryId: revisions.entryId,
      body: revisions.body,
      summary: revisions.summary,
      authorId: revisions.authorId,
      createdAt: revisions.createdAt,
    })
    .from(revisions)
    .innerJoin(entries, eq(entries.id, revisions.entryId))
    .where(and(eq(revisions.id, id), eq(entries.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}
