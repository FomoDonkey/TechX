import { db } from "@/db/client";
import { type Collection, collections, entries } from "@/db/schema";
import { type CollectionSchema, readCollectionSchema } from "@/lib/fields";
import { isReservedSlug, slugify, withSuffix } from "@/lib/slug";
import { and, asc, eq, sql } from "drizzle-orm";

const RESERVED_COLLECTION_SLUGS = new Set([
  "posts",
  "pages",
  "media",
  "users",
  "settings",
  "api",
  "admin",
]);

export type CollectionListItem = Pick<
  Collection,
  "id" | "name" | "slug" | "icon" | "description" | "isSingleton" | "isBuiltin" | "createdAt"
> & {
  entryCount: number;
};

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export async function listCollections(workspaceId: string): Promise<CollectionListItem[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      icon: collections.icon,
      description: collections.description,
      isSingleton: collections.isSingleton,
      isBuiltin: collections.isBuiltin,
      createdAt: collections.createdAt,
      entryCount: sql<number>`(
        SELECT count(*)::int FROM ${entries}
        WHERE ${entries.collectionId} = ${collections.id}
      )`,
    })
    .from(collections)
    .where(eq(collections.workspaceId, workspaceId))
    .orderBy(asc(collections.isBuiltin), asc(collections.name));
  return rows;
}

export async function getCollectionById(
  workspaceId: string,
  id: string,
): Promise<Collection | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getCollectionBySlug(
  workspaceId: string,
  slug: string,
): Promise<Collection | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.slug, slug)))
    .limit(1);
  return row ?? null;
}

export type CreateCollectionInput = {
  workspaceId: string;
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  isSingleton?: boolean;
  schema?: CollectionSchema;
};

export async function ensureUniqueCollectionSlug(
  workspaceId: string,
  base: string,
): Promise<string> {
  if (!db) return base;
  const candidate = base || "coleccion";
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const tryWith = n === 0 ? candidate : withSuffix(candidate, n);
    const existing = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.workspaceId, workspaceId), eq(collections.slug, tryWith)))
      .limit(1);
    if (!existing[0]) return tryWith;
    n += 1;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

export function isReservedCollectionSlug(slug: string): boolean {
  return RESERVED_COLLECTION_SLUGS.has(slug) || isReservedSlug(slug);
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  if (!db) throw new Error("DB not configured");
  const name = input.name.trim();
  if (!name) throw new Error("Nombre requerido");
  const baseSlug = slugify(input.slug ?? input.name) || "coleccion";
  if (isReservedCollectionSlug(baseSlug)) throw new Error(`Slug "${baseSlug}" reservado`);

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 8) {
    const slug =
      attempt === 0
        ? await ensureUniqueCollectionSlug(input.workspaceId, baseSlug)
        : `${baseSlug}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const [created] = await db
        .insert(collections)
        .values({
          workspaceId: input.workspaceId,
          name,
          slug,
          icon: input.icon ?? "layers",
          description: input.description ?? null,
          isSingleton: input.isSingleton ?? false,
          isBuiltin: false,
          schema: input.schema ?? { fields: [] },
        })
        .returning();
      if (!created) throw new Error("No se pudo crear la colección");
      return created;
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
      attempt += 1;
    }
  }
  throw lastErr ?? new Error("No se pudo asignar un slug único");
}

export type UpdateCollectionInput = {
  workspaceId: string;
  id: string;
  name?: string;
  icon?: string | null;
  description?: string | null;
  isSingleton?: boolean;
  schema?: CollectionSchema;
};

export async function updateCollection(input: UpdateCollectionInput): Promise<Collection> {
  if (!db) throw new Error("DB not configured");
  const patch: Partial<Collection> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.description !== undefined) patch.description = input.description;
  if (input.isSingleton !== undefined) patch.isSingleton = input.isSingleton;
  if (input.schema !== undefined) patch.schema = input.schema;

  const [updated] = await db
    .update(collections)
    .set(patch)
    .where(and(eq(collections.workspaceId, input.workspaceId), eq(collections.id, input.id)))
    .returning();
  if (!updated) throw new Error("Colección no encontrada");
  return updated;
}

export async function deleteCollection(workspaceId: string, id: string): Promise<void> {
  if (!db) throw new Error("DB not configured");
  // Guard: no permitir borrar builtin
  const [coll] = await db
    .select({ isBuiltin: collections.isBuiltin })
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.id, id)))
    .limit(1);
  if (!coll) throw new Error("Colección no encontrada");
  if (coll.isBuiltin) throw new Error("No se puede eliminar una colección builtin");
  await db
    .delete(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.id, id)));
}

export function getCollectionSchemaSafe(coll: Collection | null | undefined): CollectionSchema {
  return readCollectionSchema(coll?.schema);
}
