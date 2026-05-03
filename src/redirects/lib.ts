/**
 * CRUD + bulk + CSV import/export para redirects.
 *
 * Todas las funciones reciben workspaceId explícitamente y filtran por él.
 * `incrementHits` es atómico para evitar race conditions desde middleware.
 */

import { db } from "@/db/client";
import { type NewRedirect, type Redirect, redirects } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { type RedirectRule, isSelfReferential } from "./matcher";

export type MatchType = "exact" | "prefix" | "regex";

export interface CreateRedirectInput {
  workspaceId: string;
  source: string;
  destination: string;
  statusCode?: 301 | 302 | 307 | 308;
  matchType?: MatchType;
  preserveQuery?: boolean;
  enabled?: boolean;
  description?: string;
  createdById?: string | null;
}

const VALID_STATUS_CODES = [301, 302, 307, 308] as const;

function validateRule(input: {
  source: string;
  destination: string;
  matchType?: MatchType;
  statusCode?: number;
}) {
  if (!input.source || input.source.length > 2048) throw new Error("Origen inválido");
  if (!input.destination || input.destination.length > 2048) throw new Error("Destino inválido");
  if (input.statusCode && !VALID_STATUS_CODES.includes(input.statusCode as 301)) {
    throw new Error("Status code debe ser 301/302/307/308");
  }
  const matchType = input.matchType ?? "exact";
  if (matchType === "exact" || matchType === "prefix") {
    if (!input.source.startsWith("/")) {
      throw new Error("Origen debe empezar con / para tipo exact/prefix");
    }
  }
  if (matchType === "regex") {
    if (input.source.length > 256) {
      throw new Error("RegExp demasiado larga (máx 256 chars)");
    }
    // Heurística anti-ReDoS: rechaza patrones con quantifiers anidados
    // del tipo `(a+)+`, `(a*)*`, `(a+)*` que disparan backtracking catastrófico.
    if (/\([^)]*[+*][^)]*\)[+*]/.test(input.source)) {
      throw new Error("RegExp con quantifiers anidados — riesgo de ReDoS");
    }
    try {
      new RegExp(input.source);
    } catch {
      throw new Error("Origen no es una RegExp válida");
    }
  }
  if (
    isSelfReferential({
      source: input.source,
      destination: input.destination,
      matchType,
    })
  ) {
    throw new Error("La regla redirige a sí misma — evita el ciclo");
  }
}

export async function listRedirects(
  workspaceId: string,
  opts?: { search?: string; enabled?: boolean; matchType?: MatchType; limit?: number },
): Promise<Redirect[]> {
  if (!db) return [];
  const conditions = [eq(redirects.workspaceId, workspaceId)];
  if (opts?.enabled !== undefined) conditions.push(eq(redirects.enabled, opts.enabled));
  if (opts?.matchType) conditions.push(eq(redirects.matchType, opts.matchType));
  if (opts?.search) {
    conditions.push(
      or(
        ilike(redirects.source, `%${opts.search}%`),
        ilike(redirects.destination, `%${opts.search}%`),
      ) as never,
    );
  }
  return db
    .select()
    .from(redirects)
    .where(and(...conditions))
    .orderBy(desc(redirects.updatedAt))
    .limit(opts?.limit ?? 500);
}

/** Lista enabled+filtrada para uso en runtime / matcher (cache friendly). */
export async function listActiveRedirectsForWorkspace(
  workspaceId: string,
): Promise<RedirectRule[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: redirects.id,
      source: redirects.source,
      destination: redirects.destination,
      statusCode: redirects.statusCode,
      matchType: redirects.matchType,
      preserveQuery: redirects.preserveQuery,
      enabled: redirects.enabled,
    })
    .from(redirects)
    .where(and(eq(redirects.workspaceId, workspaceId), eq(redirects.enabled, true)))
    // exact primero (más específico), luego prefix más largos, luego regex
    .orderBy(asc(redirects.matchType), desc(redirects.source));
  return rows;
}

