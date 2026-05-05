import { db } from "@/db/client";
import { apiKeys, members, users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * Resuelve un user_id que actuará como autor en operaciones MCP que requieren
 * actor (createEntry, logActivity). Política:
 *
 * 1. `apiKeys.createdById` (creador de la key) si existe.
 * 2. Owner más antiguo del workspace.
 * 3. Cualquier admin.
 *
 * Lanza si no encuentra ninguno (workspace mal aprovisionado).
 */
export async function resolveMcpActor(args: {
  apiKeyId: string;
  workspaceId: string;
  /** Override directo (caso agente in-product con cookie real de user). */
  directActorId?: string;
}): Promise<{ id: string; email: string; name: string }> {
  if (!db) throw new Error("db_unavailable");

  if (args.directActorId) {
    const [u] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, args.directActorId))
      .limit(1);
    if (u) return u;
    // si el id no existe (edge case), cae al fallback normal.
  }

  const [keyRow] = await db
    .select({ createdById: apiKeys.createdById })
    .from(apiKeys)
    .where(eq(apiKeys.id, args.apiKeyId))
    .limit(1);

  if (keyRow?.createdById) {
    const [u] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, keyRow.createdById))
      .limit(1);
    if (u) return u;
  }

  // Fallback: primer owner del workspace (orden estable por createdAt).
  const owners = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.workspaceId, args.workspaceId), eq(members.role, "owner")))
    .orderBy(asc(members.createdAt))
    .limit(1);
  if (owners[0]) return owners[0];

  // Último recurso: cualquier admin.
  const admins = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.workspaceId, args.workspaceId), eq(members.role, "admin")))
    .orderBy(asc(members.createdAt))
    .limit(1);
  if (admins[0]) return admins[0];

  throw new Error("no_actor_resolvable");
}
