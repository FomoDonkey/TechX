import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { type Entry, entries, entryHealth, entryHealthIssues } from "@/db/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import {
  detectHeadingHierarchy,
  detectMissingAlt,
  detectOutdatedDates,
  detectSeoMetaMissing,
  detectSeoTitleLength,
  detectThinContent,
} from "./detectors";
import { type DetectedIssue, computeScore, countBySeverity } from "./types";

/**
 * Motor de Content Health Scan. Orquesta los detectores síncronos sobre uno o
 * todos los entries del workspace y persiste los resultados en
 * `entry_health` (snapshot 1:1) + `entry_health_issues` (N por entry).
 *
 * **Idempotencia:** se calcula un `inputHash` determinista del input usado
 * por los detectores. Si no cambió desde el último escaneo, devolvemos el
 * resultado cacheado sin ejecutar detectores ni tocar DB. Esto hace barato
 * el cron semanal sobre workspaces grandes.
 *
 * **Transacción de actualización:** dentro de un `transaction()` borramos
 * los issues anteriores del entry y reinsertamos los nuevos en bloque,
 * más un upsert en `entry_health`. Garantiza atomicidad.
 */

const DETECTORS: Array<(e: Entry) => DetectedIssue[]> = [
  detectSeoTitleLength,
  detectSeoMetaMissing,
  detectThinContent,
  detectMissingAlt,
  detectHeadingHierarchy,
  detectOutdatedDates,
];

function hashEntryInput(entry: Entry): string {
  // Sólo los campos que afectan a los detectores. Evita re-escanear si sólo
  // cambió `updatedAt` por una operación irrelevante.
  const payload = JSON.stringify({
    title: entry.title,
    excerpt: entry.excerpt,
    seo: entry.seo,
    bodyText: entry.bodyText,
    body: entry.body,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export type ScanResult = {
  entryId: string;
  score: number;
  issues: DetectedIssue[];
  cached: boolean;
};

export async function scanEntry(args: {
  entry: Entry;
  /** Si `true`, fuerza re-escaneo aunque el inputHash no haya cambiado. */
  force?: boolean;
}): Promise<ScanResult> {
  if (!db) throw new Error("db_unavailable");
  const { entry } = args;
  const inputHash = hashEntryInput(entry);

  if (!args.force) {
    const [existing] = await db
      .select({ score: entryHealth.score, inputHash: entryHealth.inputHash })
      .from(entryHealth)
      .where(eq(entryHealth.entryId, entry.id))
      .limit(1);
    if (existing && existing.inputHash === inputHash) {
      const issues = await db
        .select()
        .from(entryHealthIssues)
        .where(and(eq(entryHealthIssues.entryId, entry.id), isNull(entryHealthIssues.dismissedAt)));
      return {
        entryId: entry.id,
        score: existing.score,
        cached: true,
        issues: issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          suggestion: i.suggestion ?? undefined,
          location: i.location ?? undefined,
        })),
      };
    }
  }

  const allIssues: DetectedIssue[] = DETECTORS.flatMap((d) => {
    try {
      return d(entry);
    } catch (err) {
      // Un detector roto no debe tumbar el scan completo. Logueamos y seguimos.
      console.error("[health-scan] detector_failed", { entry: entry.id, err });
      return [];
    }
  });

  const score = computeScore(allIssues);
  const counts = countBySeverity(allIssues);

  await db.transaction(async (tx) => {
    await tx.delete(entryHealthIssues).where(eq(entryHealthIssues.entryId, entry.id));
    if (allIssues.length > 0) {
      await tx.insert(entryHealthIssues).values(
        allIssues.map((i) => ({
          entryId: entry.id,
          workspaceId: entry.workspaceId,
          type: i.type,
          severity: i.severity,
          message: i.message,
          suggestion: i.suggestion ?? null,
          location: i.location ?? null,
        })),
      );
    }
    await tx
      .insert(entryHealth)
      .values({
        entryId: entry.id,
        workspaceId: entry.workspaceId,
        score,
        counts,
        inputHash,
        scannedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: entryHealth.entryId,
        set: {
          score,
          counts,
          inputHash,
          scannedAt: new Date(),
        },
      });
  });

  return { entryId: entry.id, score, issues: allIssues, cached: false };
}

/**
 * Escanea TODOS los entries publicados del workspace. Pensado para cron
 * semanal o "Volver a escanear todo" desde el dashboard. Procesa en lotes
 * para evitar saturar conexión a Postgres.
 */
