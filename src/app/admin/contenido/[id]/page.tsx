import { requireUser } from "@/auth/server";
import { EditorShell } from "@/components/admin/editor/editor-shell";
import { db } from "@/db/client";
import { members, users } from "@/db/schema";
import {
  effectiveDueAt,
  listEntryAssignments,
  listEntryEvents,
  listThreadsForEntry,
  loadReactionsForThreads,
  slaState,
} from "@/editorial";
import { getEntryById, listLatestRevisions } from "@/lib/entries";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Editor" };
  const ctx = await requireWorkspace("viewer");
  const entry = await getEntryById(ctx.workspace.id, id);
  return { title: entry?.title ? `${entry.title} · Editor` : "Editor" };
}

function bodyToText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) for (const c of n.content) visit(c);
  };
  visit(body);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const entry = await getEntryById(ctx.workspace.id, id);
  if (!entry) notFound();

  const revisions = (await listLatestRevisions(entry.id, 30)).map((r) => ({
    id: r.id,
    summary: r.summary,
    authorId: r.authorId,
    createdAt: r.createdAt.toISOString(),
  }));

  const [assignments, threads, events, workspaceMembers] = await Promise.all([
    listEntryAssignments(ctx.workspace.id, entry.id),
    listThreadsForEntry(ctx.workspace.id, entry.id),
    listEntryEvents(ctx.workspace.id, entry.id),
    db
      ? db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(eq(members.workspaceId, ctx.workspace.id))
      : Promise.resolve([] as Array<{ id: string; name: string; image: string | null }>),
  ]);

  // F10b — reactions live: cargamos las iniciales para todos los threads del entry.
  const threadIds = threads.map((t) => t.id);
  const reactions = threadIds.length
    ? await loadReactionsForThreads({
        workspaceId: ctx.workspace.id,
        threadIds,
        myUserId: user.id,
      })
    : [];
  const reactionsByMessage: Record<
    string,
    Array<{ messageId: string; emoji: string; count: number; mine: boolean }>
  > = {};
  for (const r of reactions) {
    const arr = reactionsByMessage[r.messageId] ?? [];
    arr.push(r);
    reactionsByMessage[r.messageId] = arr;
  }

  return (
    <EditorShell
      initial={{
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        excerpt: entry.excerpt,
        body: entry.body,
        status: entry.status,
        scheduledAt: entry.scheduledAt ? entry.scheduledAt.toISOString() : null,
        publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
        updatedAt: entry.updatedAt.toISOString(),
        seo: entry.seo,
      }}
      workspaceSlug={ctx.workspace.slug}
      currentUser={{
        id: user.id,
        name: user.name ?? user.email ?? "Editor",
        image: user.image ?? null,
        role: ctx.role,
      }}
      revisions={revisions}
      bodyText={entry.bodyText ?? bodyToText(entry.body)}
      editorial={{
        entryId: entry.id,
        status: entry.status,
        priority: entry.priority,
        scheduledAt: entry.scheduledAt ? entry.scheduledAt.toISOString() : null,
        dueAt: entry.dueAt ? entry.dueAt.toISOString() : null,
        myUserId: user.id,
        members: workspaceMembers,
        assignees: assignments
          .filter((a) => !a.completedAt && a.assignee)
          .map((a) => {
            const eff = effectiveDueAt({
              dueAt: a.dueAt,
              slaHours: a.slaHours,
              createdAt: a.createdAt,
            });
            return {
              assignmentId: a.id,
              role: a.role as "writer" | "reviewer" | "approver",
              user: a.assignee as { id: string; name: string; image: string | null },
              effectiveDueAt: eff?.toISOString() ?? null,
              slaState: slaState(eff),
            };
          }),
        threads: threads.map((t) => ({
          id: t.id,
          blockId: t.blockId,
          status: t.status as "open" | "resolved",
          creator: t.creator,
          createdAt: t.createdAt.toISOString(),
          messages: t.messages.map((m) => ({
            id: m.id,
            authorId: m.authorId,
            author: m.author,
            body: m.body,
            mentions: m.mentions,
            createdAt: m.createdAt.toISOString(),
          })),
        })),
        events: events.map((ev) => ({
          id: ev.event.id,
          type: ev.event.type,
          fromStatus: ev.event.fromStatus,
          toStatus: ev.event.toStatus,
          actor: ev.actor,
          payload: (ev.event.payload as Record<string, unknown> | null) ?? null,
          createdAt: ev.event.createdAt.toISOString(),
        })),
        reactionsByMessage,
      }}
    />
  );
}
