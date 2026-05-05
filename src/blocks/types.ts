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

/** Contexto del visitante para paywall + personalización (F8b). */
export type ViewerContext = {
  /** Sesión de miembro activa (cookie csm.member). */
  isAuthenticated: boolean;
  /** Email del miembro logueado. */
  email: string | null;
  /** Membresía activa (status active/trialing/past_due + currentPeriodEnd vigente). */
  isActive: boolean;
  /** Tier asignado (UUID) o null. */
  tierId: string | null;
  /** Geo + dispositivo + UTM derivados de la request. */
  country: string | null;
  device: "mobile" | "tablet" | "desktop" | "bot";
  utm: { source?: string; medium?: string; campaign?: string };
  /** Hora local del visitante 0-23 si está disponible (cookie csm_tz). */
  hour: number | null;
};

/** Contexto de render: maps de media y símbolos resueltos pre-render. */
export type RenderContext = {
  workspaceId: string;
  mediaMap: Map<string, ResolvedMedia>;
  symbolMap: Map<string, { id: string; name: string; layout: BlockNode[] }>;
  /** Visitante (paywall + personalización). Optional para callers de admin/preview. */
  viewer?: ViewerContext;
  /** Si true, ignoramos paywall + audience (preview en admin/builder). */
  bypassGates?: boolean;
  /** Mapa testKey → variantId resuelto sticky para esta request (F8c A/B). */
  abMap?: Map<string, { testId: string; variantId: string }>;
  /** Si true, el render envuelve cada bloque con data-csm-block-id para
   * habilitar la toolbar de Live-Edit (F8c). */
  editMode?: boolean;
};

export type BlockKind = string;

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * Regla de audiencia embebida por bloque (F8b — personalización SSR).
 * Si está presente, el render evalúa la regla con el contexto de la request
 * (geo, user-agent, cookies, member tier) antes de incluir el bloque.
 *
 * Todas las claves son opcionales y se evalúan con AND. `mode: "show"` (default)
 * incluye el bloque solo si matchea; `mode: "hide"` lo oculta si matchea.
 */
export type AudienceRule = {
  mode?: "show" | "hide";
  /** ISO-3166-1 alpha-2 en mayúsculas (ES, US, MX...). */
  countries?: string[];
  /** Devices permitidos. */
  devices?: Array<"mobile" | "tablet" | "desktop" | "bot">;
  /** UTM source(s) que matchean (substring case-insensitive). */
  utmSource?: string[];
  /** UTM medium(s). */
  utmMedium?: string[];
  /** UTM campaign(s). */
  utmCampaign?: string[];
  /** Estado del miembro: "guest" = sin sesión, "member" = cualquier sesión, "active" = membresía activa. */
  memberState?: Array<"guest" | "member" | "active">;
  /** IDs de tier permitidos (UUIDs). Vacío = cualquier tier. */
  memberTierIds?: string[];
  /** Hora local del visitante (0-23) — solo lado server con cookie de timezone. */
  hourOfDay?: { from: number; to: number };
};

export type BlockNode = {
  id: string;
  kind: BlockKind;
  props: Record<string, unknown>;
  children?: BlockNode[];
  /** Por breakpoint, oculto/visible. Default: visible en todos. */
  hidden?: Partial<Record<Breakpoint, boolean>>;
  /** Regla de audiencia opcional — si no matchea en SSR, el bloque se omite. */
  audience?: AudienceRule;
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
  const audience =
    obj.audience && typeof obj.audience === "object" ? (obj.audience as AudienceRule) : undefined;
  return {
    id,
    kind,
    props,
    ...(children ? { children } : {}),
    ...(hidden ? { hidden } : {}),
    ...(audience ? { audience } : {}),
  };
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
    ...(node.audience ? { audience: { ...node.audience } } : {}),
  };
}
