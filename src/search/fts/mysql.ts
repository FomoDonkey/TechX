/**
 * MySQL 8+ FTS adapter.
 *
 * Stack:
 *  - `MATCH(title, body_text, excerpt) AGAINST (? IN BOOLEAN MODE)` — relevance score.
 *  - Snippet generado en JS (MySQL no tiene equivalente nativo a `ts_headline`).
 *  - InnoDB stopwords + minimum word length aplican (default 3 chars; configurable
 *    via `innodb_ft_min_token_size`).
 *
 * **Index OBLIGATORIO** (Tarea 15 lo añade en migration):
 *
 *   ALTER TABLE entries ADD FULLTEXT INDEX entries_fts_idx (title, body_text, excerpt);
 *
 * Sin el index, MySQL devuelve `ERROR 1191`. Drizzle MySQL no tiene helper
 * tipado para FULLTEXT — se declara via `sql\`...\`` en migration custom.
 *
 * **Translación de query:**
 *  - Tokens alfanuméricos → `+token*` (required + prefix match) para emular
 *    el comportamiento `websearch_to_tsquery` de "todos los términos suman".
 *  - Frases con comillas → `"phrase"` (BOOLEAN MODE acepta nativo).
 *  - Términos con `-` prefijo → `-token` (excluir).
 *  - Tokens <3 chars se descartan (sub-min_token_size, MySQL los ignora).
 */

import { db } from "@/db/client";
import { entries, users } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { generateSnippet, sanitizeSnippet } from "./snippet";
import type { FtsAdapter, FtsHit, FtsSearchOpts } from "./types";

const MIN_TOKEN_LEN = 3;

/** Convierte query usuario a sintaxis BOOLEAN MODE. */
function buildBooleanQuery(q: string): { booleanQuery: string; rawTerms: string[] } {
  const rawTerms: string[] = [];
  const parts: string[] = [];

  // Extrae frases entre comillas primero — las preservamos tal cual.
  const phraseRe = /"([^"]+)"/g;
  const phrases: string[] = [];
  const remaining = q.replace(phraseRe, (_m, p1) => {
    phrases.push(p1);
    return " ";
  });

  for (const phrase of phrases) {
    const trimmed = phrase.trim();
    if (trimmed.length === 0) continue;
    parts.push(`"${trimmed.replace(/[+\-><()~*"@]/g, "")}"`);
    // Para snippet, descomponemos la frase en sus términos.
    rawTerms.push(...trimmed.split(/\s+/).filter((t) => t.length >= MIN_TOKEN_LEN));
  }

  // Tokens libres separados por whitespace.
  for (const tokRaw of remaining.split(/\s+/)) {
    if (!tokRaw) continue;
    let prefix = "+";
    let body = tokRaw;
    if (body.startsWith("-")) {
      prefix = "-";
      body = body.slice(1);
    } else if (body.startsWith("+")) {
      body = body.slice(1);
    }
    // Sanitizamos: BOOLEAN MODE reserva `+ - > < ( ) ~ * " @`. Removemos todo
    // lo no alfanumérico-guión.
    body = body.replace(/[+\-><()~*"@]/g, "");
    if (body.length < MIN_TOKEN_LEN) continue;
    parts.push(`${prefix}${body}*`);
    if (prefix === "+") rawTerms.push(body);
  }

  return { booleanQuery: parts.join(" "), rawTerms };
}

async function search(opts: FtsSearchOpts): Promise<FtsHit[]> {
  if (!db) return [];
  const q = opts.query.trim();
  if (!q) return [];

  const { booleanQuery, rawTerms } = buildBooleanQuery(q);
  if (!booleanQuery) return [];

  const limit = opts.limit ?? 10;

  // F9b: la búsqueda nunca devuelve forks de branches.
  const conds = [eq(entries.workspaceId, opts.workspaceId), isNull(entries.branchId)];
  if (opts.scope === "published") conds.push(eq(entries.status, "published"));
  if (opts.collectionId) conds.push(eq(entries.collectionId, opts.collectionId));

  // El SAME `MATCH(...) AGAINST (...)` debe aparecer en SELECT, WHERE y ORDER BY
  // para que MySQL reuse el cálculo del FULLTEXT index (1 sola pasada).
  const matchExpr = sql<number>`MATCH(${entries.title}, ${entries.bodyText}, ${entries.excerpt}) AGAINST (${booleanQuery} IN BOOLEAN MODE)`;

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
      ftsRank: matchExpr.as("fts_rank"),
    })
    .from(entries)
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(...conds, sql`${matchExpr} > 0`))
    .orderBy(desc(matchExpr))
    .limit(limit);

  return rows.map((r) => {
    const source = r.bodyText ?? r.excerpt ?? r.title ?? "";
    const rawSnippet = generateSnippet(source, rawTerms, { windowChars: 240 });
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
      ftsRank: Number(r.ftsRank ?? 0),
      snippet: sanitizeSnippet(rawSnippet),
    };
  });
}

export const mysqlFts: FtsAdapter = {
  kind: "mysql",
  search,
};
