import JSZip from "jszip";
import { buildSuggestedMapping } from "../mapping";
import type { DescribeResult, FieldSpec, ParseOptions, Parser, RawEntry, RawItem } from "../types";

/**
 * Markdown bundle: o bien un único `.md` o un `.zip` con varios `.md`.
 * Soporta YAML frontmatter (entre `---`) con keys: title, slug, date, draft,
 * status, tags, categories, excerpt, cover. El cuerpo es markdown puro y se
 * mantiene como-is (el render del editor lo procesa).
 *
 * Frontmatter parser propio (mini): no asume tipos exóticos. Soporta:
 *   - strings sueltos
 *   - booleans true/false
 *   - arrays inline `[a, b, c]` o YAML lista con `- item`
 */

const FRONT_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

type FrontMatter = Record<string, string | string[] | boolean | undefined>;

function parseFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const m = FRONT_RE.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const block = m[1];
  const body = m[2];
  if (block === undefined || body === undefined) return { meta: {}, body: raw };
  const meta: FrontMatter = {};
  const lines = block.split(/\r?\n/);
  let lastKey: string | null = null;
  let pendingArr: string[] | null = null;
  for (const line of lines) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const listMatch = /^\s*-\s+(.+)$/.exec(line);
    if (listMatch && pendingArr && lastKey) {
      pendingArr.push(stripQuotes(listMatch[1] ?? ""));
      continue;
    }
    const kv = /^([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const valRaw = (kv[2] ?? "").trim();
    if (!key) continue;
    if (valRaw === "" || valRaw === "[]") {
      meta[key] = [];
      pendingArr = meta[key] as string[];
      lastKey = key;
      continue;
    }
    if (valRaw.startsWith("[") && valRaw.endsWith("]")) {
      const arr = valRaw
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
      meta[key] = arr;
      lastKey = key;
      pendingArr = null;
      continue;
    }
    if (valRaw === "true" || valRaw === "false") {
      meta[key] = valRaw === "true";
      lastKey = key;
      pendingArr = null;
      continue;
    }
    meta[key] = stripQuotes(valRaw);
    lastKey = key;
    pendingArr = null;
  }
  return { meta, body: body.trimStart() };
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/\s*,\s*/).filter(Boolean);
  return [];
}

function parseDateMaybe(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function statusFromMeta(meta: FrontMatter): "draft" | "published" {
  if (meta.draft === true || meta.status === "draft") return "draft";
  if (meta.status === "published") return "published";
  return "published";
}

function fileNameToSlug(name: string): string {
  return name
    .replace(/\.(md|mdx|markdown)$/i, "")
    .replace(/^.*\//, "")
    .replace(/[^a-z0-9-_]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fileToEntry(filename: string, content: string): RawEntry | null {
  const { meta, body } = parseFrontMatter(content);
  const slug = (typeof meta.slug === "string" && meta.slug) || fileNameToSlug(filename);
  if (!slug) return null;
  const title =
    (typeof meta.title === "string" && meta.title) ||
    slug.replace(/-/g, " ").replace(/^./, (s) => s.toUpperCase());
  return {
    kind: "entry",
    sourceId: filename,
    title,
    slug,
    content: body,
    contentFormat: "markdown",
    excerpt: typeof meta.excerpt === "string" ? meta.excerpt : undefined,
    status: statusFromMeta(meta),
    publishedAt: parseDateMaybe(meta.date) ?? parseDateMaybe(meta.publishedAt),
    tags: asStringArray(meta.tags),
    categories: asStringArray(meta.categories),
    coverUrl: typeof meta.cover === "string" ? meta.cover : undefined,
    author: typeof meta.author === "string" ? { name: meta.author } : undefined,
  };
}

/** Caps anti zip-bomb: por archivo, total y nº de entries. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;

async function readMarkdownFiles(
  buf: Buffer,
  fileName?: string,
): Promise<Array<{ name: string; content: string }>> {
  // ZIP detection: signature 0x504b0304
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.entries(zip.files);
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`Zip excede ${MAX_ZIP_ENTRIES} entries — abortado por seguridad`);
    }
    let totalBytes = 0;
    const files: Array<{ name: string; content: string }> = [];
    for (const [name, file] of entries) {
      if (file.dir) continue;
      if (!/\.(md|mdx|markdown)$/i.test(name)) continue;
      const fileSize = (file as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize;
      if (typeof fileSize === "number" && fileSize > MAX_FILE_BYTES) {
        throw new Error(`Archivo ${name} excede ${MAX_FILE_BYTES} bytes descomprimido`);
      }
      totalBytes += fileSize ?? 0;
      if (totalBytes > MAX_TOTAL_UNCOMPRESSED) {
        throw new Error(`Total descomprimido excede ${MAX_TOTAL_UNCOMPRESSED} bytes`);
      }
      const content = await file.async("string");
      files.push({ name, content });
    }
    return files;
  }
  // single file
  return [{ name: fileName ?? "post.md", content: buf.toString("utf8") }];
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const files = await readMarkdownFiles(buf);
  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;
  for (const file of files) {
    if (yielded >= limit) return;
    const entry = fileToEntry(file.name, file.content);
    if (!entry) continue;
    yield entry;
    yielded++;
  }
}

const DETECT_FIELDS: FieldSpec[] = [
  { key: "title", label: "Título (frontmatter)" },
  { key: "slug", label: "Slug (frontmatter o filename)" },
  { key: "body", label: "Cuerpo Markdown" },
  { key: "excerpt", label: "Resumen" },
  { key: "date", label: "Fecha" },
  { key: "tags", label: "Tags" },
  { key: "categories", label: "Categorías" },
  { key: "cover", label: "Cover URL" },
  { key: "author", label: "Autor" },
];

export const markdownParser: Parser = {
  source: "markdown",
  async detect(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".markdown")) return true;
    // No reclamamos .zip aquí — solo si el filename insinúa markdown bundle
    // (e.g., "blog-export.md.zip"). Notion gana antes en el orden de detect
    // para zips genéricos.
    if (/\.md\.zip$/i.test(lower) || /markdown.*\.zip$/i.test(lower)) return true;
    return false;
  },
  parse: iterate,
  async describe(buf) {
    const files = await readMarkdownFiles(buf);
    const sample: Array<Partial<RawEntry>> = [];
    for (const f of files.slice(0, 3)) {
      const entry = fileToEntry(f.name, f.content);
      if (entry) sample.push(entry);
    }
    const keys = DETECT_FIELDS.map((f) => f.key);
    return {
      fields: DETECT_FIELDS,
      suggested: buildSuggestedMapping(keys),
      totalItems: files.length,
      sample,
    };
  },
};
