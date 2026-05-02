import type { Media } from "@/db/schema";
import { nanoid } from "nanoid";

/**
 * Tipos del page builder. El layout de una página o un símbolo es un árbol de
 * BlockNodes. Cada nodo tiene un kind (identificador del bloque), props (valores
 * editados por el usuario), opcionalmente children si es un bloque contenedor,
 * y modificadores como visibility por breakpoint.
 */

export type ResolvedMedia = Pick<
  Media,
  "id" | "url" | "alt" | "width" | "height" | "blurhash" | "focalX" | "focalY" | "mime"
>;

/** Contexto de render: maps de media y símbolos resueltos pre-render. */
export type RenderContext = {
  workspaceId: string;
  mediaMap: Map<string, ResolvedMedia>;
  symbolMap: Map<string, { id: string; name: string; layout: BlockNode[] }>;
};

export type BlockKind = string;

export type Breakpoint = "mobile" | "tablet" | "desktop";

export type BlockNode = {
  id: string;
  kind: BlockKind;
  props: Record<string, unknown>;
  children?: BlockNode[];
  /** Por breakpoint, oculto/visible. Default: visible en todos. */
  hidden?: Partial<Record<Breakpoint, boolean>>;
};

export const EMPTY_LAYOUT: BlockNode[] = [];

export function newId(): string {
  return nanoid(12);
}

/**
 * Asegura que cada nodo tenga id único, props como objeto y children como array
 * (si aplica). Si el bloque no debería tener children pero los tiene, se
 * mantienen — el render decide qué hacer.
 */
export function normalizeLayout(input: unknown): BlockNode[] {
  if (!Array.isArray(input)) return [];
  return input.map((n) => normalizeNode(n)).filter((n): n is BlockNode => n !== null);
}

function normalizeNode(input: unknown): BlockNode | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const kind = typeof obj.kind === "string" ? obj.kind : null;
  if (!kind) return null;
  const id = typeof obj.id === "string" && obj.id.length > 0 ? obj.id : newId();
  const props =
    obj.props && typeof obj.props === "object" ? (obj.props as Record<string, unknown>) : {};
  const children = Array.isArray(obj.children) ? normalizeLayout(obj.children) : undefined;
  const hidden =
    obj.hidden && typeof obj.hidden === "object"
      ? (obj.hidden as Partial<Record<Breakpoint, boolean>>)
      : undefined;
  return { id, kind, props, ...(children ? { children } : {}), ...(hidden ? { hidden } : {}) };
}

/** Recorre el árbol y devuelve todos los nodos en orden DFS */
export function flattenLayout(layout: BlockNode[]): BlockNode[] {
  const out: BlockNode[] = [];
  function walk(nodes: BlockNode[]) {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(layout);
  return out;
}

/** Encuentra un nodo por id en el árbol */
export function findNode(layout: BlockNode[], id: string): BlockNode | null {
  for (const n of layout) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Devuelve nuevo árbol con el nodo `id` reemplazado/transformado */
export function updateNode(
  layout: BlockNode[],
  id: string,
  updater: (n: BlockNode) => BlockNode,
): BlockNode[] {
  return layout.map((n) => {
    if (n.id === id) return updater(n);
    if (n.children?.length) return { ...n, children: updateNode(n.children, id, updater) };
    return n;
  });
}

/** Devuelve nuevo árbol con el nodo `id` eliminado */
export function removeNode(layout: BlockNode[], id: string): BlockNode[] {
  return layout
    .filter((n) => n.id !== id)
    .map((n) => (n.children?.length ? { ...n, children: removeNode(n.children, id) } : n));
}

/** Inserta `node` como hijo de `parentId` en el índice indicado. Si parentId es
 * null, inserta en raíz. */
export function insertNode(
  layout: BlockNode[],
  parentId: string | null,
  index: number,
  node: BlockNode,
): BlockNode[] {
  if (parentId === null) {
    const next = [...layout];
    const i = Math.max(0, Math.min(index, next.length));
    next.splice(i, 0, node);
    return next;
  }
  return layout.map((n) => {
    if (n.id === parentId) {
      const children = n.children ?? [];
      const next = [...children];
      const i = Math.max(0, Math.min(index, next.length));
      next.splice(i, 0, node);
      return { ...n, children: next };
    }
    if (n.children?.length)
      return { ...n, children: insertNode(n.children, parentId, index, node) };
    return n;
  });
}

/** Encuentra el padre de un nodo (null si está en raíz) */
export function findParent(
  layout: BlockNode[],
  id: string,
  parent: BlockNode | null = null,
): { parent: BlockNode | null; index: number } | null {
  for (let i = 0; i < layout.length; i++) {
    const n = layout[i];
    if (!n) continue;
    if (n.id === id) return { parent, index: i };
    if (n.children?.length) {
      const found = findParent(n.children, id, n);
      if (found) return found;
    }
  }
  return null;
}

/** Mueve un nodo a otra posición (parent, index). Devuelve nuevo árbol. */
export function moveNode(
  layout: BlockNode[],
  id: string,
  toParentId: string | null,
  toIndex: number,
): BlockNode[] {
  const node = findNode(layout, id);
  if (!node) return layout;
  // Evita mover a un descendiente propio
  if (toParentId && isDescendant(node, toParentId)) return layout;
  const without = removeNode(layout, id);
  return insertNode(without, toParentId, toIndex, node);
}

function isDescendant(node: BlockNode, id: string): boolean {
  if (!node.children?.length) return false;
  for (const c of node.children) {
    if (c.id === id) return true;
    if (isDescendant(c, id)) return true;
  }
  return false;
}

/** Clona un nodo (con nuevos ids recursivos) */
export function cloneNodeWithNewIds(node: BlockNode): BlockNode {
  return {
    id: newId(),
    kind: node.kind,
    props: { ...node.props },
    ...(node.children ? { children: node.children.map(cloneNodeWithNewIds) } : {}),
    ...(node.hidden ? { hidden: { ...node.hidden } } : {}),
  };
}
