import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { invitations, members, users, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { WS_COOKIE } from "@/lib/workspace";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!db) return Response.json({ error: "DB no configurada" }, { status: 503 });

  const [row] = await db
    .select({
      invitation: invitations,
      workspace: workspaces,
      inviter: users,
    })
    .from(invitations)
    .innerJoin(workspaces, eq(invitations.workspaceId, workspaces.id))
    .leftJoin(users, eq(invitations.invitedBy, users.id))
    .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)))
    .limit(1);

  if (!row) return Response.json({ error: "Invitación no encontrada o ya usada" }, { status: 404 });
  if (row.invitation.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "La invitación ha caducado" }, { status: 410 });
  }

  return Response.json({
    invitation: {
      email: row.invitation.email,
      role: row.invitation.role,
      expiresAt: row.invitation.expiresAt,
    },
    workspace: { name: row.workspace.name, slug: row.workspace.slug },
    inviter: row.inviter ? { name: row.inviter.name, image: row.inviter.image } : null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!db) return Response.json({ error: "DB no configurada" }, { status: 503 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Necesitas iniciar sesión" }, { status: 401 });

  const [row] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)))
    .limit(1);

  if (!row) return Response.json({ error: "Invitación no válida" }, { status: 404 });
  if (row.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "Caducada" }, { status: 410 });
  }
  if (row.email.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json(
      {
        error: "Esta invitación es para otro email",
        hint: `La invitación se envió a ${row.email}. Inicia sesión con esa cuenta para aceptarla.`,
      },
      { status: 403 },
    );
  }

  const [ws] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, row.workspaceId))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .insert(members)
      .values({
        workspaceId: row.workspaceId,
        userId: user.id,
        role: row.role,
        invitedBy: row.invitedBy,
      })
      .onConflictDoNothing();

    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, row.id));
  });

  if (ws?.slug) {
    const c = await cookies();
    c.set(WS_COOKIE, ws.slug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  await logActivity({
    workspaceId: row.workspaceId,
    actorId: user.id,
    action: "member.joined",
    targetType: "user",
    targetId: user.id,
    meta: { invitedBy: row.invitedBy, role: row.role },
  });

  return Response.json({ ok: true, workspaceId: row.workspaceId });
}
