/**
 * Tipos del schema de menús.
 *
 * Un menú es una lista jerárquica de items navegables. Cada item es de un tipo
 * discriminado por `type`. Los items pueden tener `children[]` para anidamiento
 * (dropdowns/columnas). Los items "page" y "collection" se resuelven a URLs en
 * el endpoint público; "link" lleva la URL ya resuelta y "external" la mantiene.
 */

import { httpUrlSchema } from "@/lib/safe-url";
import { z } from "zod";

export type MenuItemType = "link" | "page" | "collection" | "external" | "divider" | "heading";

/** Locations en las que un menú puede mostrarse en el sitio público. */
export type MenuLocation = "header" | "footer" | "sidebar" | "custom";

export const MENU_LOCATIONS: readonly MenuLocation[] = [
  "header",
  "footer",
  "sidebar",
  "custom",
] as const;

interface MenuItemBase {
  id: string;
  label: string;
  /** Si el item está atenuado (visible pero gris). */
  muted?: boolean;
  /** Si el item es destacado (CTA). */
  highlight?: boolean;
  /** Si abre en nueva pestaña (links external por defecto sí, demás no). */
  newTab?: boolean;
  /** Hijos opcionales (dropdown/columna). Profundidad máxima 3 niveles. */
  children?: MenuItem[];
  /** Lucide icon name opcional para sidebars/footers ricos. */
  icon?: string;
}

export interface MenuItemLink extends MenuItemBase {
  type: "link";
  /** Path absoluto (`/about`) o URL completa para el sitio actual. */
  href: string;
}

export interface MenuItemPage extends MenuItemBase {
  type: "page";
  /** UUID de la page en /admin/paginas. Resuelto a su path en el endpoint público. */
  pageId: string;
}

export interface MenuItemCollection extends MenuItemBase {
  type: "collection";
  /** Slug de la collection. Renderiza a `/<slug>` o a tabla de archivo. */
  collectionSlug: string;
}

export interface MenuItemExternal extends MenuItemBase {
  type: "external";
  /** URL absoluta (https://). Validada como URL al guardar. */
  href: string;
}

export interface MenuItemDivider extends MenuItemBase {
  type: "divider";
  /** Para divider, label se ignora — pero se mantiene por consistencia. */
}

export interface MenuItemHeading extends MenuItemBase {
  type: "heading";
  /** Heading no clicable, se renderiza como caption en columnas (ideal para footer columns). */
}

export type MenuItem =
  | MenuItemLink
  | MenuItemPage
  | MenuItemCollection
  | MenuItemExternal
  | MenuItemDivider
  | MenuItemHeading;

// ============================================================
// ZOD SCHEMA — recursivo
// ============================================================
const MenuItemBaseSchema = z.object({
  id: z.string(),
  label: z.string().max(120),
  muted: z.boolean().optional(),
  highlight: z.boolean().optional(),
  newTab: z.boolean().optional(),
  icon: z.string().max(40).optional(),
});

type MenuItemSchemaType = z.ZodType<MenuItem>;

// `discriminatedUnion` no soporta z.lazy en Zod 3, así que usamos z.union recursivo.
export const MenuItemSchema: MenuItemSchemaType = z.lazy(() =>
  z.union([
    MenuItemBaseSchema.extend({
      type: z.literal("link"),
      href: z.string().min(1).max(2048),
      children: z.array(MenuItemSchema).max(50).optional(),
    }),
    MenuItemBaseSchema.extend({
      type: z.literal("page"),
      pageId: z.string().uuid(),
      children: z.array(MenuItemSchema).max(50).optional(),
    }),
    MenuItemBaseSchema.extend({
      type: z.literal("collection"),
      collectionSlug: z.string().min(1).max(64),
      children: z.array(MenuItemSchema).max(50).optional(),
    }),
    MenuItemBaseSchema.extend({
      type: z.literal("external"),
      href: httpUrlSchema(2048),
      children: z.array(z.never()).max(0).optional(),
    }),
    MenuItemBaseSchema.extend({
      type: z.literal("divider"),
    }),
    MenuItemBaseSchema.extend({
      type: z.literal("heading"),
      children: z.array(MenuItemSchema).max(50).optional(),
    }),
  ]),
) as MenuItemSchemaType;

export const MenuItemsSchema = z.array(MenuItemSchema).max(200);

/** Profundidad máxima permitida para evitar arboles patológicos. */
export const MAX_MENU_DEPTH = 3;

/** Recorre items recursivamente y verifica que ninguna rama supere depth máximo. */
export function checkMenuDepth(items: MenuItem[], depth = 0): boolean {
  if (depth >= MAX_MENU_DEPTH) {
    for (const item of items) {
      if (item.children && item.children.length > 0) return false;
    }
    return true;
  }
  for (const item of items) {
    if (item.children && !checkMenuDepth(item.children, depth + 1)) return false;
  }
  return true;
}

/** Aplana items recursivamente para conteos / búsquedas. */
export function flattenItems(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  const walk = (list: MenuItem[]) => {
    for (const item of list) {
      out.push(item);
      if (item.children) walk(item.children);
    }
  };
  walk(items);
  return out;
}
