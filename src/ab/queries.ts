/**
 * Queries CRUD para `ab_tests` (F8c). Server-only.
 */

import "server-only";

import type { AbVariant } from "@/ab/types";
import { db } from "@/db/client";
import { dateTrunc, deleteReturningCount, insertReturning } from "@/db/dialect";
import { abAssignments, abEvents, abTests } from "@/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";

type AbStatusType = "draft" | "running" | "paused" | "completed";
type AbTargetType = "block" | "page";

export type AbTestRow = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  status: AbStatusType;
  target: "block" | "page";
  pageId: string | null;
  variants: AbVariant[];
  goal: { kind: string; selector?: string; formId?: string; eventName?: string } | null;
  minSampleSize: number;
  winnerVariantId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listAbTests(workspaceId: string): Promise<AbTestRow[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(abTests)
    .where(eq(abTests.workspaceId, workspaceId))
    .orderBy(desc(abTests.updatedAt));
  return rows.map(toRow);
}

export async function getAbTest(workspaceId: string, id: string): Promise<AbTestRow | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.id, id)))
    .limit(1);
  return row ? toRow(row) : null;
}

export async function getAbTestByKey(workspaceId: string, key: string): Promise<AbTestRow | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.key, key)))
    .limit(1);
  return row ? toRow(row) : null;
}

function toRow(r: typeof abTests.$inferSelect): AbTestRow {
  const variants = Array.isArray(r.variants) ? (r.variants as AbVariant[]) : [];
  const goal = r.goal && typeof r.goal === "object" ? (r.goal as AbTestRow["goal"]) : null;
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    key: r.key,
    name: r.name,
    description: r.description,
    status: r.status as AbStatusType,
    target: r.target as "block" | "page",
    pageId: r.pageId,
    variants,
    goal,
    minSampleSize: r.minSampleSize,
    winnerVariantId: r.winnerVariantId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export type CreateAbTestInput = {
  workspaceId: string;
  key: string;
  name: string;
  description?: string | null;
  target: AbTargetType;
  pageId?: string | null;
  variants: AbVariant[];
  goal?: AbTestRow["goal"];
  minSampleSize?: number;
  createdById?: string | null;
};

export async function createAbTestRow(input: CreateAbTestInput): Promise<AbTestRow | null> {
  if (!db) return null;
  const newId = crypto.randomUUID();
  const created = (await insertReturning(abTests, {
    id: newId,
    workspaceId: input.workspaceId,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    status: "draft",
    target: input.target,
    pageId: input.pageId ?? null,
    variants: input.variants,
    goal: input.goal ?? null,
    minSampleSize: input.minSampleSize ?? 100,
    createdById: input.createdById ?? null,
  })) as typeof abTests.$inferSelect;
  return created ? toRow(created) : null;
}

export type UpdateAbTestPatch = Partial<{
  name: string;
  description: string | null;
  target: AbTargetType;
  pageId: string | null;
  variants: AbVariant[];
  goal: AbTestRow["goal"];
  minSampleSize: number;
  status: AbStatusType;
  winnerVariantId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
}>;

export async function updateAbTestRow(
  workspaceId: string,
  id: string,
  patch: UpdateAbTestPatch,
): Promise<AbTestRow | null> {
  if (!db) return null;
  await db
    .update(abTests)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.id, id)));
  const [updated] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.workspaceId, workspaceId), eq(abTests.id, id)))
    .limit(1);
  return updated ? toRow(updated) : null;
}

export async function deleteAbTestRow(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const deleted = await deleteReturningCount(
    abTests,
    and(eq(abTests.workspaceId, workspaceId), eq(abTests.id, id))!,
  );
  return deleted > 0;
}

/** Cuenta agregada para el dashboard. */
export type AbKpis = {
  total: number;
  running: number;
  draft: number;
  paused: number;
  completed: number;
  totalAssignments: number;
};

export async function abKpis(workspaceId: string): Promise<AbKpis> {
  const empty: AbKpis = {
    total: 0,
    running: 0,
    draft: 0,
    paused: 0,
    completed: 0,
    totalAssignments: 0,
  };
  if (!db) return empty;
  const rows = await db
    .select({ status: abTests.status, c: count() })
    .from(abTests)
    .where(eq(abTests.workspaceId, workspaceId))
    .groupBy(abTests.status);
  const out = { ...empty };
  for (const r of rows) {
    out.total += r.c;
    if (r.status === "running") out.running = r.c;
    else if (r.status === "draft") out.draft = r.c;
    else if (r.status === "paused") out.paused = r.c;
    else if (r.status === "completed") out.completed = r.c;
  }
  const [assignCount] = await db
    .select({ c: count() })
    .from(abAssignments)
    .where(eq(abAssignments.workspaceId, workspaceId));
  out.totalAssignments = assignCount?.c ?? 0;
  return out;
}

/** Recent events for sparkline / activity feed. */
export async function recentAbEventCounts(
  workspaceId: string,
  testId: string,
  hours = 24,
): Promise<Array<{ hour: string; impressions: number; conversions: number }>> {
  if (!db) return [];
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  const hourBucket = dateTrunc("hour", abEvents.createdAt);
  const rows = await db
    .select({
      hour: hourBucket,
      kind: abEvents.kind,
      c: count(),
    })
    .from(abEvents)
    .where(
      and(
        eq(abEvents.workspaceId, workspaceId),
        eq(abEvents.testId, testId),
        sql`${abEvents.createdAt} >= ${new Date(sinceMs).toISOString()}`,
      ),
    )
    .groupBy(hourBucket, abEvents.kind)
    .orderBy(hourBucket);
  const map = new Map<string, { hour: string; impressions: number; conversions: number }>();
  for (const r of rows) {
    // El bucket viene como Date (PG) o string (MySQL DATE_FORMAT) — normalizamos a ISO.
    const hourKey = r.hour instanceof Date ? r.hour.toISOString() : String(r.hour);
    const cur = map.get(hourKey) ?? { hour: hourKey, impressions: 0, conversions: 0 };
    if (r.kind === "impression") cur.impressions = r.c;
    else if (r.kind === "conversion") cur.conversions = r.c;
    map.set(hourKey, cur);
  }
  return Array.from(map.values());
}
