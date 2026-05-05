/**
 * Detección server-side del modo Live-Edit (F8c).
 *
 * Devuelve { active: true, ... } sólo si:
 *  - searchParam `edit=1` está presente.
 *  - Hay sesión Better-Auth válida.
 *  - El usuario es member del workspace dueño de la página con rol >= editor.
 *
 * Cualquier fallo silencioso → no activamos edit (degrada a render normal).
 */

import "server-only";
import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { members } from "@/db/schema";
import { type Role, can } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";

export type LiveEditState = { active: false } | { active: true; userId: string; role: Role };

export async function getLiveEditState(
  workspaceId: string | null | undefined,
  searchParams: { edit?: string | string[] | undefined } | URLSearchParams,
): Promise<LiveEditState> {
  if (!workspaceId || !db) return { active: false };

  const editParam =
    typeof (searchParams as URLSearchParams).get === "function"
      ? (searchParams as URLSearchParams).get("edit")
      : Array.isArray((searchParams as { edit?: string | string[] }).edit)
        ? (searchParams as { edit: string[] }).edit[0]
        : ((searchParams as { edit?: string }).edit ?? null);
  if (editParam !== "1") return { active: false };

  const user = await getCurrentUser();
  if (!user) return { active: false };

  const [row] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, user.id)))
    .limit(1);
  if (!row) return { active: false };
  const role = row.role as Role;
  if (!can(role, "editor")) return { active: false };

  return { active: true, userId: user.id, role };
}
