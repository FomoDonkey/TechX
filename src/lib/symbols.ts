import { type BlockNode, normalizeLayout } from "@/blocks/types";
import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import { type Symbol as SymbolRow, symbols } from "@/db/schema";
import { slugify, withSuffix } from "@/lib/slug";
import { and, asc, eq } from "drizzle-orm";

export type SymbolListItem = Pick<
  SymbolRow,
  "id" | "name" | "slug" | "description" | "createdAt" | "updatedAt"
>;

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export async function listSymbols(workspaceId: string): Promise<SymbolListItem[]> {
  if (!db) return [];
  return db
    .select({
      id: symbols.id,
      name: symbols.name,
      slug: symbols.slug,
      description: symbols.description,
      createdAt: symbols.createdAt,
      updatedAt: symbols.updatedAt,
    })
    .from(symbols)
    .where(eq(symbols.workspaceId, workspaceId))
    .orderBy(asc(symbols.name));
}

export async function getSymbolById(workspaceId: string, id: string): Promise<SymbolRow | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(symbols)
    .where(and(eq(symbols.workspaceId, workspaceId), eq(symbols.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getSymbolBySlug(
  workspaceId: string,
  slug: string,
): Promise<SymbolRow | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(symbols)
    .where(and(eq(symbols.workspaceId, workspaceId), eq(symbols.slug, slug)))
    .limit(1);
  return row ?? null;
}

async function ensureUniqueSymbolSlug(workspaceId: string, base: string): Promise<string> {
  if (!db) return base;
  const candidate = base || "simbolo";
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const tryWith = n === 0 ? candidate : withSuffix(candidate, n);
    const existing = await db
      .select({ id: symbols.id })
      .from(symbols)
      .where(and(eq(symbols.workspaceId, workspaceId), eq(symbols.slug, tryWith)))
      .limit(1);
    if (!existing[0]) return tryWith;
    n += 1;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

export type CreateSymbolInput = {
  workspaceId: string;
  name: string;
  slug?: string;
  description?: string;
  layout?: BlockNode[];
};

export async function createSymbol(input: CreateSymbolInput): Promise<SymbolRow> {
  if (!db) throw new Error("DB not configured");
  const name = input.name.trim();
  if (!name) throw new Error("Nombre requerido");
  const baseSlug = slugify(input.slug ?? input.name) || "simbolo";

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 8) {
    const slug =
      attempt === 0
        ? await ensureUniqueSymbolSlug(input.workspaceId, baseSlug)
        : `${baseSlug}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const id = crypto.randomUUID();
      const created = (await insertReturning(symbols, {
        id,
        workspaceId: input.workspaceId,
        name,
        slug,
        description: input.description ?? null,
        layout: normalizeLayout(input.layout ?? []),
      })) as SymbolRow;
      if (!created) throw new Error("No se pudo crear el símbolo");
      return created;
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
      attempt += 1;
    }
  }
  throw lastErr ?? new Error("No se pudo asignar un slug único");
}

export type UpdateSymbolInput = {
  workspaceId: string;
  id: string;
  name?: string;
  description?: string | null;
  layout?: BlockNode[];
};

export async function updateSymbol(input: UpdateSymbolInput): Promise<SymbolRow> {
  if (!db) throw new Error("DB not configured");
  const patch: Partial<SymbolRow> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.layout !== undefined) patch.layout = normalizeLayout(input.layout);

  // UPDATE + SELECT post-update (MySQL no soporta UPDATE...RETURNING).
  await db
    .update(symbols)
    .set(patch)
    .where(and(eq(symbols.workspaceId, input.workspaceId), eq(symbols.id, input.id)));
  const [updated] = await db
    .select()
    .from(symbols)
    .where(and(eq(symbols.workspaceId, input.workspaceId), eq(symbols.id, input.id)))
    .limit(1);
  if (!updated) throw new Error("Símbolo no encontrado");
  return updated;
}

export async function deleteSymbol(workspaceId: string, id: string): Promise<void> {
  if (!db) throw new Error("DB not configured");
  await db.delete(symbols).where(and(eq(symbols.workspaceId, workspaceId), eq(symbols.id, id)));
}
