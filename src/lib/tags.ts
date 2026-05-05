import "server-only";
import { db } from "@/db/client";
import { collections, entries, entryTerms, taxonomies, terms } from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { and, desc, eq, isNull } from "drizzle-orm";

const SLUG_RE = /^[a-z0-9-]+$/;

export function isValidTagSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_RE.test(slug);
}

export type TagPosts = {
  term: { id: string; name: string; slug: string; type: "tag" | "category" };
  posts: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }[];
};

export async function getTagPosts(workspaceId: string, slug: string): Promise<TagPosts | null> {
  if (!db) return null;
  if (!isValidTagSlug(slug)) return null;
  const [match] = await db
    .select({
      id: terms.id,
      name: terms.name,
      slug: terms.slug,
      type: taxonomies.type,
    })
    .from(terms)
    .innerJoin(taxonomies, eq(taxonomies.id, terms.taxonomyId))
    .where(and(eq(taxonomies.workspaceId, workspaceId), eq(terms.slug, slug)))
    .limit(1);
  if (!match) return null;

  const posts = await db
    .select({
      id: entries.id,
      slug: entries.slug,
      title: entries.title,
      excerpt: entries.excerpt,
      publishedAt: entries.publishedAt,
      updatedAt: entries.updatedAt,
    })
    .from(entries)
    .innerJoin(entryTerms, eq(entryTerms.entryId, entries.id))
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.status, "published"),
        eq(collections.slug, POSTS_SLUG),
        eq(entryTerms.termId, match.id),
        // F9b: archivo público por tag no muestra forks.
        isNull(entries.branchId),
      ),
    )
    .orderBy(desc(entries.publishedAt))
    .limit(60);

  return {
    term: {
      id: match.id,
      name: match.name,
      slug: match.slug,
      type: match.type,
    },
    posts,
  };
}
