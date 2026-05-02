/**
 * Búsqueda híbrida BM25 (Postgres FTS) + vector (pgvector cosine).
 * Aplicamos Reciprocal Rank Fusion (RRF) sobre los dos rankings.
 *
 * Patrón: cada función recibe `workspaceId` (multi-tenant obligatorio)
 * y devuelve resultados con score normalizado [0, 1].
 */

import { embed, vectorToSql } from "@/ai/embeddings";
import { db } from "@/db/client";
import { type Entry, entries, members, users } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export type SearchHit = {
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
  ftsRank: number;
  vectorScore: number;
  score: number;
  /** Snippet con el fragmento que matchea, con marcas <mark>...</mark> safe-html. */
  snippet?: string;
};

export type SearchScope = "all" | "published";

export type SearchOpts = {
  workspaceId: string;
  query: string;
  /** "published" en frontend público, "all" en admin. */
  scope?: SearchScope;
  /** Top-K final. Default 10. */
  limit?: number;
  /** Filtrado por colección. */
  collectionId?: string;
};

const RRF_K = 60; // estándar Cormack et al.

/**
 * BM25 (FTS) con ts_rank_cd + ts_headline para snippets.
 * Usa configuración 'spanish' por defecto. Si la query es corta, websearch_to_tsquery + plainto fallback.
 */
export async function ftsSearch(opts: SearchOpts): Promise<SearchHit[]> {
  if (!db) return [];
  const q = (opts.query ?? "").trim();
  if (!q) return [];

  const limit = opts.limit ?? 10;
  // websearch_to_tsquery soporta "phrase" "OR" "-excluded"; cae limpio si la query es vacía.
  const tsq = sql`websearch_to_tsquery('spanish', ${q})`;
  const docVec = sql`(setweight(to_tsvector('spanish', coalesce(${entries.title}, '')), 'A') || setweight(to_tsvector('spanish', coalesce(${entries.bodyText}, '')), 'B') || setweight(to_tsvector('spanish', coalesce(${entries.excerpt}, '')), 'C'))`;

  const conds = [eq(entries.workspaceId, opts.workspaceId)];
  if (opts.scope === "published") conds.push(eq(entries.status, "published"));
  if (opts.collectionId) conds.push(eq(entries.collectionId, opts.collectionId));

  const rows = await db
    .select({
      id: entries.id,
      workspaceId: entries.workspaceId,
      collectionId: entries.collectionId,
      title: entries.title,
      slug: entries.slug,
      excerpt: entries.excerpt,
      bodyText: entries.bodyText,
      publishedAt: entries.publishedAt,
      authorName: users.name,
      authorHandle: users.handle,
      ftsRank: sql<number>`ts_rank_cd(${docVec}, ${tsq})`.as("fts_rank"),
      snippet:
        sql<string>`ts_headline('spanish', coalesce(${entries.bodyText}, ${entries.excerpt}, ''), ${tsq}, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=20,MinWords=8')`.as(
          "snippet",
        ),
    })
    .from(entries)
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(...conds, sql`${docVec} @@ ${tsq}`))
    .orderBy(desc(sql`ts_rank_cd(${docVec}, ${tsq})`))
    .limit(limit * 2);

  return rows.map((r) => ({
    ...r,
    vectorScore: 0,
    score: r.ftsRank,
    snippet: sanitizeSnippet(r.snippet),
  }));
}

/**
 * Búsqueda vectorial (cosine similarity sobre `entries.embedding`).
 * Si no hay embeddings (schema vacío), devuelve []. Si la query no produce vector útil, idem.
 */
export async function vectorSearch(opts: SearchOpts): Promise<SearchHit[]> {
  if (!db) return [];
  const q = (opts.query ?? "").trim();
  if (!q) return [];

  const { vector } = await embed(q);
  const limit = opts.limit ?? 10;
  const vsql = vectorToSql(vector);

  const conds = [eq(entries.workspaceId, opts.workspaceId), sql`${entries.embedding} IS NOT NULL`];
  if (opts.scope === "published") conds.push(eq(entries.status, "published"));
  if (opts.collectionId) conds.push(eq(entries.collectionId, opts.collectionId));

  const rows = await db
    .select({
      id: entries.id,
      workspaceId: entries.workspaceId,
      collectionId: entries.collectionId,
      title: entries.title,
      slug: entries.slug,
      excerpt: entries.excerpt,
      bodyText: entries.bodyText,
      publishedAt: entries.publishedAt,
      authorName: users.name,
      authorHandle: users.handle,
      // pgvector: <=> es distancia cosine (0..2). Score = 1 - distancia (1 = idéntico).
      distance: sql<number>`${entries.embedding} <=> ${vsql}::vector`.as("distance"),
    })
    .from(entries)
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(...conds))
    .orderBy(sql`${entries.embedding} <=> ${vsql}::vector`)
    .limit(limit * 2);

  return rows.map((r) => {
    const distance = Number(r.distance ?? 1);
    const sim = Math.max(0, 1 - distance / 2);
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      collectionId: r.collectionId,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      bodyText: r.bodyText,
      publishedAt: r.publishedAt,
      authorName: r.authorName,
      authorHandle: r.authorHandle,
      ftsRank: 0,
      vectorScore: sim,
      score: sim,
    };
  });
}

