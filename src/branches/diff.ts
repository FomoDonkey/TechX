import type { Entry } from "@/db/schema";
import { diffWordsWithSpace } from "diff";

/**
 * Diff a tres niveles para entries:
 *  1. Block-level (added/removed/modified) — stable por block id, fallback hash.
 *  2. Inline word diff — para bloques modificados con texto.
 *  3. Meta diff — title/slug/excerpt/status/seo/fields/scheduledAt.
 */

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export type BlockSnapshot = {
  /** Identificador estable del bloque: attrs.id o hash determinista. */
  id: string;
  /** Tipo del nodo Tiptap (`heading`, `paragraph`, `image`, `callout`...). */
  type: string;
  /** Texto plano agregado del bloque (para diff de palabras). */
  text: string;
  /** El nodo completo (para render visual). */
  node: TiptapNode;
};

export type BlockDiff =
  | { kind: "unchanged"; left: BlockSnapshot; right: BlockSnapshot }
  | { kind: "added"; right: BlockSnapshot }
  | { kind: "removed"; left: BlockSnapshot }
  | {
      kind: "modified";
      left: BlockSnapshot;
      right: BlockSnapshot;
      textDiff: Array<{ value: string; added?: boolean; removed?: boolean }>;
    };

export type MetaDiffEntry = {
  field: string;
  changed: boolean;
  left: unknown;
  right: unknown;
};

export type EntryDiff = {
  blocks: BlockDiff[];
  meta: MetaDiffEntry[];
  /** True si HAY algún cambio (block o meta). */
  hasChanges: boolean;
  /** True si la fork tiene el body distinto al base. */
  bodyChanged: boolean;
};

const META_FIELDS = [
  "title",
  "slug",
  "excerpt",
  "status",
  "scheduledAt",
  "publishedAt",
  "locale",
  "coverId",
  "ogImageUrl",
] as const;

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function blockTextOf(node: TiptapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  const parts: string[] = [];
  for (const c of node.content) {
    if (typeof c.text === "string") parts.push(c.text);
    else if (Array.isArray(c.content)) parts.push(blockTextOf(c));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function blockIdOf(node: TiptapNode, fallbackIdx: number): string {
  const attrId = node.attrs && typeof node.attrs.id === "string" ? (node.attrs.id as string) : null;
  if (attrId) return attrId;
  // Fallback estable: hash del tipo + texto + idx (suficiente para diffing).
  const text = blockTextOf(node);
  return `auto-${djb2(`${node.type}|${text}`)}-${fallbackIdx}`;
}

/**
 * Aplana un doc Tiptap en sus bloques top-level (1 nivel: doc.content).
 * Para diff fino, los nodos anidados se comparan como subtree completo.
 */
export function snapshotBlocks(doc: unknown): BlockSnapshot[] {
  if (!doc || typeof doc !== "object") return [];
  const root = doc as TiptapNode;
  if (!Array.isArray(root.content)) return [];
  return root.content.map((node, i) => ({
    id: blockIdOf(node, i),
    type: node.type,
    text: blockTextOf(node),
    node,
  }));
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffBlocks(left: BlockSnapshot[], right: BlockSnapshot[]): BlockDiff[] {
  const leftById = new Map(left.map((b) => [b.id, b] as const));
  const rightById = new Map(right.map((b) => [b.id, b] as const));
  const seenLeft = new Set<string>();
  const out: BlockDiff[] = [];

  // Primer pass: en orden de `right` (preserva orden visual de la branch).
  for (const r of right) {
    const l = leftById.get(r.id);
    if (l) {
      seenLeft.add(r.id);
      if (deepEqual(l.node, r.node)) {
        out.push({ kind: "unchanged", left: l, right: r });
      } else {
        const textDiff = diffWordsWithSpace(l.text, r.text);
        out.push({ kind: "modified", left: l, right: r, textDiff });
      }
    } else {
      out.push({ kind: "added", right: r });
    }
  }

  // Segundo pass: bloques que estaban en left y no aparecen en right → removidos.
  for (const l of left) {
    if (seenLeft.has(l.id)) continue;
    if (rightById.has(l.id)) continue;
    out.push({ kind: "removed", left: l });
  }

  return out;
}

export function diffMeta(base: Entry | null, current: Entry): MetaDiffEntry[] {
  const out: MetaDiffEntry[] = [];
  for (const field of META_FIELDS) {
    const a = base ? (base as unknown as Record<string, unknown>)[field] : null;
    const b = (current as unknown as Record<string, unknown>)[field];
    out.push({
      field,
      changed: !deepEqual(a, b),
      left: a ?? null,
      right: b ?? null,
    });
  }
  // SEO + fields como JSON.
  const seoA = base?.seo ?? null;
  const seoB = current.seo ?? null;
  out.push({ field: "seo", changed: !deepEqual(seoA, seoB), left: seoA, right: seoB });
  const fieldsA = base?.fields ?? null;
  const fieldsB = current.fields ?? null;
  out.push({
    field: "fields",
    changed: !deepEqual(fieldsA, fieldsB),
    left: fieldsA,
    right: fieldsB,
  });
  return out;
}

export function diffEntry(base: Entry | null, current: Entry): EntryDiff {
  const left = snapshotBlocks(base?.body ?? null);
  const right = snapshotBlocks(current.body ?? null);
  const blocks = diffBlocks(left, right);
  const meta = diffMeta(base, current);
  const bodyChanged = blocks.some((b) => b.kind !== "unchanged");
  const metaChanged = meta.some((m) => m.changed);
  return {
    blocks,
    meta,
    bodyChanged,
    hasChanges: bodyChanged || metaChanged,
  };
}

/** Solo el resumen (cuántos bloques cambiaron, cuántos campos meta). Usado en listing. */
export function diffSummary(
  base: Entry | null,
  current: Entry,
): {
  added: number;
  removed: number;
  modified: number;
  metaChanges: number;
} {
  const left = snapshotBlocks(base?.body ?? null);
  const right = snapshotBlocks(current.body ?? null);
  const blocks = diffBlocks(left, right);
  const meta = diffMeta(base, current);
  return {
    added: blocks.filter((b) => b.kind === "added").length,
    removed: blocks.filter((b) => b.kind === "removed").length,
    modified: blocks.filter((b) => b.kind === "modified").length,
    metaChanges: meta.filter((m) => m.changed).length,
  };
}
