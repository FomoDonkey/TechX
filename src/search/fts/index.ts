/**
 * FTS adapter — entrypoint público.
 *
 * Auto-detect del backend según `db.dialect`:
 *  - `postgres` → tsvector + ts_headline (ranking nativo + snippets nativos).
 *  - `mysql` → MATCH AGAINST IN BOOLEAN MODE (snippets generados en JS).
 *
 * Los call-sites (`hybridSearch`, `ragRetrieve`, `findLinkCandidates`) usan
 * `ftsSearch(opts)` y NO ven el backend concreto.
 */

import { dialect } from "@/db/client";
import { mysqlFts } from "./mysql";
import { postgresFts } from "./postgres";
import type { FtsAdapter, FtsSearchOpts } from "./types";

let adapter: FtsAdapter | null = null;

export function getFts(): FtsAdapter {
  if (adapter) return adapter;
  adapter = dialect === "mysql" ? mysqlFts : postgresFts;
  return adapter;
}

export function ftsSearch(opts: FtsSearchOpts) {
  return getFts().search(opts);
}

export type { FtsAdapter, FtsHit, FtsSearchOpts, FtsScope } from "./types";
