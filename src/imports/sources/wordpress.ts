import { XMLParser } from "fast-xml-parser";
import { buildSuggestedMapping } from "../mapping";
import type { DescribeResult, FieldSpec, ParseOptions, Parser, RawEntry, RawItem } from "../types";

/**
 * WordPress eXtended RSS (WXR) — el formato del export de WP. El root es
 * <rss><channel><item>* donde cada <item> con post_type=post|page representa
 * una entry. Categorías y tags vienen como <category domain="..."> dentro del
 * mismo item. Comentarios como <wp:comment> hijos.
 *
 * No usamos streaming aquí (fast-xml-parser construye árbol). Para WP exports
 * <50MB es aceptable. Para sites grandes, el wizard avisa al subir.
 */

type WpItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  "dc:creator"?: string;
  "content:encoded"?: string;
  "excerpt:encoded"?: string;
  "wp:post_id"?: string | number;
  "wp:post_name"?: string;
  "wp:post_type"?: string;
  "wp:status"?: string;
  "wp:post_date"?: string;
  "wp:post_date_gmt"?: string;
  category?: WpCategory | WpCategory[];
  "wp:comment"?: WpComment | WpComment[];
};

type WpCategory = {
  "#text"?: string;
  "@_domain"?: string;
  "@_nicename"?: string;
};

type WpComment = {
  "wp:comment_id"?: string | number;
  "wp:comment_author"?: string;
  "wp:comment_author_email"?: string;
  "wp:comment_content"?: string;
  "wp:comment_date_gmt"?: string;
  "wp:comment_approved"?: string;
};

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function pickStatus(s: string | undefined): "draft" | "published" {
  if (s === "publish" || s === "published") return "published";
  return "draft";
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseXml(buf: Buffer): { rss?: { channel?: { item?: WpItem | WpItem[] } } } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    cdataPropName: false,
    htmlEntities: true,
  });
  return parser.parse(buf.toString("utf8")) as never;
}

function itemToEntry(item: WpItem): RawEntry | null {
  const postType = item["wp:post_type"];
  if (postType !== "post" && postType !== "page") return null;
  const sourceId = String(item["wp:post_id"] ?? item.link ?? "");
  if (!sourceId) return null;

  const cats = asArray(item.category);
  const tags: string[] = [];
  const categories: string[] = [];
  for (const c of cats) {
    const name = c["#text"] ?? c["@_nicename"];
    if (!name) continue;
    if (c["@_domain"] === "post_tag") tags.push(name);
    else if (c["@_domain"] === "category") categories.push(name);
  }

  const date =
    parseDate(item["wp:post_date_gmt"]) ??
    parseDate(item["wp:post_date"]) ??
    parseDate(item.pubDate);

  return {
    kind: "entry",
    sourceId,
    sourceUrl: item.link,
    title: (item.title ?? "Sin título").toString(),
    slug: item["wp:post_name"]?.toString().trim() || undefined,
    content: item["content:encoded"]?.toString() ?? "",
    contentFormat: "html",
    excerpt: item["excerpt:encoded"]?.toString() || undefined,
    status: pickStatus(item["wp:status"]),
    publishedAt: date,
    author: item["dc:creator"] ? { name: String(item["dc:creator"]) } : undefined,
    tags,
    categories,
    fields: { wpPostType: postType },
  };
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const tree = parseXml(buf);
  const items = asArray(tree.rss?.channel?.item);
  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;

  for (const item of items) {
    if (yielded >= limit) return;
    const entry = itemToEntry(item);
    if (!entry) continue;
    yield entry;
    yielded++;

    // Comentarios (skip en dryRun para acelerar preview)
    if (!opts?.dryRun) {
      const comments = asArray(item["wp:comment"]);
      for (const c of comments) {
        if (c["wp:comment_approved"] !== "1" && c["wp:comment_approved"] !== "approved") continue;
        const cId = String(c["wp:comment_id"] ?? "");
        if (!cId) continue;
        yield {
          kind: "comment",
          sourceId: cId,
          entrySourceId: entry.sourceId,
          author: String(c["wp:comment_author"] ?? "Anónimo"),
          email: c["wp:comment_author_email"]?.toString() || undefined,
          body: String(c["wp:comment_content"] ?? ""),
          createdAt: parseDate(c["wp:comment_date_gmt"]?.toString()),
          status: "approved",
        };
      }
    }
  }
}

const DETECT_FIELDS: FieldSpec[] = [
  { key: "title", label: "Título", example: "Mi primer post" },
  { key: "slug", label: "Slug (post_name)", example: "mi-primer-post" },
  { key: "content_html", label: "Contenido (HTML)" },
  { key: "excerpt", label: "Resumen" },
  { key: "publishedAt", label: "Fecha publicación" },
  { key: "status", label: "Estado" },
  { key: "tags", label: "Etiquetas" },
  { key: "categories", label: "Categorías" },
  { key: "author", label: "Autor (dc:creator)" },
];

export const wordpressParser: Parser = {
  source: "wordpress",
  async detect(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xml") || lower.endsWith(".wxr")) return true;
    if (file.head) {
      const start = file.head.toString("utf8", 0, Math.min(file.head.length, 2048));
      return /<\?xml/.test(start) && /<rss[^>]*>|wp:wxr_version/i.test(start);
    }
    return false;
  },
  parse: iterate,
  async describe(buf) {
    const tree = parseXml(buf);
    const items = asArray(tree.rss?.channel?.item).filter(
      (i) => i["wp:post_type"] === "post" || i["wp:post_type"] === "page",
    );
    const sample: Array<Partial<RawEntry>> = [];
    for (const item of items.slice(0, 3)) {
      const entry = itemToEntry(item);
      if (entry) sample.push(entry);
    }
    const keys = DETECT_FIELDS.map((f) => f.key);
    return {
      fields: DETECT_FIELDS,
      suggested: buildSuggestedMapping(keys),
      totalItems: items.length,
      sample,
    };
  },
};
