/**
 * Helpers para extraer testKeys referenciados en un layout (F8c).
 *
 * El render necesita saber qué tests resolver ANTES de renderizar para que
 * la cookie sticky se persista atómicamente. Recorrer el árbol una vez,
 * recoger keys, hacer una sola query.
 */

import type { BlockNode } from "@/blocks/types";

const KEY_RE = /^[a-z0-9_-]{1,64}$/i;

/** Recoge todos los testKey referenciados por bloques `ab` en el layout. */
export function collectAbKeys(layout: BlockNode[]): string[] {
  const keys = new Set<string>();
  walk(layout, keys);
  return Array.from(keys);
}

function walk(layout: BlockNode[], acc: Set<string>) {
  for (const node of layout) {
    if (node.kind === "ab") {
      const k = (node.props as Record<string, unknown>).testKey;
      if (typeof k === "string" && KEY_RE.test(k)) acc.add(k);
    }
    if (node.children?.length) walk(node.children, acc);
  }
}
