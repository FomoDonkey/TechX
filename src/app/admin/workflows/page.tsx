import { db } from "@/db/client";
import { collections, entries, entryAssignments, members, users } from "@/db/schema";
import { type EntryPriority, type EntryStatus, effectiveDueAt, slaState } from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { WorkflowKanban } from "./workflow-kanban";

export const metadata: Metadata = { title: "Workflows · techx" };
export const dynamic = "force-dynamic";

const COLUMNS: EntryStatus[] = ["draft", "review", "approved", "scheduled", "published"];

export default async function WorkflowsPage() {
  const ctx = await requireWorkspace("viewer");
  if (!db) return null;

  // Cargar entries en main por estado (límite por columna).
  const rows = await db
    .select({
      e: {
        id: entries.id,
        title: entries.title,
        slug: entries.slug,
        status: entries.status,
        priority: entries.priority,
        scheduledAt: entries.scheduledAt,
        publishedAt: entries.publishedAt,
        dueAt: entries.dueAt,
        updatedAt: entries.updatedAt,
        authorId: entries.authorId,
      },
      c: { id: collections.id, name: collections.name, icon: collections.icon },
      a: { id: users.id, name: users.name, image: users.image },
    })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(eq(entries.workspaceId, ctx.workspace.id), isNull(entries.branchId)))
    .orderBy(entries.priority, entries.updatedAt);

  // Asignaciones activas joineadas con users.
  const allAssignees = await db
    .select({
      entryId: entryAssignments.entryId,
      assignmentId: entryAssignments.id,
      role: entryAssignments.role,
      dueAt: entryAssignments.dueAt,
      slaHours: entryAssignments.slaHours,
      createdAt: entryAssignments.createdAt,
      user: { id: users.id, name: users.name, image: users.image },
    })
    .from(entryAssignments)
    .innerJoin(users, eq(users.id, entryAssignments.assigneeId))
    .where(
      and(eq(entryAssignments.workspaceId, ctx.workspace.id), isNull(entryAssignments.completedAt)),
    );

  const assigneesByEntry = new Map<
    string,
    Array<{
      assignmentId: string;
      role: string;
      user: { id: string; name: string; image: string | null };
      effectiveDueAt: string | null;
      slaState: ReturnType<typeof slaState>;
    }>
  >();
  for (const a of allAssignees) {
    const arr = assigneesByEntry.get(a.entryId) ?? [];
    const eff = effectiveDueAt({ dueAt: a.dueAt, slaHours: a.slaHours, createdAt: a.createdAt });
    arr.push({
      assignmentId: a.assignmentId,
      role: a.role,
      user: a.user,
      effectiveDueAt: eff?.toISOString() ?? null,
      slaState: slaState(eff),
    });
    assigneesByEntry.set(a.entryId, arr);
  }

  const cards = rows.map((r) => ({
    id: r.e.id,
    title: r.e.title,
    slug: r.e.slug,
    status: r.e.status,
    priority: r.e.priority,
    scheduledAt: r.e.scheduledAt?.toISOString() ?? null,
    publishedAt: r.e.publishedAt?.toISOString() ?? null,
    dueAt: r.e.dueAt?.toISOString() ?? null,
    updatedAt: r.e.updatedAt.toISOString(),
    collection: r.c,
    author: r.a,
    assignees: assigneesByEntry.get(r.e.id) ?? [],
  }));

  // Counts agregados.
  const counts: Partial<Record<EntryStatus, number>> = {};
  for (const c of cards) {
    if (COLUMNS.includes(c.status as EntryStatus)) {
      counts[c.status as EntryStatus] = (counts[c.status as EntryStatus] ?? 0) + 1;
    }
  }

  // Workspace members for assign picker.
  const workspaceMembers = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.workspaceId, ctx.workspace.id));

  // Avoid sql unused import warning if any.
  void sql;

  return (
    <WorkflowKanban
      cards={cards}
      columns={COLUMNS}
      counts={counts}
      members={workspaceMembers}
      role={ctx.role}
    />
  );
}

export type WorkflowCard = {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  priority: EntryPriority;
  scheduledAt: string | null;
  publishedAt: string | null;
  dueAt: string | null;
  updatedAt: string;
  collection: { id: string; name: string; icon: string | null };
  author: { id: string; name: string; image: string | null } | null;
  assignees: Array<{
    assignmentId: string;
    role: string;
    user: { id: string; name: string; image: string | null };
    effectiveDueAt: string | null;
    slaState: ReturnType<typeof slaState>;
  }>;
};
