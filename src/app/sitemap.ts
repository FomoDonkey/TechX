import { db } from "@/db/client";
import {
  collections,
  entries,
  members,
  pages,
  taxonomies,
  terms,
  users,
  workspaces,
} from "@/db/schema";
import { env } from "@/env";
import { POSTS_SLUG } from "@/lib/entries";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { MetadataRoute } from "next";

export const revalidate = 3600;

/**
 * Sitemap XML generado dinámicamente. Incluye:
 *   - home (`/`)
 *   - todas las pages publicadas con isHome=false
 *   - todos los posts publicados (`/blog/[slug]`)
 *   - autores con handle Y membresía en este workspace
 *   - tags y categorías (`/tag/[slug]`)
 * Caché 1h. Si la DB no responde, devuelve un sitemap mínimo con la home.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const homeEntry: MetadataRoute.Sitemap[number] = {
    url: `${base}/`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  };
  if (!db) return [homeEntry, { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 }];

  try {
    // TODO(custom-domains): resolver por host cuando aterrice multi-tenant routing.
    const ws = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
    const workspace = ws[0];
    if (!workspace) return [homeEntry];

    const [pageRows, postRows, authorRows, tagRows] = await Promise.all([
      db
        .select({ path: pages.path, updatedAt: pages.updatedAt, isHome: pages.isHome })
        .from(pages)
        .where(and(eq(pages.workspaceId, workspace.id), eq(pages.status, "published")))
        .limit(5000),
      db
        .select({ slug: entries.slug, updatedAt: entries.updatedAt })
        .from(entries)
        .innerJoin(collections, eq(collections.id, entries.collectionId))
        .where(
          and(
            eq(entries.workspaceId, workspace.id),
            eq(collections.slug, POSTS_SLUG),
            eq(entries.status, "published"),
          ),
        )
        .orderBy(desc(entries.publishedAt))
        .limit(5000),
      // Solo autores que sean miembros de ESTE workspace — sin el join se filtraban
      // perfiles globales con handle aunque no perteneciesen al tenant.
      db
        .select({ handle: users.handle, updatedAt: users.updatedAt })
        .from(users)
        .innerJoin(members, eq(members.userId, users.id))
        .where(and(isNotNull(users.handle), eq(members.workspaceId, workspace.id)))
        .limit(5000),
      db
        .select({ slug: terms.slug })
        .from(terms)
        .innerJoin(taxonomies, eq(taxonomies.id, terms.taxonomyId))
        .where(eq(taxonomies.workspaceId, workspace.id))
        .limit(5000),
    ]);

    const items: MetadataRoute.Sitemap = [
      homeEntry,
      { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8, lastModified: new Date() },
    ];
    for (const p of pageRows) {
      if (p.isHome) continue;
      items.push({
        url: `${base}${p.path}`,
        lastModified: p.updatedAt ?? new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const post of postRows) {
      items.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.updatedAt ?? new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
    for (const a of authorRows) {
      if (!a.handle) continue;
      items.push({
        url: `${base}/autor/${a.handle}`,
        lastModified: a.updatedAt ?? new Date(),
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
    const seenTags = new Set<string>();
    for (const t of tagRows) {
      if (!t.slug || seenTags.has(t.slug)) continue;
      seenTags.add(t.slug);
      items.push({
        url: `${base}/tag/${t.slug}`,
        changeFrequency: "weekly",
        priority: 0.3,
      });
    }
    return items;
  } catch {
    return [homeEntry];
  }
}
