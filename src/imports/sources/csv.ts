import Papa from "papaparse";
import { buildSuggestedMapping } from "../mapping";
import type { DescribeResult, FieldSpec, ParseOptions, Parser, RawEntry, RawItem } from "../types";

/**
 * CSV genérico — el más flexible. Cada fila = una entry. Las columnas son
 * detectadas dinámicamente y mostradas en el wizard de mapeo.
 *
 * Soporta tanto export simple (title, body, tags) como exports complejos con
 * campos custom. El usuario decide qué columna mapear a qué.
 */

type Row = Record<string, string>;

function parseCsv(buf: Buffer): { rows: Row[]; fields: string[] } {
  const text = buf.toString("utf8");
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    dynamicTyping: false,
  });
  const fields = result.meta.fields ?? [];
  return { rows: result.data, fields };
}

function rowToEntry(row: Row, idx: number): RawEntry | null {
  // Necesitamos al menos algo identificable como título o slug
  const title =
    row.title || row.Title || row.name || row.Name || row.headline || row.Headline || "";
  if (!title) return null;
  // Sin id/slug usamos `row-N`. Idempotencia inter-lote para CSVs sin id
  // se garantiza en el engine: para CSV el originRef se compone con importId
  // (ver `buildOriginRef` callers).
  const sourceId = row.id || row.ID || row.slug || row.Slug || `row-${idx + 1}`;
  return {
    kind: "entry",
    sourceId: String(sourceId),
    title,
    slug: row.slug || row.Slug || undefined,
    content: row.body || row.content || row.html || row.markdown || "",
    contentFormat: row.html ? "html" : "markdown",
    excerpt: row.excerpt || row.summary || undefined,
    status: row.status === "draft" ? "draft" : "published",
    publishedAt: row.date
      ? new Date(row.date)
      : row.publishedAt
        ? new Date(row.publishedAt)
        : undefined,
    tags: parseList(row.tags),
    categories: parseList(row.categories || row.category),
    coverUrl: row.cover || row.image || undefined,
    author: row.author ? { name: row.author } : undefined,
    fields: { ...row, _rowIndex: idx },
  };
}

function parseList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const { rows } = parseCsv(buf);
  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;
  for (let i = 0; i < rows.length; i++) {
    if (yielded >= limit) return;
    const row = rows[i];
    if (!row) continue;
    const entry = rowToEntry(row, i);
    if (!entry) continue;
    yield entry;
    yielded++;
  }
}

export const csvParser: Parser = {
  source: "csv",
  async detect(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return true;
    if (file.head) {
      const start = file.head.toString("utf8", 0, Math.min(file.head.length, 256));
      const firstLine = start.split(/\r?\n/)[0] ?? "";
      // Heurística: ≥2 comas en la primera línea, sin tags XML al inicio
      return firstLine.split(",").length >= 2 && !firstLine.startsWith("<");
    }
    return false;
  },
  parse: iterate,
  async describe(buf) {
    const { rows, fields } = parseCsv(buf);
    const sample: Array<Partial<RawEntry>> = [];
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;
      const entry = rowToEntry(row, i);
      if (entry) sample.push(entry);
    }
    const fieldSpecs: FieldSpec[] = fields.map((f) => {
      const example = rows[0]?.[f];
      return { key: f, label: f, example: example ? String(example).slice(0, 60) : undefined };
    });
    return {
      fields: fieldSpecs,
      suggested: buildSuggestedMapping(fields),
      totalItems: rows.length,
      sample,
    };
  },
};
