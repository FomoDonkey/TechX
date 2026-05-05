/**
 * FTS adapter types — backend-agnostic.
 *
 * Dos backends cubiertos:
 *  - **Postgres**: `tsvector` + `websearch_to_tsquery` + `ts_headline` (snippet nativo).
 *  - **MySQL 8+**: `MATCH(...) AGAINST(? IN BOOLEAN MODE)` + snippet generado en JS.
 *
 * Ambos devuelven `FtsHit` con la misma forma. El llamante (`hybridSearch`,
 * `ragRetrieve`, etc.) NO sabe qué backend está abajo.
 */

export type FtsHit = {
  id: string;
  workspaceId: string;
  collectionId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  bodyText: string | null;
  publishedAt: Date | null;
  authorName: string | null;
  authorHandle: string | null;
  /** Score relativo al backend. NO normalizado entre backends — usar solo para ranking interno. */
  ftsRank: number;
  /** Snippet HTML-safe con `<mark>...</mark>` en los términos que matchean. */
  snippet: string;
};

export type FtsScope = "all" | "published";

export type FtsSearchOpts = {
  workspaceId: string;
  query: string;
  scope?: FtsScope;
  limit?: number;
  collectionId?: string;
};

export interface FtsAdapter {
  readonly kind: "postgres" | "mysql";
  search(opts: FtsSearchOpts): Promise<FtsHit[]>;
}
