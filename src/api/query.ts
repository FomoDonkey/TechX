/**
 * Helpers para parsear ?where, ?sort, ?fields, ?include, ?cursor del REST API.
 */

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { iLike as ilike } from "@/db/dialect";

export type FilterOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";

export type FilterClause = {
  field: string;
  op: FilterOp;
  value: string | string[];
};

const OP_PATTERN = /\[([a-z]+)\]\[([a-z]+)\]/i; // legado: where[field][op]

/**
 * Parsea ?where[field][op]=value de un searchParams.
 * Si el valor incluye comas y op="in", se splittea.
 */
export function parseWhere(searchParams: URLSearchParams): FilterClause[] {
  const out: FilterClause[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("where")) continue;
    const m = OP_PATTERN.exec(key.slice(5));
    if (!m) continue;
    const field = m[1];
    const op = m[2];
    if (!field || !op) continue;
    if (!isFilterOp(op)) continue;
    if (op === "in") {
      out.push({
        field,
        op,
        value: value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } else {
      out.push({ field, op, value });
    }
  }
  return out;
}

function isFilterOp(s: string): s is FilterOp {
  return ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains"].includes(s);
}

export type SortClause = { field: string; direction: "asc" | "desc" };

/** ?sort=-publishedAt,title → [{publishedAt,desc},{title,asc}] */
export function parseSort(input: string | null): SortClause[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("-")) return { field: part.slice(1), direction: "desc" as const };
      return { field: part, direction: "asc" as const };
    });
}

/** ?fields=title,slug → ["title","slug"] */
export function parseFields(input: string | null): string[] | null {
  if (!input) return null;
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Cursor base64 con timestamp+id para keyset pagination. */
export function encodeCursor(payload: { ts: string; id: string }): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeCursor(input: string | null): { ts: string; id: string } | null {
  if (!input) return null;
  try {
    const decoded = JSON.parse(Buffer.from(input, "base64url").toString("utf-8"));
    if (typeof decoded.ts === "string" && typeof decoded.id === "string") return decoded;
  } catch {
    return null;
  }
  return null;
}

/**
 * Convierte una FilterClause en SQL Drizzle, dado un mapping seguro de campos→columnas.
 * Si el campo no está en el mapping, devuelve null (silenciosamente ignorado).
 */
export function clauseToSql(
  clause: FilterClause,
  columnMap: Record<string, AnyPgColumn>,
): SQL | null {
  const col = columnMap[clause.field];
  if (!col) return null;
  switch (clause.op) {
    case "eq":
      return eq(col, clause.value as string);
    case "ne":
      return ne(col, clause.value as string);
    case "gt":
      return gt(col, clause.value as string);
    case "gte":
      return gte(col, clause.value as string);
    case "lt":
      return lt(col, clause.value as string);
    case "lte":
      return lte(col, clause.value as string);
    case "in":
      if (!Array.isArray(clause.value) || clause.value.length === 0) return sql`FALSE`;
      return inArray(col, clause.value);
    case "contains":
      return ilike(col, `%${String(clause.value).replace(/[%_]/g, "")}%`);
  }
}

export function combineWhere(clauses: SQL[]): SQL | undefined {
  const filtered = clauses.filter(Boolean);
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1) return filtered[0];
  return and(...filtered);
}

export function sortToOrder(
  sorts: SortClause[],
  columnMap: Record<string, AnyPgColumn>,
  fallback: AnyPgColumn,
): SQL[] {
  const order: SQL[] = [];
  for (const s of sorts) {
    const col = columnMap[s.field];
    if (!col) continue;
    order.push(s.direction === "desc" ? desc(col) : asc(col));
  }
  if (order.length === 0) order.push(desc(fallback));
  return order;
}

/**
 * Filtra un objeto a sólo los campos solicitados.
 * Mantiene "id" siempre.
 */
export function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] | null,
): Partial<T> {
  if (!fields) return obj;
  const out: Partial<T> = {};
  if ("id" in obj) (out as Record<string, unknown>).id = obj.id;
  for (const f of fields) {
    if (f in obj) (out as Record<string, unknown>)[f] = obj[f];
  }
  return out;
}
