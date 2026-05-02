import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type AssetUsage = {
  entryId: string;
  title: string;
  slug: string;
  status: string;
};

/**
 * Busca entries cuyo body contenga la URL del media. Implementación naive
 * (cast body a texto + ILIKE). Suficiente para MVP; al escalar mover a un
 * job que mantenga `entry_blocks_index`.
 */
export async function findAssetUsages(
  workspaceId: string,
  url: string,
  limit = 25,
): Promise<AssetUsage[]> {
  if (!db) return [];
  const needle = `%${url.replace(/[%_]/g, "\\$&")}%`;
  const rows = await db
    .select({
      entryId: entries.id,
      title: entries.title,
      slug: entries.slug,
      status: entries.status,
    })
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), sql`${entries.body}::text ILIKE ${needle}`))
    .limit(limit);
  return rows.map((r) => ({ ...r, status: r.status as string }));
}
