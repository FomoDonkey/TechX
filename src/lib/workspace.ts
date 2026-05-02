import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { members, workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Role = "owner" | "admin" | "editor" | "author" | "viewer";

const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  author: 2,
  viewer: 1,
};

export const WS_COOKIE = "csm_ws";

export function can(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export type WorkspaceContext = {
  workspace: typeof workspaces.$inferSelect;
  role: Role;
};

export async function listUserWorkspaces(userId: string) {
  if (!db) return [];
  return db
    .select({
      workspace: workspaces,
      role: members.role,
    })
    .from(members)
    .innerJoin(workspaces, eq(members.workspaceId, workspaces.id))
    .where(eq(members.userId, userId));
}

export async function currentWorkspace(): Promise<WorkspaceContext | null> {
  if (!db) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const list = await listUserWorkspaces(user.id);
  if (list.length === 0) return null;

  const cookieStore = await cookies();
  const wsSlug = cookieStore.get(WS_COOKIE)?.value;
  const found = wsSlug ? list.find((m) => m.workspace.slug === wsSlug) : undefined;
  const picked = found ?? list[0];
  if (!picked) return null;
  return { workspace: picked.workspace, role: picked.role as Role };
}

export async function requireWorkspace(required: Role = "viewer") {
  const ctx = await currentWorkspace();
  if (!ctx) redirect("/onboarding");
  if (!can(ctx.role, required)) redirect("/admin?denied=1");
  return ctx;
}

/**
 * Helper que envuelve queries garantizando filtro por workspace.
 * Uso: `const rows = await withWorkspace(ws, (q) => q.from(entries).where(...))`
 * No es mágico: el dev sigue siendo responsable, pero centraliza el patrón
 * para tests de aislamiento.
 */
export function withWorkspace<T>(ws: { id: string }, fn: (workspaceId: string) => T): T {
  return fn(ws.id);
}

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
    .limit(1);
  return row ?? null;
}
