import { db } from "@/db/client";
import { activityLog } from "@/db/schema";

export type ActivityInput = {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function logActivity(input: ActivityInput): Promise<void> {
  if (!db) return;
  try {
    await db.insert(activityLog).values({
      workspaceId: input.workspaceId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      meta: (input.meta ?? null) as never,
    });
  } catch (err) {
    console.warn("[activity] log failed", err);
  }
}
