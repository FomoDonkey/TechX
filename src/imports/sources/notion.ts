import JSZip from "jszip";
import { buildSuggestedMapping } from "../mapping";
import type { DescribeResult, FieldSpec, ParseOptions, Parser, RawEntry, RawItem } from "../types";

/**
 * Notion export ZIP: Notion exporta como zip de Markdown + assets. Cada
 * `.md` lleva un encabezado típico:
 *
 *   # Título
 *
 *   Created: November 02, 2024 12:00 PM
 *   Tags: Foo, Bar
 *
 *   --- (opcional)
 *
 *   contenido…
 *
 * No hay frontmatter YAML estándar; los metadatos vienen como pares
 * `Key: value` debajo del H1. Este parser intenta extraerlos. Si el zip incluye
 * subcarpetas con assets (imágenes), los anota en `fields.notionAssets` para
 * que el engine las suba si mediaPolicy=download.
 */

type NotionMeta = { title: string; props: Record<string, string>; body: string };

const META_RE = /^([A-Za-z][A-Za-z0-9 _-]{0,30}):\s*(.+)$/;

function extractMeta(raw: string, fallbackTitle: string): NotionMeta {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let title = fallbackTitle;
  const props: Record<string, string> = {};
  let bodyStart = 0;

  // 1. H1 al inicio
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.trim() === "") continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      bodyStart = i + 1;
      break;
    }
    break;
  }

  // 2. Pares Key: Value durante las próximas N líneas
  let i = bodyStart;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      bodyStart = i;
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const m = META_RE.exec(line.trim());
    if (m?.[1] && m[2]) {
      props[m[1].toLowerCase()] = m[2].trim();
      i++;
      bodyStart = i;
    } else {
      break;
    }
  }

  return {
    title,
    props,
    body: lines.slice(bodyStart).join("\n").trim(),
  };
}

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseTags(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function deriveSlug(filename: string, title: string): string {
  // Notion incluye un id hex al final: "Mi pagina abc123def456789..."
  const base = filename.replace(/\.md$/i, "").replace(/^.*\//, "");
  const cleaned = base.replace(/\s+[a-f0-9]{32}$/i, "").trim();
  const seed = cleaned || title;
  return seed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Cap absoluto de tamaño descomprimido por archivo (50MB). */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Cap absoluto del nº de entries del zip (anti-bomba). */
const MAX_ZIP_ENTRIES = 5000;
/** Cap absoluto del tamaño descomprimido total. */
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;

async function readNotion(
  buf: Buffer,
): Promise<Array<{ name: string; content: string; assets: string[] }>> {
  const zip = await JSZip.loadAsync(buf);
  const out: Array<{ name: string; content: string; assets: string[] }> = [];
  const allFiles = Object.entries(zip.files);
  if (allFiles.length > MAX_ZIP_ENTRIES) {
    throw new Error(`Zip excede ${MAX_ZIP_ENTRIES} entries — abortado por seguridad`);
  }
  let totalBytes = 0;
  for (const [name, file] of allFiles) {
    if (file.dir) continue;
    if (!/\.md$/i.test(name)) continue;
    // JSZip expone _data.uncompressedSize en archivos cargados.
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
    const baseDir = name.replace(/\.md$/i, "");
    const assets = allFiles
      .filter(
        ([n, f]) =>
          !f.dir && n.startsWith(`${baseDir}/`) && /\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(n),
      )
      .map(([n]) => n);
    out.push({ name, content, assets });
  }
  return out;
}

function fileToEntry(filename: string, content: string, assets: string[]): RawEntry | null {
  const fallbackTitle = filename
    .replace(/\.md$/i, "")
    .replace(/^.*\//, "")
    .replace(/\s+[a-f0-9]{32}$/i, "");
  const { title, props, body } = extractMeta(content, fallbackTitle);
  if (!title) return null;
  const slug = deriveSlug(filename, title);
  return {
    kind: "entry",
    sourceId: filename,
    title,
    slug,
    content: body,
    contentFormat: "markdown",
    excerpt: props.summary || props.description,
    status: props.status?.toLowerCase() === "draft" ? "draft" : "published",
    publishedAt:
      parseDate(props.created) ?? parseDate(props.date) ?? parseDate(props["publish date"]),
    tags: parseTags(props.tags),
    categories: parseTags(props.category ?? props.categories),
    author: props.author ? { name: props.author } : undefined,
    fields: { notionAssets: assets, notionProps: props },
  };
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const files = await readNotion(buf);
  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;
  for (const f of files) {
    if (yielded >= limit) return;
    const entry = fileToEntry(f.name, f.content, f.assets);
    if (!entry) continue;
    yield entry;
    yielded++;
  }
}

const DETECT_FIELDS: FieldSpec[] = [
  { key: "title", label: "Título (H1)" },
  { key: "slug", label: "Slug (filename)" },
  { key: "body", label: "Cuerpo Markdown" },
  { key: "Created", label: "Fecha (Created)" },
  { key: "Tags", label: "Tags" },
  { key: "Status", label: "Status" },
  { key: "Author", label: "Autor" },
];

export const notionParser: Parser = {
  source: "notion",
  async detect(file) {
    if (!file.name.toLowerCase().endsWith(".zip")) return false;
    if (!file.head) return false;
    // Signature ZIP
    return file.head[0] === 0x50 && file.head[1] === 0x4b;
  },
  parse: iterate,
  async describe(buf) {
    const files = await readNotion(buf);
    const sample: Array<Partial<RawEntry>> = [];
    for (const f of files.slice(0, 3)) {
      const entry = fileToEntry(f.name, f.content, f.assets);
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