export async function getRedirectById(workspaceId: string, id: string): Promise<Redirect | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(redirects)
    .where(and(eq(redirects.workspaceId, workspaceId), eq(redirects.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createRedirect(input: CreateRedirectInput): Promise<Redirect> {
  if (!db) throw new Error("DB not configured");
  validateRule(input);
  const [row] = await db
    .insert(redirects)
    .values({
      workspaceId: input.workspaceId,
      source: input.source,
      destination: input.destination,
      statusCode: input.statusCode ?? 301,
      matchType: input.matchType ?? "exact",
      preserveQuery: input.preserveQuery ?? true,
      enabled: input.enabled ?? true,
      description: input.description ?? null,
      createdById: input.createdById ?? null,
    } satisfies NewRedirect)
    .returning();
  if (!row) throw new Error("No se pudo crear la redirección");
  return row;
}

export interface UpdateRedirectInput extends Partial<CreateRedirectInput> {
  workspaceId: string;
  id: string;
}

export async function updateRedirect(input: UpdateRedirectInput): Promise<Redirect> {
  if (!db) throw new Error("DB not configured");
  if (input.source && input.destination) {
    validateRule({
      source: input.source,
      destination: input.destination,
      matchType: input.matchType,
      statusCode: input.statusCode,
    });
  }
  const patch: Partial<NewRedirect> & { updatedAt: Date } = { updatedAt: new Date() };
  if (input.source !== undefined) patch.source = input.source;
  if (input.destination !== undefined) patch.destination = input.destination;
  if (input.statusCode !== undefined) patch.statusCode = input.statusCode;
  if (input.matchType !== undefined) patch.matchType = input.matchType;
  if (input.preserveQuery !== undefined) patch.preserveQuery = input.preserveQuery;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.description !== undefined) patch.description = input.description;
  const [row] = await db
    .update(redirects)
    .set(patch)
    .where(and(eq(redirects.workspaceId, input.workspaceId), eq(redirects.id, input.id)))
    .returning();
  if (!row) throw new Error("Redirección no encontrada");
  return row;
}

export async function deleteRedirect(workspaceId: string, id: string): Promise<void> {
  if (!db) return;
  await db
    .delete(redirects)
    .where(and(eq(redirects.workspaceId, workspaceId), eq(redirects.id, id)));
}

export async function bulkDeleteRedirects(workspaceId: string, ids: string[]): Promise<number> {
  if (!db || ids.length === 0) return 0;
  const result = await db
    .delete(redirects)
    .where(and(eq(redirects.workspaceId, workspaceId), inArray(redirects.id, ids)))
    .returning({ id: redirects.id });
  return result.length;
}

export async function bulkSetEnabled(
  workspaceId: string,
  ids: string[],
  enabled: boolean,
): Promise<number> {
  if (!db || ids.length === 0) return 0;
  const result = await db
    .update(redirects)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(redirects.workspaceId, workspaceId), inArray(redirects.id, ids)))
    .returning({ id: redirects.id });
  return result.length;
}

/** Atómico: incrementa hits y actualiza lastHitAt. Idempotente bajo concurrencia. */
export async function incrementHits(workspaceId: string, id: string): Promise<void> {
  if (!db) return;
  await db
    .update(redirects)
    .set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() })
    .where(and(eq(redirects.workspaceId, workspaceId), eq(redirects.id, id)));
}

// ============================================================
// CSV import / export
// ============================================================

export interface CsvRow {
  source: string;
  destination: string;
  statusCode?: number;
  matchType?: MatchType;
  preserveQuery?: boolean;
  enabled?: boolean;
  description?: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: Array<{ line: number; message: string }>;
  total: number;
}

const MAX_CSV_ROWS = 1000;

/**
 * Parser CSV minimalista — soporta comillas dobles "..." y escapes "" para quotes.
 * Headers obligatorios: source,destination. Opcionales: statusCode, matchType,
 * preserveQuery (1/0/true/false), enabled (1/0/true/false), description.
 */
