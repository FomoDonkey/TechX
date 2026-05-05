import { db } from "@/db/client";
import {
  type BranchActivity,
  type BranchActivityType,
  type NewBranchActivity,
  branchActivity,
  users,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function logBranchEvent(input: NewBranchActivity): Promise<void> {
  if (!db) return;
  try {
    await db.insert(branchActivity).values(input);
  } catch (err) {
    console.warn("[branch-activity] log failed", err);
  }
}

export type BranchActivityWithActor = BranchActivity & {
  actor: { id: string; name: string; image: string | null } | null;
};

export async function listBranchActivity(input: {
  workspaceId: string;
  branchId: string;
  limit?: number;
  types?: BranchActivityType[];
}): Promise<BranchActivityWithActor[]> {
  if (!db) return [];
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 200);
  const rows = await db
    .select({
      activity: branchActivity,
      user: { id: users.id, name: users.name, image: users.image },
    })
    .from(branchActivity)
    .leftJoin(users, eq(users.id, branchActivity.actorId))
    .where(
      and(
        eq(branchActivity.workspaceId, input.workspaceId),
        eq(branchActivity.branchId, input.branchId),
      ),
    )
    .orderBy(desc(branchActivity.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r.activity, actor: r.user }));
}
