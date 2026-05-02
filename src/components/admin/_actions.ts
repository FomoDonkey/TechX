"use server";

import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { members, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { WS_COOKIE } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function setWorkspaceCookie(slug: string) {
  if (!db) return { ok: false as const };
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };

  const [row] = await db
    .select({ ws: workspaces })
    .from(members)
    .innerJoin(workspaces, eq(members.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(members.userId, user.id)))
    .limit(1);

  if (!row) return { ok: false as const };

  const c = await cookies();
  c.set(WS_COOKIE, slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  await logActivity({
    workspaceId: row.ws.id,
    actorId: user.id,
    action: "workspace.switched",
    targetType: "workspace",
    targetId: row.ws.id,
  });

  return { ok: true as const };
}
