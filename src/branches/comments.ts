import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import {
  type BranchComment,
  type NewBranchComment,
  branchActivity,
  branchComments,
  members,
  users,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export type CreateCommentInput = {
  workspaceId: string;
  branchId: string;
  authorId: string;
  body: string;
  entryId?: string | null;
  blockId?: string | null;
  anchorRange?: { from: number; to: number } | null;
  parentId?: string | null;
  mentions?: string[] | null;
};

const MAX_BODY = 4000;
const MAX_MENTIONS = 32;

export async function createBranchComment(input: CreateCommentInput): Promise<BranchComment> {
  if (!db) throw new Error("DB no configurada");
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) throw new Error("Comentario vacío");
  const requestedMentions = (input.mentions ?? [])
    .filter((m) => typeof m === "string" && m.length > 0 && m.length < 80)
    .slice(0, MAX_MENTIONS);
  // M23: validar mentions contra `members` del workspace — descarta IDs que no existen.
  let mentions: string[] = [];
  if (requestedMentions.length > 0) {
    const validMembers = await db
      .select({ userId: members.userId })
      .from(members)
      .where(
        and(eq(members.workspaceId, input.workspaceId), inArray(members.userId, requestedMentions)),
      );
    mentions = validMembers.map((m) => m.userId);
  }

  // Validar parent si llega: que pertenezca a la misma branch + workspace.
  if (input.parentId) {
    const [parent] = await db
      .select({ branchId: branchComments.branchId, workspaceId: branchComments.workspaceId })
      .from(branchComments)
      .where(eq(branchComments.id, input.parentId))
      .limit(1);
    if (!parent || parent.branchId !== input.branchId || parent.workspaceId !== input.workspaceId) {
      throw new Error("Comentario padre inválido");
    }
  }

  const values: NewBranchComment = {
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    authorId: input.authorId,
    body,
    entryId: input.entryId ?? null,
    blockId: input.blockId ?? null,
    anchorRange: input.anchorRange ?? null,
    parentId: input.parentId ?? null,
    mentions: mentions.length > 0 ? mentions : null,
    status: "open",
  };
  const newId = crypto.randomUUID();
  const created = (await insertReturning(branchComments, {
    id: newId,
    ...values,
  })) as BranchComment;
  if (!created) throw new Error("No se pudo crear el comentario");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    entryId: input.entryId ?? null,
    type: "comment.added",
    actorId: input.authorId,
    payload: { commentId: created.id, blockId: input.blockId ?? null },
  });
  return created;
}

export async function resolveBranchComment(input: {
  workspaceId: string;
  branchId: string;
  commentId: string;
  actorId: string;
}): Promise<BranchComment> {
  if (!db) throw new Error("DB no configurada");
  await db
    .update(branchComments)
    .set({ status: "resolved", resolvedAt: new Date(), resolvedById: input.actorId })
    .where(
      and(
        eq(branchComments.workspaceId, input.workspaceId),
        eq(branchComments.branchId, input.branchId),
        eq(branchComments.id, input.commentId),
      ),
    );
  const [updated] = await db
    .select()
    .from(branchComments)
    .where(
      and(
        eq(branchComments.workspaceId, input.workspaceId),
        eq(branchComments.branchId, input.branchId),
        eq(branchComments.id, input.commentId),
      ),
    )
    .limit(1);
  if (!updated) throw new Error("Comentario no encontrado");

  await db.insert(branchActivity).values({
    workspaceId: input.workspaceId,
    branchId: input.branchId,
    entryId: updated.entryId,
    type: "comment.resolved",
    actorId: input.actorId,
    payload: { commentId: updated.id },
  });
  return updated;
}

export async function deleteBranchComment(input: {
  workspaceId: string;
  branchId: string;
  commentId: string;
}): Promise<void> {
  if (!db) return;
  await db
    .delete(branchComments)
    .where(
      and(
        eq(branchComments.workspaceId, input.workspaceId),
        eq(branchComments.branchId, input.branchId),
        eq(branchComments.id, input.commentId),
      ),
    );
}

export type BranchCommentWithAuthor = BranchComment & {
  author: { id: string; name: string; image: string | null } | null;
};

export async function listBranchComments(input: {
  workspaceId: string;
  branchId: string;
  entryId?: string | null;
}): Promise<BranchCommentWithAuthor[]> {
  if (!db) return [];
  const baseWhere = [
    eq(branchComments.workspaceId, input.workspaceId),
    eq(branchComments.branchId, input.branchId),
  ];
  const where = input.entryId
    ? and(...baseWhere, eq(branchComments.entryId, input.entryId))
    : and(...baseWhere);
  const rows = await db
    .select({
      comment: branchComments,
      user: { id: users.id, name: users.name, image: users.image },
    })
    .from(branchComments)
    .leftJoin(users, eq(users.id, branchComments.authorId))
    .where(where)
    .orderBy(asc(branchComments.createdAt));
  return rows.map((r) => ({ ...r.comment, author: r.user }));
}
