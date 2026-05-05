import type { Branch, Entry, EntryBranchState } from "@/db/schema";

export const BRANCH_COOKIE = "csm_branch";
export const BRANCH_PREVIEW_COOKIE = "csm_branch_preview";
/** En segundos (Next API). 30 días. */
export const BRANCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** En segundos. 30 minutos — sólo dura una sesión de preview. */
export const BRANCH_PREVIEW_COOKIE_MAX_AGE = 60 * 30;

/** Resultado del resolver: la entry visible en una branch concreta. */
export type ResolvedEntry = {
  entry: Entry;
  /** Estado lógico vista desde la branch activa. */
  visibility: EntryBranchState | "main";
  /** Para entries forked, la entry original de main (para diff). */
  base?: Entry | null;
};

export type BranchStats = {
  forked: number;
  created: number;
  deleted: number;
  /** Entries main que han cambiado desde que la branch nació (potencial conflicto al merge). */
  conflicts: number;
  /** Comentarios abiertos sin resolver. */
  openComments: number;
};

export type BranchWithStats = Branch & { stats: BranchStats };
