import { createHash } from "node:crypto";
import { thresholdToStatus } from "@/ai/moderation";
import { db } from "@/db/client";
import { type Comment, comments, entries, users } from "@/db/schema";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, count, desc, eq, sql } from "drizzle-orm";

export type CommentItem = {
  id: string;
  workspaceId: string;
  entryId: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string | null;
  authorImage: string | null;
  body: string;
  status: "pending" | "approved" | "spam";
  aiScore: number | null;
  aiReason: string | null;
  createdAt: Date;
};

export type CommentForBlog = {
  id: string;
  parentId: string | null;
  authorName: string;
  authorImage: string | null;
  body: string;
  createdAt: Date;
};

export function hashIp(ip: string | null | undefined, salt: string): string {
  if (!ip) return "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function createComment(input: {
  workspaceId: string;
  entryId: string;
  parentId?: string | null;
  blockId?: string | null;
  authorName: string;
  authorEmail: string;
  authorUserId?: string | null;
  body: string;
  ipHash?: string;
  userAgent?: string;
  aiScore: number;
  aiReason: string;
}): Promise<Comment | null> {
  if (!db) return null;
  const status = thresholdToStatus(input.aiScore);
  const [row] = await db
    .insert(comments)
    .values({
      workspaceId: input.workspaceId,
      entryId: input.entryId,
      parentId: input.parentId ?? null,
      blockId: input.blockId ?? null,
      authorName: input.authorName.slice(0, 80),
      authorEmail: input.authorEmail.slice(0, 200),
      authorUserId: input.authorUserId ?? null,
      body: input.body.slice(0, 5000),
      status,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      aiScore: input.aiScore,
      aiReason: input.aiReason.slice(0, 500),
      updatedAt: new Date(),
    })
    .returning();
  if (row) {
    emitAsync({
      workspaceId: input.workspaceId,
      event: "comment.created",
      payload: {
        id: row.id,
        entryId: row.entryId,
        parentId: row.parentId,
        status: row.status,
        authorName: row.authorName,
      },
    });
  }
  return row ?? null;
}

export async function listApprovedForEntry(entryId: string): Promise<CommentForBlog[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorImage: users.image,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorUserId))
    .where(and(eq(comments.entryId, entryId), eq(comments.status, "approved")))
    .orderBy(comments.createdAt);
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    authorName: r.authorName,
    authorImage: r.authorImage,
    body: r.body,
    createdAt: r.createdAt,
  }));
}

export async function listForModeration(opts: {
  workspaceId: string;
  status?: "pending" | "approved" | "spam";
  limit?: number;
}): Promise<CommentItem[]> {
  if (!db) return [];
  const conds = [eq(comments.workspaceId, opts.workspaceId)];
  if (opts.status) conds.push(eq(comments.status, opts.status));
  const rows = await db
    .select({
      id: comments.id,
      workspaceId: comments.workspaceId,
      entryId: comments.entryId,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      authorImage: users.image,
      body: comments.body,
      status: comments.status,
      aiScore: comments.aiScore,
      aiReason: comments.aiReason,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorUserId))
    .where(and(...conds))
    .orderBy(desc(comments.createdAt))
    .limit(opts.limit ?? 100);
  return rows;
}

export async function countByStatus(workspaceId: string): Promise<{
  pending: number;
  approved: number;
  spam: number;
}> {
  if (!db) return { pending: 0, approved: 0, spam: 0 };
  const rows = await db
    .select({
      status: comments.status,
      total: count(comments.id),
    })
    .from(comments)
    .where(eq(comments.workspaceId, workspaceId))
    .groupBy(comments.status);
  const out = { pending: 0, approved: 0, spam: 0 };
  for (const r of rows) {
    if (r.status === "pending") out.pending = Number(r.total);
    if (r.status === "approved") out.approved = Number(r.total);
    if (r.status === "spam") out.spam = Number(r.total);
  }
  return out;
}

export async function setStatus(input: {
  workspaceId: string;
  ids: string[];
  status: "pending" | "approved" | "spam";
}): Promise<number> {
  if (!db) return 0;
  if (input.ids.length === 0) return 0;
  const r = await db
    .update(comments)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(eq(comments.workspaceId, input.workspaceId), sql`${comments.id} = ANY(${input.ids})`),
    )
    .returning({ id: comments.id });
  // Webhook por estado
  const event =
    input.status === "approved"
      ? "comment.approved"
      : input.status === "spam"
        ? "comment.spam"
        : null;
  if (event) {
    for (const { id } of r) {
      emitAsync({ workspaceId: input.workspaceId, event, payload: { id, status: input.status } });
    }
  }
  return r.length;
}

export async function deleteComments(input: {
  workspaceId: string;
  ids: string[];
}): Promise<number> {
  if (!db) return 0;
  if (input.ids.length === 0) return 0;
  const r = await db
    .delete(comments)
    .where(
      and(eq(comments.workspaceId, input.workspaceId), sql`${comments.id} = ANY(${input.ids})`),
    )
    .returning({ id: comments.id });
  return r.length;
}

/**
 * Verifica que un entry pertenece al workspace y está publicado.
 * Multi-tenant safe: filtra por (workspaceId, slug, status).
 */
export async function getEntryForComment(
  workspaceId: string,
  slug: string,
): Promise<{
  id: string;
  workspaceId: string;
  title: string;
} | null> {
  if (!db) return null;
  const [row] = await db
    .select({
      id: entries.id,
      workspaceId: entries.workspaceId,
      title: entries.title,
    })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.slug, slug),
        eq(entries.status, "published"),
      ),
    )
    .limit(1);
  return row ?? null;
}
