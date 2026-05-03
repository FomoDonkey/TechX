/**
 * CRUD + lecturas para menús. Todas las funciones reciben workspaceId
 * explícitamente y filtran por él para evitar leak cross-tenant.
 *
 * El endpoint público resuelve los items "page" y "collection" a URLs
 * concretas; aquí sólo persistimos la forma serializada del menú.
 */

import { db } from "@/db/client";
import { type Menu, type NewMenu, collections, menus, pages } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  type MenuItem,
  type MenuItemCollection,
  type MenuItemPage,
  MenuItemsSchema,
  type MenuLocation,
  checkMenuDepth,
  flattenItems,
} from "./types";

export async function listMenus(workspaceId: string): Promise<Menu[]> {
  if (!db) return [];
  return db
    .select()
    .from(menus)
    .where(eq(menus.workspaceId, workspaceId))
    .orderBy(asc(menus.location), asc(menus.name));
}

export async function getMenuById(workspaceId: string, id: string): Promise<Menu | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.workspaceId, workspaceId), eq(menus.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getMenuBySlug(workspaceId: string, slug: string): Promise<Menu | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.workspaceId, workspaceId), eq(menus.slug, slug)))
    .limit(1);
  return row ?? null;
}

/**
 * Lookup público (sin auth) por slug + host. Resuelve workspaceId desde el host
 * (custom domain o subdominio); si no hay match cae al primer workspace
 * existente. Esto evita que dos workspaces con el mismo slug `header` se mezclen.
 */
export async function getPublicMenuBySlug(slug: string, host?: string): Promise<Menu | null> {
  if (!db) return null;
  if (host) {
    const { resolveWorkspaceIdByHost } = await import("@/redirects/runtime");
    const workspaceId = await resolveWorkspaceIdByHost(host);
    if (workspaceId) {
      return getMenuBySlug(workspaceId, slug);
    }
  }
  // Fallback v1: primer match global. Sólo se llega aquí si no hay host (raro).
  const [row] = await db.select().from(menus).where(eq(menus.slug, slug)).limit(1);
  return row ?? null;
}

export interface CreateMenuInput {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  location: MenuLocation;
  items?: MenuItem[];
  isDefault?: boolean;
  createdById?: string | null;
}

export async function createMenu(input: CreateMenuInput): Promise<Menu> {
  if (!db) throw new Error("DB not configured");
  const items = input.items ?? [];
  validateItems(items);
  if (input.isDefault) {
    await db
      .update(menus)
      .set({ isDefault: false })
      .where(and(eq(menus.workspaceId, input.workspaceId), eq(menus.location, input.location)));
  }
  const [row] = await db
    .insert(menus)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      location: input.location,
      items: items as unknown as NewMenu["items"],
      isDefault: input.isDefault ?? false,
      createdById: input.createdById ?? null,
    })
    .returning();
  if (!row) throw new Error("No se pudo crear el menú");
  return row;
}

export interface UpdateMenuInput {
  workspaceId: string;
  id: string;
  name?: string;
  description?: string;
  location?: MenuLocation;
  items?: MenuItem[];
  isDefault?: boolean;
}

export async function updateMenu(input: UpdateMenuInput): Promise<Menu> {
  if (!db) throw new Error("DB not configured");
  const patch: Partial<NewMenu> & { updatedAt: Date } = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location !== undefined) patch.location = input.location;
  if (input.items !== undefined) {
    validateItems(input.items);
    patch.items = input.items as unknown as NewMenu["items"];
    patch.version = sql`${menus.version} + 1` as unknown as number;
  }
  if (input.isDefault !== undefined) {
    patch.isDefault = input.isDefault;
    if (input.isDefault) {
      const current = await getMenuById(input.workspaceId, input.id);
      const targetLocation = input.location ?? current?.location;
      if (targetLocation) {
        await db
          .update(menus)
          .set({ isDefault: false })
          .where(and(eq(menus.workspaceId, input.workspaceId), eq(menus.location, targetLocation)));
      }
    }
  }
  const [row] = await db
    .update(menus)
    .set(patch)
    .where(and(eq(menus.workspaceId, input.workspaceId), eq(menus.id, input.id)))
    .returning();
  if (!row) throw new Error("Menú no encontrado");
  return row;
}

