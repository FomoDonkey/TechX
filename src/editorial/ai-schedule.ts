import { db } from "@/db/client";
import { analyticsEvents, entries } from "@/db/schema";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

/**
 * Sugiere slots de publicación óptimos basándose en analytics_events de los
 * últimos 90 días — calcula visitas medias por (weekday, hour) y devuelve
 * los top-N slots futuros desde "now".
 *
 * Si no hay datos analytics, devuelve heurística sensata (martes/jueves 09:00 UTC).
 */
export type SuggestedSlot = {
  date: Date;
  score: number;
  /** "alto"/"medio"/"datos limitados" — explicación al usuario. */
  rationale: string;
};

export async function suggestSlots(
  workspaceId: string,
  options: { count?: number; collectionId?: string } = {},
): Promise<SuggestedSlot[]> {
  const count = Math.min(Math.max(options.count ?? 3, 1), 7);
  if (!db) return defaultSlots(count);

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  // Promedio de visitas por (dow, hour) en los últimos 90 días.
  const stats = await db
    .select({
      dow: sql<number>`extract(dow from ${analyticsEvents.createdAt})::int`,
      hour: sql<number>`extract(hour from ${analyticsEvents.createdAt})::int`,
      visits: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.workspaceId, workspaceId), gte(analyticsEvents.createdAt, since)))
    .groupBy(
      sql`extract(dow from ${analyticsEvents.createdAt}), extract(hour from ${analyticsEvents.createdAt})`,
    );

  // También miramos publishedAt del workspace para filtrar slots con conflicto cercano.
  const upcomingWhere = options.collectionId
    ? and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.collectionId, options.collectionId),
        isNotNull(entries.scheduledAt),
        gte(entries.scheduledAt, new Date()),
      )
    : and(
        eq(entries.workspaceId, workspaceId),
        isNotNull(entries.scheduledAt),
        gte(entries.scheduledAt, new Date()),
      );
  const upcoming = await db
    .select({ scheduledAt: entries.scheduledAt })
    .from(entries)
    .where(upcomingWhere);

  const occupied = new Set(
    upcoming
      .map((u) => u.scheduledAt)
      .filter((d): d is Date => !!d)
      .map((d) => Math.floor(d.getTime() / (3600 * 1000))),
  );

  if (stats.length === 0) {
    return defaultSlots(count, occupied);
  }
  const map = new Map<string, number>();
  for (const s of stats) map.set(`${s.dow}-${s.hour}`, s.visits);

  // Generar candidatos para los próximos 21 días.
  const candidates: SuggestedSlot[] = [];
  const now = new Date();
  for (let dayOffset = 1; dayOffset <= 21; dayOffset++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    for (let h = 7; h <= 22; h++) {
      const ts = new Date(day);
      ts.setUTCHours(h, 0, 0, 0);
      const hourBucket = Math.floor(ts.getTime() / (3600 * 1000));
      if (occupied.has(hourBucket)) continue;
      const dow = ts.getUTCDay();
      const score = map.get(`${dow}-${h}`) ?? 0;
      if (score === 0) continue;
      candidates.push({
        date: ts,
        score,
        rationale: score > 50 ? "Alto tráfico histórico" : "Tráfico medio histórico",
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return defaultSlots(count, occupied);
  return candidates.slice(0, count);
}

function defaultSlots(count: number, occupied: Set<number> = new Set()): SuggestedSlot[] {
  // Heurística: martes y jueves 09:00 UTC, próximas semanas.
  const out: SuggestedSlot[] = [];
  const now = new Date();
  let dayOffset = 1;
  while (out.length < count && dayOffset <= 28) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(9, 0, 0, 0);
    const dow = d.getUTCDay();
    if ((dow === 2 || dow === 4) && !occupied.has(Math.floor(d.getTime() / (3600 * 1000)))) {
      out.push({
        date: d,
        score: 0,
        rationale: "Datos limitados — heurística martes/jueves 09:00",
      });
    }
    dayOffset++;
  }
  return out;
}
