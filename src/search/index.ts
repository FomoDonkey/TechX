/**
 * Búsqueda híbrida BM25 (Postgres FTS) + vector (pgvector cosine).
 * Aplicamos Reciprocal Rank Fusion (RRF) sobre los dos rankings.
 *
 * Patrón: cada función recibe `workspaceId` (multi-tenant obligatorio)
 * y devuelve resultados con score normalizado [0, 1].
 */

import { embed, vectorToSql } from "@/ai/embeddings";
import { db } from "@/db/client";
import { cosineDistance, distanceToSimilarity } from "@/db/dialect";
import { type Entry, entries, members, users } from "@/db/schema";
import { ftsSearch as ftsSearchAdapter } from "@/search/fts";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

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
 * BM25 (FTS) cross-dialect — delega al adapter en `@/search/fts/`.
 *
 * Postgres: `tsvector` + `ts_rank_cd` + `ts_headline` (snippets nativos).
 * MySQL:    `MATCH AGAINST IN BOOLEAN MODE` + snippets generados en JS.
 *
 * El adapter ya devuelve `snippet` HTML-safe — aquí solo añadimos los campos
 * extra de `SearchHit` (vectorScore=0, score=ftsRank) para compatibilidad con
 * el ranking RRF de `hybridSearch`.
 */
export async function ftsSearch(opts: SearchOpts): Promise<SearchHit[]> {
  if (!db) return [];
  const limit = opts.limit ?? 10;
  const hits = await ftsSearchAdapter({
    workspaceId: opts.workspaceId,
    query: opts.query,
    scope: opts.scope,
    collectionId: opts.collectionId,
    limit: limit * 2,
  });
  return hits.map((h) => ({
    id: h.id,
    workspaceId: h.workspaceId,
    collectionId: h.collectionId,
    title: h.title,
    slug: h.slug,
    excerpt: h.excerpt,
    bodyText: h.bodyText,
    publishedAt: h.publishedAt,
    authorName: h.authorName,
    authorHandle: h.authorHandle,
    ftsRank: h.ftsRank,
    vectorScore: 0,
    score: h.ftsRank,
    snippet: h.snippet,
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
  // Distancia cosine cross-dialect: pgvector usa `<=>`, MySQL 9 usa VEC_DISTANCE.
  const distExpr = cosineDistance(entries.embedding, vector);

  // F9b: el vector search nunca devuelve forks de branches.
  const conds = [
    eq(entries.workspaceId, opts.workspaceId),
    isNull(entries.branchId),
    sql`${entries.embedding} IS NOT NULL`,
  ];
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
      distance: distExpr.as("distance"),
    })
    .from(entries)
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(...conds))
    .orderBy(distExpr)
    .limit(limit * 2);

  return rows.map((r) => {
    const distance = Number(r.distance ?? 1);
    const sim = distanceToSimilarity(distance);
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
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.status, "published"),
        // F9b: cobertura del índice solo cuenta main.
        isNull(entries.branchId),
      ),
    );
  const embRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.status, "published"),
        isNull(entries.branchId),
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