export async function deleteMenu(workspaceId: string, id: string): Promise<void> {
  if (!db) throw new Error("DB not configured");
  await db.delete(menus).where(and(eq(menus.workspaceId, workspaceId), eq(menus.id, id)));
}

/**
 * Resolución de items "page" y "collection" para el endpoint público:
 * convierte pageId → path y collectionSlug → "/<slug>". Recursivo.
 */
export interface ResolvedMenuItem {
  id: string;
  label: string;
  href: string | null;
  type: MenuItem["type"];
  muted?: boolean;
  highlight?: boolean;
  newTab?: boolean;
  icon?: string;
  children?: ResolvedMenuItem[];
}

export async function resolveMenu(
  workspaceId: string,
  items: MenuItem[],
): Promise<ResolvedMenuItem[]> {
  if (!db) return items.map(stripUnresolved);
  const flat = flattenItems(items);
  const pageIds = new Set<string>();
  const collectionSlugs = new Set<string>();
  for (const item of flat) {
    if (item.type === "page") pageIds.add((item as MenuItemPage).pageId);
    if (item.type === "collection") {
      collectionSlugs.add((item as MenuItemCollection).collectionSlug);
    }
  }
  const pageMap = new Map<string, string>();
  if (pageIds.size > 0) {
    const rows = await db
      .select({ id: pages.id, path: pages.path, status: pages.status })
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), inArray(pages.id, [...pageIds])));
    for (const r of rows) {
      if (r.status === "published") pageMap.set(r.id, r.path);
    }
  }
  const collectionMap = new Map<string, string>();
  if (collectionSlugs.size > 0) {
    const rows = await db
      .select({ slug: collections.slug })
      .from(collections)
      .where(
        and(
          eq(collections.workspaceId, workspaceId),
          inArray(collections.slug, [...collectionSlugs]),
        ),
      );
    for (const r of rows) collectionMap.set(r.slug, `/${r.slug}`);
  }
  const resolveOne = (item: MenuItem): ResolvedMenuItem => {
    let href: string | null = null;
    switch (item.type) {
      case "link":
        href = item.href;
        break;
      case "external":
        href = item.href;
        break;
      case "page":
        href = pageMap.get(item.pageId) ?? null;
        break;
      case "collection":
        href = collectionMap.get(item.collectionSlug) ?? null;
        break;
      default:
        href = null;
    }
    const out: ResolvedMenuItem = {
      id: item.id,
      label: item.label,
      type: item.type,
      href,
    };
    if (item.muted) out.muted = true;
    if (item.highlight) out.highlight = true;
    if (item.newTab || item.type === "external") out.newTab = true;
    if (item.icon) out.icon = item.icon;
    if ("children" in item && item.children) {
      out.children = item.children.map(resolveOne);
    }
    return out;
  };
  return items.map(resolveOne);
}

function stripUnresolved(item: MenuItem): ResolvedMenuItem {
  const out: ResolvedMenuItem = {
    id: item.id,
    label: item.label,
    type: item.type,
    href: null,
  };
  if (item.muted) out.muted = true;
  if (item.highlight) out.highlight = true;
  if (item.newTab) out.newTab = true;
  if (item.icon) out.icon = item.icon;
  if ("children" in item && item.children) {
    out.children = item.children.map(stripUnresolved);
  }
  return out;
}

function validateItems(items: MenuItem[]): void {
  const parsed = MenuItemsSchema.safeParse(items);
  if (!parsed.success) {
    throw new Error(`Estructura de menú inválida: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }
  if (!checkMenuDepth(items)) {
    throw new Error("Profundidad máxima de menú (3 niveles) excedida");
  }
}

/** Genera un slug deterministic a partir de un nombre. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function ensureUniqueSlug(
  workspaceId: string,
  base: string,
  ignoreId?: string,
): Promise<string> {
  if (!db) return base;
  let candidate = base;
  let n = 1;
  while (true) {
    const existing = await db
      .select({ id: menus.id })
      .from(menus)
      .where(and(eq(menus.workspaceId, workspaceId), eq(menus.slug, candidate)))
      .limit(1);
    const conflict = existing[0];
    if (!conflict || (ignoreId && conflict.id === ignoreId)) return candidate;
    n++;
    candidate = `${base}-${n}`;
  }
}
