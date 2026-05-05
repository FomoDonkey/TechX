/**
 * Postgres FTS adapter.
 *
 * Stack:
 *  - `websearch_to_tsquery('spanish', q)` — soporta `"phrase"`, `OR`, `-excluded`.
 *  - `to_tsvector('spanish', col)` con `setweight()` (A=title, B=bodyText, C=excerpt).
 *  - `ts_rank_cd(...)` para ranking proximity-aware.
 *  - `ts_headline(...)` para snippets con `<mark>...</mark>` nativos.
 *
 * **Index recomendado** (ya en schema.pg.ts via index sobre expresión):
 *
 *   CREATE INDEX entries_fts_idx ON entries
 *     USING GIN (
 *       (setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
 *        setweight(to_tsvector('spanish', coalesce(body_text, '')), 'B') ||
 *        setweight(to_tsvector('spanish', coalesce(excerpt, '')), 'C'))
 *     );
 *
 * Sin el index, las queries siguen funcionando pero hacen seq scan.
 */

import { db } from "@/db/client";
import { entries, users } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { sanitizeSnippet } from "./snippet";
import type { FtsAdapter, FtsHit, FtsSearchOpts } from "./types";

async function search(opts: FtsSearchOpts): Promise<FtsHit[]> {
  if (!db) return [];
  const q = opts.query.trim();
  if (!q) return [];

  const limit = opts.limit ?? 10;
  const tsq = sql`websearch_to_tsquery('spanish', ${q})`;
  const docVec = sql`(setweight(to_tsvector('spanish', coalesce(${entries.title}, '')), 'A') || setweight(to_tsvector('spanish', coalesce(${entries.bodyText}, '')), 'B') || setweight(to_tsvector('spanish', coalesce(${entries.excerpt}, '')), 'C'))`;

  // F9b: la búsqueda nunca devuelve forks de branches.
  const conds = [eq(entries.workspaceId, opts.workspaceId), isNull(entries.branchId)];
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
    .limit(limit);

  return rows.map((r) => ({
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
    ftsRank: Number(r.ftsRank ?? 0),
    snippet: sanitizeSnippet(r.snippet),
  }));
}

export const postgresFts: FtsAdapter = {
  kind: "postgres",
  search,
};