export async function scanWorkspace(args: {
  workspaceId: string;
  force?: boolean;
  /** Cuantos entries procesar por iteración. Default 25. */
  batchSize?: number;
  /** Si se pasa, sólo escanea entries con status indicado. Default `published`. */
  status?: Entry["status"];
}): Promise<{ scanned: number; cached: number; durationMs: number }> {
  if (!db) throw new Error("db_unavailable");
  const start = Date.now();
  const batch = args.batchSize ?? 25;
  const status = args.status ?? "published";

  let offset = 0;
  let scanned = 0;
  let cached = 0;

  while (true) {
    const rows = await db
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.workspaceId, args.workspaceId),
          isNull(entries.branchId),
          eq(entries.status, status),
        ),
      )
      .orderBy(desc(entries.publishedAt))
      .limit(batch)
      .offset(offset);
    if (rows.length === 0) break;
    for (const row of rows) {
      const r = await scanEntry({ entry: row, force: args.force });
      scanned++;
      if (r.cached) cached++;
    }
    offset += batch;
    if (rows.length < batch) break;
  }

  return { scanned, cached, durationMs: Date.now() - start };
}

// ============================================================
// Read helpers para el dashboard + tool MCP
// ============================================================

export async function getWorkspaceHealthSummary(workspaceId: string) {
  if (!db) throw new Error("db_unavailable");
  const [agg] = await db
    .select({
      n: count(),
    })
    .from(entryHealth)
    .where(eq(entryHealth.workspaceId, workspaceId));
  if (!agg || agg.n === 0) {
    return {
      totalScanned: 0,
      avgScore: 100,
      issuesBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      issuesByType: {} as Record<string, number>,
    };
  }
  // Avg score
  const rows = await db
    .select({ score: entryHealth.score, counts: entryHealth.counts })
    .from(entryHealth)
    .where(eq(entryHealth.workspaceId, workspaceId));
  const totalScore = rows.reduce((acc, r) => acc + r.score, 0);
  const avgScore = Math.round(totalScore / rows.length);

  const issuesBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of rows) {
    issuesBySeverity.low += r.counts.low;
    issuesBySeverity.medium += r.counts.medium;
    issuesBySeverity.high += r.counts.high;
    issuesBySeverity.critical += r.counts.critical;
  }

  // Por tipo: agregar desde issues table.
  const byType = await db
    .select({ type: entryHealthIssues.type, n: count() })
    .from(entryHealthIssues)
    .where(
      and(eq(entryHealthIssues.workspaceId, workspaceId), isNull(entryHealthIssues.dismissedAt)),
    )
    .groupBy(entryHealthIssues.type);
  const issuesByType: Record<string, number> = {};
  for (const r of byType) issuesByType[r.type] = r.n;

  return {
    totalScanned: rows.length,
    avgScore,
    issuesBySeverity,
    issuesByType,
  };
}

export async function listEntriesByHealth(args: {
  workspaceId: string;
  limit?: number;
  offset?: number;
  /** Filtro por severidad mínima. */
  minSeverity?: "low" | "medium" | "high" | "critical";
}) {
  if (!db) throw new Error("db_unavailable");
  const limit = Math.min(args.limit ?? 50, 200);
  const offset = args.offset ?? 0;

  const rows = await db
    .select({
      entryId: entryHealth.entryId,
      score: entryHealth.score,
      counts: entryHealth.counts,
      scannedAt: entryHealth.scannedAt,
      title: entries.title,
      slug: entries.slug,
      status: entries.status,
    })
    .from(entryHealth)
    .innerJoin(entries, eq(entries.id, entryHealth.entryId))
    .where(eq(entryHealth.workspaceId, args.workspaceId))
    .orderBy(entryHealth.score, desc(entryHealth.scannedAt))
    .limit(limit)
    .offset(offset);

  if (args.minSeverity) {
    const minIdx = ["low", "medium", "high", "critical"].indexOf(args.minSeverity);
    return rows.filter((r) => {
      const c = r.counts;
      if (minIdx <= 0 && c.low > 0) return true;
      if (minIdx <= 1 && c.medium > 0) return true;
      if (minIdx <= 2 && c.high > 0) return true;
      if (minIdx <= 3 && c.critical > 0) return true;
      return false;
    });
  }
  return rows;
}

export async function listEntryIssues(args: { workspaceId: string; entryId: string }) {
  if (!db) throw new Error("db_unavailable");
  return db
    .select()
    .from(entryHealthIssues)
    .where(
      and(
        eq(entryHealthIssues.workspaceId, args.workspaceId),
        eq(entryHealthIssues.entryId, args.entryId),
      ),
    )
    .orderBy(desc(entryHealthIssues.severity), desc(entryHealthIssues.detectedAt));
}

export async function dismissIssue(args: {
  workspaceId: string;
  issueId: string;
  userId: string;
}) {
  if (!db) throw new Error("db_unavailable");
  await db
    .update(entryHealthIssues)
    .set({ dismissedAt: new Date(), dismissedById: args.userId })
    .where(
      and(
        eq(entryHealthIssues.id, args.issueId),
        eq(entryHealthIssues.workspaceId, args.workspaceId),
      ),
    );
}
