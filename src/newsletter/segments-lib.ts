/**
 * CRUD de segmentos. Las reglas se validan con SegmentRuleSchema.
 */

import { db } from "@/db/client";
import { deleteReturningCount, insertReturning } from "@/db/dialect";
import { type Segment, type Subscriber, segments, subscribers } from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { type SegmentRulesPayload, matchesRule, validateRule } from "./segments";

export async function listSegments(workspaceId: string): Promise<Segment[]> {
  if (!db) return [];
  return db.select().from(segments).where(eq(segments.workspaceId, workspaceId));
}

export async function getSegment(workspaceId: string, id: string): Promise<Segment | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.workspaceId, workspaceId), eq(segments.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createSegment(input: {
  workspaceId: string;
  name: string;
  rules?: unknown;
}): Promise<{ ok: true; segment: Segment } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "db_error" };
  const validated = validateRule(input.rules ?? null);
  if (!validated.ok) return { ok: false, error: validated.error };
  const id = crypto.randomUUID();
  const row = (await insertReturning(segments, {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    rules: (validated.rule ?? null) as never,
  })) as Segment;
  if (!row) return { ok: false, error: "db_error" };
  return { ok: true, segment: row };
}

export async function updateSegment(
  workspaceId: string,
  id: string,
  patch: { name?: string; rules?: unknown },
): Promise<{ ok: true; segment: Segment } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "db_error" };
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.rules !== undefined) {
    const validated = validateRule(patch.rules);
    if (!validated.ok) return { ok: false, error: validated.error };
    updates.rules = validated.rule ?? null;
  }
  if (Object.keys(updates).length === 0) {
    const existing = await getSegment(workspaceId, id);
    if (!existing) return { ok: false, error: "not_found" };
    return { ok: true, segment: existing };
  }
  await db
    .update(segments)
    .set(updates)
    .where(and(eq(segments.workspaceId, workspaceId), eq(segments.id, id)));
  const [row] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.workspaceId, workspaceId), eq(segments.id, id)))
    .limit(1);
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, segment: row };
}

export async function deleteSegment(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const count = await deleteReturningCount(
    segments,
    and(eq(segments.workspaceId, workspaceId), eq(segments.id, id))!,
  );
  return count > 0;
}

/**
 * Cuenta cuántos subscribers activos confirmados matchean. Limita a 10k para
 * evitar fullscan exagerado (en F8c compilamos a SQL).
 */
export async function previewSegmentSize(
  workspaceId: string,
  rules: SegmentRulesPayload,
): Promise<{ matched: number; total: number; sample: Subscriber[] }> {
  if (!db) return { matched: 0, total: 0, sample: [] };
  const all = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.workspaceId, workspaceId),
        eq(subscribers.status, "active"),
        isNotNull(subscribers.confirmedAt),
      ),
    )
    .limit(10_000);
  const matched = all.filter((s) =>
    matchesRule(
      {
        status: s.status,
        locale: s.locale,
        tags: s.tags,
        source: s.source,
        email: s.email,
        name: s.name,
        createdAt: s.createdAt,
        confirmedAt: s.confirmedAt,
        lastOpenAt: s.lastOpenAt,
        lastClickAt: s.lastClickAt,
        bounceCount: s.bounceCount ?? 0,
      },
      rules,
    ),
  );
  return { matched: matched.length, total: all.length, sample: matched.slice(0, 10) };
}

export async function listSubscriberCountsForSegments(
  workspaceId: string,
): Promise<Map<string, number>> {
  if (!db) return new Map();
  const segs = await listSegments(workspaceId);
  if (segs.length === 0) return new Map();
  const all = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.workspaceId, workspaceId),
        eq(subscribers.status, "active"),
        isNotNull(subscribers.confirmedAt),
      ),
    );
  const out = new Map<string, number>();
  for (const seg of segs) {
    const count = all.filter((s) =>
      matchesRule(
        {
          status: s.status,
          locale: s.locale,
          tags: s.tags,
          source: s.source,
          email: s.email,
          name: s.name,
          createdAt: s.createdAt,
          confirmedAt: s.confirmedAt,
          lastOpenAt: s.lastOpenAt,
          lastClickAt: s.lastClickAt,
          bounceCount: s.bounceCount ?? 0,
        },
        seg.rules as SegmentRulesPayload,
      ),
    ).length;
    out.set(seg.id, count);
  }
  return out;
}