/**
 * Búsqueda híbrida con RRF.
 * RRF score(d) = sum_i (1 / (k + rank_i(d))) sobre cada ranking en el que aparece.
 */
export async function hybridSearch(opts: SearchOpts): Promise<SearchHit[]> {
  if (!db) return [];
  const limit = opts.limit ?? 10;
  const [ftsResults, vecResults] = await Promise.all([
    ftsSearch({ ...opts, limit: limit * 2 }).catch(() => []),
    vectorSearch({ ...opts, limit: limit * 2 }).catch(() => []),
  ]);

  type Bucket = { hit: SearchHit; rrf: number; ftsRank: number; vecRank: number };
  const merged = new Map<string, Bucket>();

  ftsResults.forEach((hit, i) => {
    const rank = i + 1;
    const score = 1 / (RRF_K + rank);
    const existing = merged.get(hit.id);
    if (existing) {
      existing.rrf += score;
      existing.ftsRank = rank;
      existing.hit.snippet = existing.hit.snippet ?? hit.snippet;
      existing.hit.ftsRank = hit.ftsRank;
    } else {
      merged.set(hit.id, { hit: { ...hit }, rrf: score, ftsRank: rank, vecRank: 0 });
    }
  });

  vecResults.forEach((hit, i) => {
    const rank = i + 1;
    const score = 1 / (RRF_K + rank);
    const existing = merged.get(hit.id);
    if (existing) {
      existing.rrf += score;
      existing.vecRank = rank;
      existing.hit.vectorScore = hit.vectorScore;
    } else {
      merged.set(hit.id, { hit: { ...hit }, rrf: score, ftsRank: 0, vecRank: rank });
    }
  });

  const sorted = [...merged.values()].sort((a, b) => b.rrf - a.rrf).slice(0, limit);

  // Normalizamos el score final a [0, 1] para mostrar barras o filtrar.
  const max = sorted[0]?.rrf ?? 1;
  return sorted.map((b) => ({
    ...b.hit,
    score: max > 0 ? b.rrf / max : 0,
  }));
}

function sanitizeSnippet(snippet: string | null | undefined): string {
  if (!snippet) return "";
  // ts_headline puede contener cualquier carácter del documento.
  // Como vamos a renderizar con dangerouslySetInnerHTML, escapamos todo y reemplazamos solo nuestras marcas seguras.
  // Truco: pasamos delimiters únicos a ts_headline (StartSel/StopSel) y escapamos todo lo demás.
  const escaped = snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  // Restauramos solo los marcadores controlados que pasamos a Postgres.
  return escaped.replace(/&lt;mark&gt;/g, "<mark>").replace(/&lt;\/mark&gt;/g, "</mark>");
}

/**
 * Helper para Ask CSM: top-K passages con texto largo para contexto RAG.
 */
export async function ragRetrieve(opts: {
  workspaceId: string;
  query: string;
  k?: number;
}): Promise<SearchHit[]> {
  return hybridSearch({
    workspaceId: opts.workspaceId,
    query: opts.query,
    scope: "published",
    limit: opts.k ?? 5,
  });
}

/**
 * Cuenta total de entries con embedding generado vs total publicado.
 * Útil para mostrar estado de cobertura en admin/buscar.
 */
export async function indexCoverage(workspaceId: string): Promise<{
  withEmbedding: number;
  total: number;
}> {
  if (!db) return { withEmbedding: 0, total: 0 };
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), eq(entries.status, "published")));
  const embRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.status, "published"),
        sql`${entries.embedding} IS NOT NULL`,
      ),
    );
  return {
    total: Number(totalRows[0]?.count ?? 0),
    withEmbedding: Number(embRows[0]?.count ?? 0),
  };
}

/** Reservada para sugerencias de enlaces internos (busca match contra publicados). */
export async function findLinkCandidates(opts: {
  workspaceId: string;
  query: string;
  excludeId?: string;
  limit?: number;
}): Promise<SearchHit[]> {
  const hits = await hybridSearch({
    workspaceId: opts.workspaceId,
    query: opts.query,
    scope: "published",
    limit: (opts.limit ?? 5) + 2,
  });
  return hits.filter((h) => h.id !== opts.excludeId).slice(0, opts.limit ?? 5);
}

// re-exports útiles para callers
export { embed, vectorToSql };
// Mantengo `members` import para evitar tree-shake si en el futuro se filtra por miembro
void members;
void gte;
// silencia "type used only" para Entry
export type { Entry };
