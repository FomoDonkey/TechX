import { db } from "@/db/client";
import { countInt, dateTrunc, formatDateIso } from "@/db/dialect";
import {
  type EntryPriority,
  type EntryStatus,
  collections,
  editorialThreads,
  entries,
  entryAssignments,
  users,
} from "@/db/schema";
import { and, asc, between, count, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

export type CalendarFilter = {
  workspaceId: string;
  /** Inclusive range start (UTC date). */
  from: Date;
  /** Exclusive range end. */
  to: Date;
  collectionIds?: string[];
  authorIds?: string[];
  assigneeIds?: string[];
  statuses?: EntryStatus[];
  branchIds?: (string | null)[];
  priorities?: EntryPriority[];
  /** Si true, incluye también dueAt como fecha (no solo scheduledAt). */
  includeDue?: boolean;
};

export type CalendarItem = {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  priority: EntryPriority;
  collectionId: string;
  collectionName: string;
  collectionIcon: string | null;
  branchId: string | null;
  /** Fecha que provoca aparición en calendar — scheduledAt o dueAt o publishedAt. */
  date: Date;
  dateKind: "scheduled" | "due" | "published";
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  assigneeIds: string[];
  threadCount: number;
};

/**
 * Devuelve items para pintar mes/semana. Incluye joins con collection + author.
 * Filtra entries en main (branchId IS NULL) salvo que filter.branchIds especifique.
 */
export async function listCalendarItems(filter: CalendarFilter): Promise<CalendarItem[]> {
  if (!db) return [];

  const conditions = [eq(entries.workspaceId, filter.workspaceId)];

  // Date range: scheduledAt OR (includeDue ? dueAt : never) OR publishedAt for "published" status.
  // Built dinámicamente.
  const dateClauses = [
    and(gte(entries.scheduledAt, filter.from), lte(entries.scheduledAt, filter.to)),
    and(gte(entries.publishedAt, filter.from), lte(entries.publishedAt, filter.to)),
  ];
  if (filter.includeDue) {
    dateClauses.push(and(gte(entries.dueAt, filter.from), lte(entries.dueAt, filter.to)));
  }
  const dateOr = or(...dateClauses);
  if (dateOr) conditions.push(dateOr);

  if (filter.collectionIds && filter.collectionIds.length > 0) {
    conditions.push(inArray(entries.collectionId, filter.collectionIds));
  }
  if (filter.authorIds && filter.authorIds.length > 0) {
    conditions.push(inArray(entries.authorId, filter.authorIds));
  }
  if (filter.statuses && filter.statuses.length > 0) {
    conditions.push(inArray(entries.status, filter.statuses));
  }
  if (filter.priorities && filter.priorities.length > 0) {
    conditions.push(inArray(entries.priority, filter.priorities));
  }
  if (filter.branchIds && filter.branchIds.length > 0) {
    const nonNull = filter.branchIds.filter((b): b is string => !!b);
    const includesNull = filter.branchIds.includes(null);
    if (nonNull.length > 0 && includesNull) {
      const c = or(inArray(entries.branchId, nonNull), isNull(entries.branchId));
      if (c) conditions.push(c);
    } else if (nonNull.length > 0) {
      conditions.push(inArray(entries.branchId, nonNull));
    } else if (includesNull) {
      conditions.push(isNull(entries.branchId));
    }
  } else {
    // Default: solo main.
    conditions.push(isNull(entries.branchId));
  }

  const rows = await db
    .select({
      e: {
        id: entries.id,
        title: entries.title,
        slug: entries.slug,
        status: entries.status,
        priority: entries.priority,
        collectionId: entries.collectionId,
        branchId: entries.branchId,
        scheduledAt: entries.scheduledAt,
        publishedAt: entries.publishedAt,
        dueAt: entries.dueAt,
        authorId: entries.authorId,
      },
      c: { id: collections.id, name: collections.name, icon: collections.icon },
      a: { id: users.id, name: users.name, image: users.image },
    })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .leftJoin(users, eq(users.id, entries.authorId))
    .where(and(...conditions))
    .orderBy(asc(entries.scheduledAt));

  if (rows.length === 0) return [];

  // Apply assignee filter (postfilter to avoid join blowup).
  let filtered = rows;
  if (filter.assigneeIds && filter.assigneeIds.length > 0) {
    const eIds = rows.map((r) => r.e.id);
    const assignees = await db
      .select({ entryId: entryAssignments.entryId, userId: entryAssignments.assigneeId })
      .from(entryAssignments)
      .where(
        and(
          eq(entryAssignments.workspaceId, filter.workspaceId),
          inArray(entryAssignments.entryId, eIds),
          inArray(entryAssignments.assigneeId, filter.assigneeIds),
          isNull(entryAssignments.completedAt),
        ),
      );
    const matchedEntryIds = new Set(assignees.map((a) => a.entryId));
    filtered = rows.filter((r) => matchedEntryIds.has(r.e.id));
  }

  // Aggregate assignees + thread counts.
  const eIds = filtered.map((r) => r.e.id);
  if (eIds.length === 0) return [];
  const [allAssignees, threadCounts] = await Promise.all([
    db
      .select({ entryId: entryAssignments.entryId, userId: entryAssignments.assigneeId })
      .from(entryAssignments)
      .where(
        and(
          eq(entryAssignments.workspaceId, filter.workspaceId),
          inArray(entryAssignments.entryId, eIds),
          isNull(entryAssignments.completedAt),
        ),
      ),
    db
      .select({
        entryId: editorialThreads.entryId,
        n: countInt(),
      })
      .from(editorialThreads)
      .where(
        and(
          eq(editorialThreads.workspaceId, filter.workspaceId),
          inArray(editorialThreads.entryId, eIds),
          eq(editorialThreads.status, "open"),
        ),
      )
      .groupBy(editorialThreads.entryId),
  ]);

  const assigneesByEntry = new Map<string, string[]>();
  for (const a of allAssignees) {
    const arr = assigneesByEntry.get(a.entryId) ?? [];
    arr.push(a.userId);
    assigneesByEntry.set(a.entryId, arr);
  }
  const threadsByEntry = new Map<string, number>();
  for (const t of threadCounts) threadsByEntry.set(t.entryId, t.n);

  // Expand each row potentially into multiple items (scheduled, due, published).
  const items: CalendarItem[] = [];
  for (const r of filtered) {
    const make = (date: Date, kind: CalendarItem["dateKind"]): CalendarItem => ({
      id: r.e.id,
      title: r.e.title,
      slug: r.e.slug,
      status: r.e.status,
      priority: r.e.priority,
      collectionId: r.e.collectionId,
      collectionName: r.c.name,
      collectionIcon: r.c.icon,
      branchId: r.e.branchId,
      date,
      dateKind: kind,
      authorId: r.e.authorId,
      authorName: r.a?.name ?? null,
      authorImage: r.a?.image ?? null,
      assigneeIds: assigneesByEntry.get(r.e.id) ?? [],
      threadCount: threadsByEntry.get(r.e.id) ?? 0,
    });
    if (r.e.scheduledAt && r.e.scheduledAt >= filter.from && r.e.scheduledAt <= filter.to) {
      items.push(make(r.e.scheduledAt, "scheduled"));
    } else if (r.e.publishedAt && r.e.publishedAt >= filter.from && r.e.publishedAt <= filter.to) {
      items.push(make(r.e.publishedAt, "published"));
    } else if (
      filter.includeDue &&
      r.e.dueAt &&
      r.e.dueAt >= filter.from &&
      r.e.dueAt <= filter.to
    ) {
      items.push(make(r.e.dueAt, "due"));
    }
  }
  // Sort by date.
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  void between; // unused on purpose, keep for future precision queries
  return items;
}

/**
 * Heatmap por día (cuenta de entries con scheduledAt en ese día) para sombrear
 * el background del calendar (intensidad relativa al máximo).
 */
export async function calendarHeatmap(
  workspaceId: string,
  from: Date,
  to: Date,
): Promise<Array<{ day: string; count: number }>> {
  if (!db) return [];
  const dayBucket = dateTrunc("day", entries.scheduledAt);
  const rows = await db
    .select({
      day: formatDateIso(entries.scheduledAt),
      count: count(),
    })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        gte(entries.scheduledAt, from),
        lte(entries.scheduledAt, to),
        isNull(entries.branchId),
      ),
    )
    .groupBy(dayBucket);
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}