export function parseCsv(input: string): CsvParseResult {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: CsvRow[] = [];
  const lines = splitLines(input.trim());
  if (lines.length === 0)
    return { rows: [], errors: [{ line: 0, message: "CSV vacío" }], total: 0 };
  const header = parseCsvRow(lines[0] ?? "");
  const sourceIdx = header.indexOf("source");
  const destIdx = header.indexOf("destination");
  if (sourceIdx === -1 || destIdx === -1) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Faltan columnas obligatorias: source,destination" }],
      total: 0,
    };
  }
  const statusIdx = header.indexOf("statusCode");
  const matchIdx = header.indexOf("matchType");
  const preserveIdx = header.indexOf("preserveQuery");
  const enabledIdx = header.indexOf("enabled");
  const descIdx = header.indexOf("description");

  for (let i = 1; i < Math.min(lines.length, MAX_CSV_ROWS + 1); i++) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;
    try {
      const cols = parseCsvRow(line);
      const source = (cols[sourceIdx] ?? "").trim();
      const destination = (cols[destIdx] ?? "").trim();
      if (!source || !destination) {
        errors.push({ line: i + 1, message: "source y destination obligatorios" });
        continue;
      }
      const row: CsvRow = { source, destination };
      if (statusIdx !== -1 && cols[statusIdx]) {
        const c = Number(cols[statusIdx]);
        if (VALID_STATUS_CODES.includes(c as 301)) row.statusCode = c;
        else errors.push({ line: i + 1, message: `statusCode inválido: ${cols[statusIdx]}` });
      }
      if (matchIdx !== -1 && cols[matchIdx]) {
        const m = cols[matchIdx]?.trim();
        if (m === "exact" || m === "prefix" || m === "regex") row.matchType = m;
        else errors.push({ line: i + 1, message: `matchType inválido: ${m}` });
      }
      if (preserveIdx !== -1 && cols[preserveIdx]) {
        row.preserveQuery = parseBool(cols[preserveIdx]);
      }
      if (enabledIdx !== -1 && cols[enabledIdx]) {
        row.enabled = parseBool(cols[enabledIdx]);
      }
      if (descIdx !== -1 && cols[descIdx]) row.description = cols[descIdx]?.trim();
      try {
        validateRule(row);
        rows.push(row);
      } catch (e) {
        errors.push({ line: i + 1, message: e instanceof Error ? e.message : "inválido" });
      }
    } catch (e) {
      errors.push({ line: i + 1, message: e instanceof Error ? e.message : "parse error" });
    }
  }
  if (lines.length > MAX_CSV_ROWS + 1) {
    errors.push({
      line: 0,
      message: `CSV truncado a ${MAX_CSV_ROWS} filas (tenía ${lines.length - 1})`,
    });
  }
  return { rows, errors, total: lines.length - 1 };
}

function parseBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function splitLines(input: string): string[] {
  // Respetamos newlines dentro de quoted fields.
  const lines: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      buf += ch;
      if (inQuote && input[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (!inQuote && (ch === "\n" || ch === "\r")) {
      if (buf || lines.length === 0) lines.push(buf);
      buf = "";
      // skip \r\n pair
      if (ch === "\r" && input[i + 1] === "\n") i++;
    } else {
      buf += ch;
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out;
}

/** Bulk insert con fallback row-by-row para no abortar el batch entero. */
export async function bulkInsertRedirects(
  workspaceId: string,
  rows: CsvRow[],
  opts: { skipExisting?: boolean; createdById?: string | null } = {},
): Promise<{
  inserted: number;
  skipped: number;
  errors: Array<{ source: string; message: string }>;
}> {
  if (!db) return { inserted: 0, skipped: 0, errors: [] };
  let inserted = 0;
  let skipped = 0;
  const errors: Array<{ source: string; message: string }> = [];
  const existingSources = opts.skipExisting
    ? new Set(
        (
          await db
            .select({ source: redirects.source })
            .from(redirects)
            .where(eq(redirects.workspaceId, workspaceId))
        ).map((r) => r.source),
      )
    : new Set<string>();
  for (const row of rows) {
    if (opts.skipExisting && existingSources.has(row.source)) {
      skipped++;
      continue;
    }
    try {
      await createRedirect({
        workspaceId,
        source: row.source,
        destination: row.destination,
        statusCode: row.statusCode as 301 | 302 | 307 | 308 | undefined,
        matchType: row.matchType,
        preserveQuery: row.preserveQuery,
        enabled: row.enabled,
        description: row.description,
        createdById: opts.createdById ?? null,
      });
      inserted++;
    } catch (e) {
      errors.push({ source: row.source, message: e instanceof Error ? e.message : "error" });
    }
  }
  return { inserted, skipped, errors };
}

export function redirectsToCsv(rows: Redirect[]): string {
  const header = [
    "source",
    "destination",
    "statusCode",
    "matchType",
    "preserveQuery",
    "enabled",
    "description",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.source),
        csvCell(r.destination),
        String(r.statusCode),
        r.matchType,
        r.preserveQuery ? "true" : "false",
        r.enabled ? "true" : "false",
        csvCell(r.description ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/**
 * Escapa una celda CSV. Si empieza con `= + - @ \t \r`, prefijamos con apóstrofo
 * (`'`) para neutralizar formula injection en Excel/LibreOffice/Sheets cuando el
 * CSV se descarga y abre. El apóstrofo es el escape estándar OWASP CSV.
 */
function csvCell(s: string): string {
  let cell = s;
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}
