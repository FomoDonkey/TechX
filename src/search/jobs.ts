/**
 * Procesamiento de embeddings: encolar + ejecutar.
 *
 * Patrón:
 *  - `enqueueIndex(entryId)` se llama desde saveEntryAction (upsert en search_index_jobs).
 *  - `processIndexJobs()` toma N pendientes, embebe el bodyText y actualiza entries.embedding.
 *    Lo ejecuta tanto un cron (futuro) como un endpoint manual `/api/admin/ai/process-jobs`.
 */

import { embed } from "@/ai/embeddings";
import { db } from "@/db/client";
import { vectorLiteral } from "@/db/dialect";
import { entries, searchIndexJobs } from "@/db/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

export type ProcessResult = {
  processed: number;
  errors: number;
  skipped: number;
};

const MAX_ATTEMPTS = 3;

export async function enqueueIndex(input: {
  workspaceId: string;
  entryId: string;
}): Promise<void> {
  if (!db) return;
  // F9b: NO indexar forks de branches — su contenido no debe aparecer en search
  // ni en RAG (Ask CSM). Verificar branchId antes de encolar.
  const [meta] = await db
    .select({ branchId: entries.branchId })
    .from(entries)
    .where(and(eq(entries.id, input.entryId), eq(entries.workspaceId, input.workspaceId)))
    .limit(1);
  if (!meta) return;
  if (meta.branchId !== null) return;
  await db
    .insert(searchIndexJobs)
    .values({
      workspaceId: input.workspaceId,
      entryId: input.entryId,
      status: "queued",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: searchIndexJobs.entryId,
      set: {
        status: "queued",
        attempts: 0,
        error: null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Procesa hasta `batchSize` jobs pendientes (queued o error con attempts < MAX_ATTEMPTS).
 *
 * IMPORTANTE: cuando se invoca desde un endpoint admin (no cron), pasar
 * `workspaceId` para evitar que un editor de wsA gaste presupuesto de
 * embeddings procesando jobs de wsB (multi-tenant compute leak). El cron
 * global puede llamar sin filtro.
 *
 * Diseño: marca como "processing" via UPDATE atómico + SKIP LOCKED para
 * soportar workers paralelos.
 */
export async function processIndexJobs(
  batchSize = 10,
  workspaceId?: string,
): Promise<ProcessResult> {
  if (!db) return { processed: 0, errors: 0, skipped: 0 };
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  // Tomamos el lote en una sola transacción con FOR UPDATE SKIP LOCKED via API tipada de Drizzle.
  let claimedIds: string[] = [];
  await db.transaction(async (tx) => {
    const conds = [
      inArray(searchIndexJobs.status, ["queued", "error"] as const),
      sql`${searchIndexJobs.attempts} < ${MAX_ATTEMPTS}`,
    ];
    if (workspaceId) conds.push(eq(searchIndexJobs.workspaceId, workspaceId));
    const claimed = await tx
      .select({ id: searchIndexJobs.id })
      .from(searchIndexJobs)
      .where(and(...conds))
      .orderBy(asc(searchIndexJobs.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });
    claimedIds = claimed.map((c) => c.id);
    if (claimedIds.length > 0) {
      await tx
        .update(searchIndexJobs)
        .set({ status: "processing", updatedAt: new Date() })
        .where(inArray(searchIndexJobs.id, claimedIds));
    }
  });

  for (const jobId of claimedIds) {
    const job = (
      await db.select().from(searchIndexJobs).where(eq(searchIndexJobs.id, jobId)).limit(1)
    )[0];
    if (!job) {
      skipped++;
      continue;
    }
    try {
      const entry = (
        await db
          .select({
            id: entries.id,
            workspaceId: entries.workspaceId,
            branchId: entries.branchId,
            title: entries.title,
            excerpt: entries.excerpt,
            bodyText: entries.bodyText,
          })
          .from(entries)
          .where(and(eq(entries.id, job.entryId), eq(entries.workspaceId, job.workspaceId)))
          .limit(1)
      )[0];

      if (!entry) {
        await db
          .update(searchIndexJobs)
          .set({ status: "done", error: "entry not found", updatedAt: new Date() })
          .where(eq(searchIndexJobs.id, job.id));
        skipped++;
        continue;
      }

      // F9b: defense-in-depth — `enqueueIndex` ya filtra forks, pero un job legacy
      // pre-fix pudo haberse creado para una entry que después se forkeó. Skip aquí
      // sin gastar API calls.
      if (entry.branchId !== null) {
        await db
          .update(searchIndexJobs)
          .set({ status: "done", error: "fork (skipped)", updatedAt: new Date() })
          .where(eq(searchIndexJobs.id, job.id));
        skipped++;
        continue;
      }

      const text = [entry.title, entry.excerpt ?? "", entry.bodyText ?? ""]
        .filter(Boolean)
        .join("\n\n")
        .trim();

      if (!text) {
        await db
          .update(searchIndexJobs)
          .set({ status: "done", error: null, updatedAt: new Date() })
          .where(eq(searchIndexJobs.id, job.id));
        skipped++;
        continue;
      }

      const { vector } = await embed(text);
      // vectorLiteral genera el SQL fragment correcto por dialect:
      // pgvector → '[v]'::vector, MySQL 9 → STRING_TO_VEC('[v]').
      await db
        .update(entries)
        .set({ embedding: vectorLiteral(vector) as never, updatedAt: new Date() })
        .where(eq(entries.id, entry.id));

      await db
        .update(searchIndexJobs)
        .set({ status: "done", error: null, updatedAt: new Date() })
        .where(eq(searchIndexJobs.id, job.id));
      processed++;
    } catch (err) {
      errors++;
      await db
        .update(searchIndexJobs)
        .set({
          status: "error",
          attempts: sql`${searchIndexJobs.attempts} + 1`,
          error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(searchIndexJobs.id, jobId));
    }
  }

  return { processed, errors, skipped };
}

/** Re-encola TODAS las entradas publicadas del workspace (para "reindexar todo"). */
export async function reindexWorkspace(workspaceId: string): Promise<number> {
  if (!db) return 0;
  // F9b: reindex sólo entries de main; los forks de branches no se indexan.
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceId, workspaceId),
        eq(entries.status, "published"),
        isNull(entries.branchId),
      ),
    );
  for (const r of rows) {
    await enqueueIndex({ workspaceId, entryId: r.id });
  }
  return rows.length;
}
