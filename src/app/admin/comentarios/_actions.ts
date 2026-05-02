"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { deleteComments, setStatus } from "@/lib/comments";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function approveCommentsAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const n = await setStatus({ workspaceId: ctx.workspace.id, ids: input.ids, status: "approved" });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "comments.approved",
    targetType: "comment",
    meta: { count: n },
  });
  revalidatePath("/admin/comentarios");
  revalidatePath("/blog");
  return { ok: true as const, count: n };
}

export async function spamCommentsAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const n = await setStatus({ workspaceId: ctx.workspace.id, ids: input.ids, status: "spam" });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "comments.spam",
    targetType: "comment",
    meta: { count: n },
  });
  revalidatePath("/admin/comentarios");
  return { ok: true as const, count: n };
}

export async function unapproveCommentsAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const n = await setStatus({ workspaceId: ctx.workspace.id, ids: input.ids, status: "pending" });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "comments.unapproved",
    targetType: "comment",
    meta: { count: n },
  });
  revalidatePath("/admin/comentarios");
  return { ok: true as const, count: n };
}

export async function deleteCommentsAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const n = await deleteComments({ workspaceId: ctx.workspace.id, ids: input.ids });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "comments.deleted",
    targetType: "comment",
    meta: { count: n },
  });
  revalidatePath("/admin/comentarios");
  revalidatePath("/blog");
  return { ok: true as const, count: n };
}
