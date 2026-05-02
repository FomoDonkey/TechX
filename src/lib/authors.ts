import "server-only";
import { db } from "@/db/client";
import { type User, collections, entries, members, users } from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { and, desc, eq } from "drizzle-orm";

const HANDLE_RE = /^[a-z0-9_-]+$/;

export function isValidHandle(handle: string): boolean {
  return handle.length > 0 && handle.length <= 60 && HANDLE_RE.test(handle);
}

export type AuthorPosts = {
  author: Pick<User, "id" | "name" | "image" | "bio" | "website" | "twitter" | "handle">;
  posts: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }[];
};

export async function getAuthorByHandle(
  workspaceId: string,
  handle: string,
): Promise<AuthorPosts | null> {
  if (!db) return null;
  if (!isValidHandle(handle)) return null;
  // Multi-tenant isolation: solo autores que sean MIEMBROS de este workspace.
  // Sin este join, /autor/{handle} en el dominio del workspace B mostraría el
  // perfil (bio, avatar, redes sociales) de un user que pertenece a workspace A.
  const [author] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      bio: users.bio,
      website: users.website,
      twitter: users.twitter,
      handle: users.handle,
    })
    .from(users)
    .innerJoin(members, eq(members.userId, users.id))
    .where(and(eq(users.handle, handle), eq(members.workspaceId, workspaceId)))
    .limit(1);
  if (!author) return null;
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
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(collections.slug, POSTS_SLUG),
        eq(entries.status, "published"),
        eq(entries.authorId, author.id),
      ),
    )
    .orderBy(desc(entries.publishedAt))
    .limit(60);
  return { author, posts };
}
