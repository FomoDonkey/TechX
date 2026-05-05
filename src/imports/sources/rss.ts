import { XMLParser } from "fast-xml-parser";
import { buildSuggestedMapping } from "../mapping";
import type { DescribeResult, FieldSpec, ParseOptions, Parser, RawEntry, RawItem } from "../types";

/**
 * RSS 2.0 / Atom 1.0 — feed genérico. Cada <item> (RSS) o <entry> (Atom) se
 * convierte en una RawEntry. Útil para importar de blogs sin export oficial.
 *
 * No baja el contenido completo (los feeds suelen llevar excerpt en
 * <description>); si trae `<content:encoded>` (RSS) o `<content>` (Atom) lo
 * usa como body.
 */

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  guid?: string | { "#text"?: string };
  "dc:creator"?: string;
  category?: string | string[];
  "content:encoded"?: string;
};

type AtomLink = { "@_href"?: string; "@_rel"?: string };
type AtomAuthor = { name?: string; email?: string };
type AtomEntry = {
  title?: string | { "#text"?: string };
  link?: AtomLink | AtomLink[];
  id?: string;
  published?: string;
  updated?: string;
  summary?: string | { "#text"?: string };
  content?: string | { "#text"?: string };
  author?: AtomAuthor | AtomAuthor[];
  category?: { "@_term"?: string } | Array<{ "@_term"?: string }>;
};

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in v)
    return String((v as { "#text": unknown })["#text"] ?? "");
  return "";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseFeed(buf: Buffer): {
  type: "rss" | "atom";
  items: RssItem[] | AtomEntry[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    htmlEntities: true,
  });
  const tree = parser.parse(buf.toString("utf8")) as Record<string, unknown>;
  if (tree.rss) {
    const channel = (tree.rss as { channel?: { item?: RssItem | RssItem[] } }).channel;
    return { type: "rss", items: asArray(channel?.item) };
  }
  if (tree.feed) {
    const entries = (tree.feed as { entry?: AtomEntry | AtomEntry[] }).entry;
    return { type: "atom", items: asArray(entries) };
  }
  return { type: "rss", items: [] };
}

function rssItemToEntry(item: RssItem): RawEntry | null {
  const title = item.title?.toString();
  if (!title) return null;
  const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"];
  const sourceId = String(guid ?? item.link ?? title);
  const cats = typeof item.category === "string" ? [item.category] : (item.category ?? []);
  return {
    kind: "entry",
    sourceId,
    sourceUrl: item.link,
    title,
    slug: item.link ? slugify(item.link.split("/").filter(Boolean).pop() ?? title) : slugify(title),
    content: item["content:encoded"]?.toString() ?? item.description?.toString() ?? "",
    contentFormat: "html",
    excerpt: item.description?.toString() || undefined,
    status: "published",
    publishedAt: parseDate(item.pubDate),
    author: item["dc:creator"] ? { name: String(item["dc:creator"]) } : undefined,
    categories: cats.map(String),
  };
}

function atomEntryToEntry(entry: AtomEntry): RawEntry | null {
  const title = textOf(entry.title);
  if (!title) return null;
  const sourceId = String(entry.id ?? title);
  const linkArr = asArray(entry.link);
  const link = linkArr.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"];
  const cats = asArray(entry.category)
    .map((c) => c["@_term"])
    .filter((c): c is string => typeof c === "string");
  const author = asArray(entry.author)[0];
  return {
    kind: "entry",
    sourceId,
    sourceUrl: link,
    title,
    slug: link ? slugify(link.split("/").filter(Boolean).pop() ?? title) : slugify(title),
    content: textOf(entry.content) || textOf(entry.summary),
    contentFormat: "html",
    excerpt: textOf(entry.summary) || undefined,
    status: "published",
    publishedAt: parseDate(entry.published) ?? parseDate(entry.updated),
    author: author?.name ? { name: author.name, email: author.email } : undefined,
    categories: cats,
  };
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const feed = parseFeed(buf);
  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;
  for (const item of feed.items) {
    if (yielded >= limit) return;
    const entry =
      feed.type === "rss" ? rssItemToEntry(item as RssItem) : atomEntryToEntry(item as AtomEntry);
    if (!entry) continue;
    yield entry;
    yielded++;
  }
}

const DETECT_FIELDS: FieldSpec[] = [
  { key: "title", label: "Título" },
  { key: "link", label: "Link" },
  { key: "content_html", label: "Contenido" },
  { key: "description", label: "Descripción/Excerpt" },
  { key: "pubDate", label: "Fecha" },
  { key: "category", label: "Categorías" },
  { key: "author", label: "Autor" },
];

export const rssParser: Parser = {
  source: "rss",
  async detect(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".rss") || lower.endsWith(".atom") || lower.endsWith(".xml")) {
      if (file.head) {
        const start = file.head.toString("utf8", 0, Math.min(file.head.length, 1024));
        return /<rss[^>]*>|<feed[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(start);
      }
      return true;
    }
    return false;
  },
  parse: iterate,
  async describe(buf) {
    const feed = parseFeed(buf);
    const sample: Array<Partial<RawEntry>> = [];
    for (const item of feed.items.slice(0, 3)) {
      const entry =
        feed.type === "rss" ? rssItemToEntry(item as RssItem) : atomEntryToEntry(item as AtomEntry);
      if (entry) sample.push(entry);
    }
    const keys = DETECT_FIELDS.map((f) => f.key);
    return {
      fields: DETECT_FIELDS,
      suggested: buildSuggestedMapping(keys),
      totalItems: feed.items.length,
      sample,
    };
  },
};
