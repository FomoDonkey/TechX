import { db } from "@/db/client";
import {
  activityLog,
  analyticsEvents,
  collections,
  comments,
  entries,
  members,
  subscribers,
  users,
} from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

export type Series = number[];

export type DashboardKpis = {
  entriesTotal: number;
  entriesPublished: number;
  entriesDrafts: number;
  subscribersTotal: number;
  membersTotal: number;
  commentsTotal: number;
  viewsTotal: number;
  series: {
    entries: Series;
    subscribers: Series;
    comments: Series;
    views: Series;
  };
};

export type ActivityRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  createdAt: Date;
  actorName: string | null;
  actorImage: string | null;
};

export type TopPostRow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
  excerpt: string | null;
  status: string;
  views: number;
};

const DAYS = 14;

function emptySeries(): Series {
  return new Array<number>(DAYS).fill(0);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeStart(): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - (DAYS - 1));
  return d;
}

function bucketize(rows: Array<{ day: string | Date; n: number }>): Series {
  const out = emptySeries();
  const start = rangeStart().getTime();
  for (const r of rows) {
    const d = startOfDay(new Date(r.day)).getTime();
    const idx = Math.floor((d - start) / (24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < DAYS) out[idx] = (out[idx] ?? 0) + Number(r.n);
  }
  return out;
}

export async function loadDashboardKpis(workspaceId: string): Promise<DashboardKpis> {
  if (!db) {
    return {
      entriesTotal: 0,
      entriesPublished: 0,
      entriesDrafts: 0,
      subscribersTotal: 0,
      membersTotal: 0,
      commentsTotal: 0,
      viewsTotal: 0,
      series: {
        entries: emptySeries(),
        subscribers: emptySeries(),
        comments: emptySeries(),
        views: emptySeries(),
      },
    };
  }

  const since = rangeStart();

  const [
    statusCountsRows,
    subsRow,
    commentsRow,
    viewsRow,
    membersRow,
    entriesSeriesRows,
    subsSeriesRows,
    commentsSeriesRows,
    viewsSeriesRows,
  ] = await Promise.all([
    db
      .select({ status: entries.status, n: sql<number>`count(*)::int` })
      .from(entries)
      // F9b: KPIs sólo cuentan main, no forks de branches.
      .where(and(eq(entries.workspaceId, workspaceId), isNull(entries.branchId)))
      .groupBy(entries.status),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(subscribers)
      .where(eq(subscribers.workspaceId, workspaceId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(entries, eq(comments.entryId, entries.id))
      .where(eq(entries.workspaceId, workspaceId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.workspaceId, workspaceId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.workspaceId, workspaceId)),
    db
      .select({
        day: sql<string>`date_trunc('day', ${entries.createdAt})::date`,
        n: sql<number>`count(*)::int`,
      })
      .from(entries)
      .where(
        and(
          eq(entries.workspaceId, workspaceId),
          gte(entries.createdAt, since),
          // F9b: serie de creación sólo cuenta main.
          isNull(entries.branchId),
        ),
      )
      .groupBy(sql`1`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${subscribers.createdAt})::date`,
        n: sql<number>`count(*)::int`,
      })
      .from(subscribers)
      .where(and(eq(subscribers.workspaceId, workspaceId), gte(subscribers.createdAt, since)))
      .groupBy(sql`1`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${comments.createdAt})::date`,
        n: sql<number>`count(*)::int`,
      })
      .from(comments)
      .innerJoin(entries, eq(comments.entryId, entries.id))
      .where(and(eq(entries.workspaceId, workspaceId), gte(comments.createdAt, since)))
      .groupBy(sql`1`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${analyticsEvents.createdAt})::date`,
        n: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(eq(analyticsEvents.workspaceId, workspaceId), gte(analyticsEvents.createdAt, since)),
      )
      .groupBy(sql`1`),
  ]);

  const counts: Record<string, number> = { draft: 0, published: 0 };
  let entriesTotal = 0;
  for (const r of statusCountsRows) {
    counts[r.status] = r.n;
    entriesTotal += r.n;
  }

  return {
    entriesTotal,
    entriesPublished: counts.published ?? 0,
    entriesDrafts: counts.draft ?? 0,
    subscribersTotal: subsRow[0]?.n ?? 0,
    membersTotal: membersRow[0]?.n ?? 0,
    commentsTotal: commentsRow[0]?.n ?? 0,
    viewsTotal: viewsRow[0]?.n ?? 0,
    series: {
      entries: bucketize(entriesSeriesRows),
      subscribers: bucketize(subsSeriesRows),
      comments: bucketize(commentsSeriesRows),
      views: bucketize(viewsSeriesRows),
    },
  };
}

export async function loadRecentActivity(workspaceId: string, limit = 10): Promise<ActivityRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      targetType: activityLog.targetType,
      targetId: activityLog.targetId,
      meta: activityLog.meta,
      createdAt: activityLog.createdAt,
      actorName: users.name,
      actorImage: users.image,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(eq(activityLog.workspaceId, workspaceId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    meta: r.meta,
    createdAt: r.createdAt,
    actorName: r.actorName,
    actorImage: r.actorImage,
  }));
}

export async function loadTopPosts(workspaceId: string, limit = 5): Promise<TopPostRow[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: entries.id,
      title: entries.title,
      slug: entries.slug,
      publishedAt: entries.publishedAt,
      excerpt: entries.excerpt,
      status: entries.status,
    })
    .from(entries)
    .innerJoin(collections, eq(collections.id, entries.collectionId))
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(collections.slug, POSTS_SLUG),
        eq(entries.status, "published"),
        // F9b: top posts del dashboard ignora forks de branches.
        isNull(entries.branchId),
      ),
    )
    .orderBy(desc(entries.publishedAt))
    .limit(limit);

  // Views por post — futuro Fase 10. De momento 0.
  return rows.map((r) => ({ ...r, views: 0 }));
}
