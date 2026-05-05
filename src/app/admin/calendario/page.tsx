import { db } from "@/db/client";
import { collections, entryAssignments, members, users } from "@/db/schema";
import {
  type CalendarItem,
  type EntryPriority,
  type EntryStatus,
  calendarHeatmap,
  listCalendarItems,
} from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";
import { sql } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { CalendarClient } from "./calendar-client";

export const metadata: Metadata = { title: "Calendario · CSM" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfWeek(d: Date) {
  // Lunes como primer día (UE).
  const day = d.getUTCDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

function rangeForView(view: "month" | "week", anchor: Date) {
  if (view === "week") {
    const from = startOfWeek(anchor);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from, to };
  }
  // Month: pad to whole weeks (Mon-first) — incluye días de mes anterior y siguiente.
  const monthStart = startOfMonth(anchor);
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const from = startOfWeek(monthStart);
  const lastDayWeekStart = startOfWeek(new Date(monthEnd.getTime() - 1));
  const to = new Date(lastDayWeekStart);
  to.setUTCDate(to.getUTCDate() + 7);
  return { from, to };
}

function arr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireWorkspace("viewer");
  const sp = await searchParams;

  const view: "month" | "week" = sp.view === "week" ? "week" : "month";
  const dateParam = typeof sp.date === "string" ? sp.date : null;
  const anchor = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(anchor.getTime())) anchor.setTime(Date.now());

  const range = rangeForView(view, anchor);

  const collectionFilter = arr(sp.collection);
  const authorFilter = arr(sp.author);
  const assigneeFilter = arr(sp.assignee);
  const statusFilter = arr(sp.status) as EntryStatus[];
  const priorityFilter = arr(sp.priority) as EntryPriority[];
  const includeDue = sp.includeDue === "1" || sp.includeDue === "true";

  const [items, heatmap, allCollections, workspaceMembers] = await Promise.all([
    listCalendarItems({
      workspaceId: ctx.workspace.id,
      from: range.from,
      to: range.to,
      collectionIds: collectionFilter.length > 0 ? collectionFilter : undefined,
      authorIds: authorFilter.length > 0 ? authorFilter : undefined,
      assigneeIds: assigneeFilter.length > 0 ? assigneeFilter : undefined,
      statuses: statusFilter.length > 0 ? statusFilter : undefined,
      priorities: priorityFilter.length > 0 ? priorityFilter : undefined,
      includeDue,
    }),
    calendarHeatmap(ctx.workspace.id, range.from, range.to),
    db
      ? db
          .select({
            id: collections.id,
            name: collections.name,
            slug: collections.slug,
            icon: collections.icon,
          })
          .from(collections)
          .where(eq(collections.workspaceId, ctx.workspace.id))
      : Promise.resolve(
          [] as Array<{ id: string; name: string; slug: string; icon: string | null }>,
        ),
    db
      ? db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(eq(members.workspaceId, ctx.workspace.id))
      : Promise.resolve([] as Array<{ id: string; name: string; image: string | null }>),
  ]);

  // Workload: assignments activos por user.
  const workload = db
    ? await db
        .select({
          userId: entryAssignments.assigneeId,
          n: sql<number>`count(*)::int`,
        })
        .from(entryAssignments)
        .where(
          and(
            eq(entryAssignments.workspaceId, ctx.workspace.id),
            isNull(entryAssignments.completedAt),
          ),
        )
        .groupBy(entryAssignments.assigneeId)
    : [];
  const workloadMap = new Map(workload.map((w) => [w.userId, Number(w.n)]));

  const itemsSerialized = items.map((it: CalendarItem) => ({
    ...it,
    date: it.date.toISOString(),
  }));

  return (
    <CalendarClient
      view={view}
      anchorDate={anchor.toISOString()}
      rangeFrom={range.from.toISOString()}
      rangeTo={range.to.toISOString()}
      items={itemsSerialized}
      heatmap={heatmap}
      collections={allCollections}
      members={workspaceMembers.map((m) => ({
        ...m,
        workload: workloadMap.get(m.id) ?? 0,
      }))}
      filters={{
        collectionIds: collectionFilter,
        authorIds: authorFilter,
        assigneeIds: assigneeFilter,
        statuses: statusFilter,
        priorities: priorityFilter,
        includeDue,
      }}
      role={ctx.role}
    />
  );
}
