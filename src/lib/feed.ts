import "server-only";
import { db } from "@/db/client";
import { collections, entries, users, workspaces } from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { and, desc, eq, isNull } from "drizzle-orm";

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: Date;
  updatedAt: Date;
  authorName: string | null;
}

export interface FeedPayload {
  title: string;
  description: string;
  baseUrl: string;
  feedUrl: string;
  language: string;
  items: FeedItem[];
  updated: Date;
}

export async function buildFeedPayload(
  baseUrl: string,
  format: "rss" | "atom" | "json",
): Promise<FeedPayload | null> {
  if (!db) return null;
  try {
    // TODO(custom-domains): resolver workspace por Host cuando lleguen los
    // dominios personalizados. Hoy igual que getDefaultPublicWorkspace().
    const ws = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
    const workspace = ws[0];
    if (!workspace) return null;

    const rows = await db
      .select({
        id: entries.id,
        slug: entries.slug,
        title: entries.title,
        excerpt: entries.excerpt,
        publishedAt: entries.publishedAt,
        updatedAt: entries.updatedAt,
        authorName: users.name,
      })
      .from(entries)
      .innerJoin(collections, eq(collections.id, entries.collectionId))
      .leftJoin(users, eq(users.id, entries.authorId))
      .where(
        and(
          eq(entries.workspaceId, workspace.id),
          eq(collections.slug, POSTS_SLUG),
          eq(entries.status, "published"),
          // F9b: feeds públicos no incluyen forks de branches.
          isNull(entries.branchId),
        ),
      )
      .orderBy(desc(entries.publishedAt))
      .limit(50);

    const base = baseUrl.replace(/\/$/, "");
    const items: FeedItem[] = rows.map((r) => ({
      id: `${base}/blog/${r.slug}`,
      title: r.title,
      url: `${base}/blog/${r.slug}`,
      excerpt: r.excerpt ?? "",
      publishedAt: r.publishedAt ?? r.updatedAt,
      updatedAt: r.updatedAt,
      authorName: r.authorName ?? null,
    }));

    const ext = format === "rss" ? "xml" : format === "atom" ? "atom" : "json";
    const updated = items[0]?.updatedAt ?? new Date();

    return {
      title: workspace.name,
      description: `Últimas publicaciones de ${workspace.name}`,
      baseUrl: base,
      feedUrl: `${base}/feed.${ext}`,
      language: workspace.defaultLocale ?? "es",
      items,
      updated,
    };
  } catch {
    return null;
  }
}

// XML 1.0 declara como ilegales los control chars 0x00-0x08, 0x0B, 0x0C y
// 0x0E-0x1F. Si un título o excerpt los contiene (p.ej. NULL en strings copiados
// de PDFs), el feed entero queda inválido. Los strippeamos antes de escapar.
// biome-ignore lint/suspicious/noControlCharactersInRegex: control char strip is the goal
const ILLEGAL_XML_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

export function escapeXml(s: string): string {
  return s
    .replace(ILLEGAL_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeCdata(s: string): string {
  return s.replace(ILLEGAL_XML_CHARS, "").replace(/]]>/g, "]]]]><![CDATA[>");
}
