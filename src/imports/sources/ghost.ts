import { buildSuggestedMapping } from "../mapping";
import type {
  DescribeResult,
  FieldSpec,
  ParseOptions,
  Parser,
  RawEntry,
  RawItem,
  RawTerm,
} from "../types";

/**
 * Ghost JSON export: archivo `.json` con shape:
 *   { db: [{ data: { posts: [...], tags: [...], users: [...], posts_tags: [...] } }] }
 *
 * Posts traen `html` y `mobiledoc`; usamos `html` (mobiledoc requiere parser
 * Ghost-específico). Tags se exportan como terms separados.
 */

type GhostPost = {
  id: string;
  uuid?: string;
  title?: string;
  slug?: string;
  html?: string;
  custom_excerpt?: string;
  feature_image?: string;
  status?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  type?: "post" | "page";
  visibility?: string;
  meta_title?: string;
  meta_description?: string;
  author_id?: string;
};

type GhostTag = { id: string; name: string; slug?: string };
type GhostUser = { id: string; name?: string; email?: string };
type GhostPostsTags = { post_id: string; tag_id: string };

type GhostBundle = {
  db?: Array<{
    data?: {
      posts?: GhostPost[];
      tags?: GhostTag[];
      users?: GhostUser[];
      posts_tags?: GhostPostsTags[];
    };
  }>;
};

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function statusFromGhost(s: string | undefined): "draft" | "published" {
  return s === "published" ? "published" : "draft";
}

function loadBundle(buf: Buffer): GhostBundle {
  const json = JSON.parse(buf.toString("utf8"));
  return json as GhostBundle;
}

function* iterateBundle(bundle: GhostBundle, opts?: ParseOptions): Iterable<RawItem> {
  const data = bundle.db?.[0]?.data;
  if (!data) return;
  const posts = data.posts ?? [];
  const tags = data.tags ?? [];
  const users = data.users ?? [];
  const postsTags = data.posts_tags ?? [];

  const userById = new Map(users.map((u) => [u.id, u]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const postTagsBy = new Map<string, string[]>();
  for (const link of postsTags) {
    const tag = tagById.get(link.tag_id);
    if (!tag) continue;
    const arr = postTagsBy.get(link.post_id) ?? [];
    arr.push(tag.name);
    postTagsBy.set(link.post_id, arr);
  }

  // Yield tags as terms first (engine puede pre-crearlos)
  for (const t of tags) {
    yield {
      kind: "term",
      sourceId: `ghost-tag-${t.id}`,
      name: t.name,
      slug: t.slug,
      taxonomy: "tag",
    } satisfies RawTerm;
  }

  let yielded = 0;
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY;
  for (const p of posts) {
    if (yielded >= limit) return;
    if (!p.title || !p.slug) continue;
    const author = p.author_id ? userById.get(p.author_id) : undefined;
    const date = parseDate(p.published_at) ?? parseDate(p.created_at);
    const entry: RawEntry = {
      kind: "entry",
      sourceId: `ghost-post-${p.id}`,
      title: p.title,
      slug: p.slug,
      content: p.html ?? "",
      contentFormat: "html",
      excerpt: p.custom_excerpt || p.meta_description || undefined,
      status: statusFromGhost(p.status),
      publishedAt: date,
      author: author ? { name: author.name, email: author.email } : undefined,
      tags: postTagsBy.get(p.id) ?? [],
      coverUrl: p.feature_image || undefined,
      fields: {
        ghostType: p.type ?? "post",
        ghostVisibility: p.visibility,
        seoTitle: p.meta_title,
      },
    };
    yield entry;
    yielded++;
  }
}

async function* iterate(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem> {
  const bundle = loadBundle(buf);
  for (const item of iterateBundle(bundle, opts)) yield item;
}

const DETECT_FIELDS: FieldSpec[] = [
  { key: "title", label: "Título" },
  { key: "slug", label: "Slug" },
  { key: "html", label: "Contenido (HTML)" },
  { key: "custom_excerpt", label: "Resumen" },
  { key: "published_at", label: "Fecha publicación" },
  { key: "status", label: "Estado" },
  { key: "feature_image", label: "Cover" },
  { key: "tags", label: "Tags" },
  { key: "author", label: "Autor" },
];

export const ghostParser: Parser = {
  source: "ghost",
  async detect(file) {
    if (!file.name.toLowerCase().endsWith(".json")) return false;
    if (!file.head) return false;
    const start = file.head.toString("utf8", 0, Math.min(file.head.length, 1024));
    return /"db"\s*:/.test(start) || /"posts"\s*:/.test(start);
  },
  parse: iterate,
  async describe(buf) {
    const bundle = loadBundle(buf);
    const posts = bundle.db?.[0]?.data?.posts ?? [];
    const sample: Array<Partial<RawEntry>> = [];
    let count = 0;
    for (const item of iterateBundle(bundle)) {
      if (item.kind !== "entry") continue;
      if (count < 3) sample.push(item);
      count++;
    }
    const keys = DETECT_FIELDS.map((f) => f.key);
    return {
      fields: DETECT_FIELDS,
      suggested: buildSuggestedMapping(keys),
      totalItems: posts.length,
      sample,
    };
  },
};
