/**
 * Procesamiento de embeddings: encolar + ejecutar.
 *
 * Patrón:
 *  - `enqueueIndex(entryId)` se llama desde saveEntryAction (upsert en search_index_jobs).
 *  - `processIndexJobs()` toma N pendientes, embebe el bodyText y actualiza entries.embedding.
 *    Lo ejecuta tanto un cron (futuro) como un endpoint manual `/api/admin/ai/process-jobs`.
 */

import { embed, vectorToSql } from "@/ai/embeddings";
import { db } from "@/db/client";
import { entries, searchIndexJobs } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

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
 * Diseño: marca como "processing" via UPDATE atómico + SKIP LOCKED para soportar workers paralelos.
 */
export async function processIndexJobs(batchSize = 10): Promise<ProcessResult> {
  if (!db) return { processed: 0, errors: 0, skipped: 0 };
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  // Tomamos el lote en una sola transacción con FOR UPDATE SKIP LOCKED via API tipada de Drizzle.
  let claimedIds: string[] = [];
  await db.transaction(async (tx) => {
    const claimed = await tx
      .select({ id: searchIndexJobs.id })
      .from(searchIndexJobs)
      .where(
        and(
          inArray(searchIndexJobs.status, ["queued", "error"]),
          sql`${searchIndexJobs.attempts} < ${MAX_ATTEMPTS}`,
        ),
      )
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
      const vsql = vectorToSql(vector);
      await db
        .update(entries)
        .set({ embedding: sql`${vsql}::vector` as never, updatedAt: new Date() })
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
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.workspaceId, workspaceId), eq(entries.status, "published")));
  for (const r of rows) {
    await enqueueIndex({ workspaceId, entryId: r.id });
  }
  return rows.length;
}
