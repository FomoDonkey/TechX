/**
 * Engine ejecutor de un Automation.
 *
 * Diseño:
 *  - Un run = registro en `automation_runs` con estado pending → running →
 *    success/failed.
 *  - Cada step se ejecuta secuencialmente. Outputs se acumulan en context y
 *    se persisten en `automation_steps`.
 *  - Los steps soportan templating `{{trigger.payload.x}}` y `{{steps.0.output.y}}`.
 *  - sleep & branch se manejan especialmente:
 *     · sleep N ms → marca el run como pending con nextStepAt = now + N, sale
 *       del runner (otro tick lo retoma).
 *     · branch → ejecuta substeps en su propio "scope" (también persistidos).
 *  - Si un step falla, el run pasa a failed y aborta. (El usuario puede
 *    reintentar manualmente).
 *
 * El runner es invocado por:
 *  - listener.ts → cuando llega un trigger event
 *  - cron /api/cron/automations-process → drena runs pending (sleep, retries)
 */

import { db } from "@/db/client";
import { type Automation, automationRuns, automationSteps, automations } from "@/db/schema";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { executeStep } from "./actions";
import { type RenderContext, evalConditions, renderObject, renderTemplate } from "./templating";
import type { AutomationDefinition, ConditionGroup, Step, Trigger } from "./types";

const MAX_STEPS_PER_RUN = 200;
const MAX_BATCH = 25;

export type StartRunInput = {
  workspaceId: string;
  automationId: string;
  triggerEvent: string;
  triggerPayload?: unknown;
};

export async function startRun(input: StartRunInput): Promise<string | null> {
  if (!db) return null;
  const [auto] = await db
    .select()
    .from(automations)
    .where(
      and(eq(automations.workspaceId, input.workspaceId), eq(automations.id, input.automationId)),
    )
    .limit(1);
  if (!auto || !auto.active) return null;

  // Pre-check de conditions globales antes de crear el run (evita ruido).
  const conditions = (auto.conditions ?? undefined) as ConditionGroup | undefined;
  const ctx: RenderContext = {
    trigger: { event: input.triggerEvent, payload: input.triggerPayload },
    steps: [],
  };
  if (!evalConditions(conditions, ctx)) {
    return null;
  }

  const [run] = await db
    .insert(automationRuns)
    .values({
      workspaceId: input.workspaceId,
      automationId: input.automationId,
      triggerEvent: input.triggerEvent,
      triggerPayload: (input.triggerPayload ?? null) as never,
      status: "pending",
      nextStepIndex: 0,
      context: {
        trigger: { event: input.triggerEvent, payload: input.triggerPayload },
        steps: [],
      } as never,
    })
    .returning({ id: automationRuns.id });

  if (!run) return null;

  // Bump counters (best-effort).
  await db
    .update(automations)
    .set({ runsTotal: sql`${automations.runsTotal} + 1`, lastRunAt: new Date() })
    .where(eq(automations.id, input.automationId));

  // Lanzamos en background (fire and forget). El cron se encargará si crashea.
  void runStepsLoop(run.id, auto).catch((err) =>
    console.error("[automations engine] run error:", err),
  );

  return run.id;
}

/**
 * Loop principal: ejecuta steps desde nextStepIndex hasta encontrar sleep,
 * fin de la lista o fallo.
 */
export async function runStepsLoop(runId: string, autoCached?: Automation): Promise<void> {
  if (!db) return;

  const [run] = await db.select().from(automationRuns).where(eq(automationRuns.id, runId)).limit(1);
  if (!run) return;
  if (run.status === "success" || run.status === "failed" || run.status === "skipped") return;

  let auto = autoCached;
  if (!auto || auto.id !== run.automationId) {
    const [row] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, run.automationId))
      .limit(1);
    auto = row;
  }
  if (!auto) {
    await db
      .update(automationRuns)
      .set({ status: "failed", error: "Automation no encontrada", finishedAt: new Date() })
      .where(eq(automationRuns.id, runId));
    return;
  }

  const def: AutomationDefinition = {
    triggerType: auto.triggerType as AutomationDefinition["triggerType"],
    trigger: auto.trigger as Trigger,
    conditions: (auto.conditions ?? undefined) as ConditionGroup | undefined,
    steps: (auto.actions ?? []) as Step[],
  };

  // Cargamos contexto previo
  const ctx = (run.context ?? {
    trigger: { event: run.triggerEvent, payload: run.triggerPayload },
    steps: [],
  }) as RenderContext;

  // Claim atómico: solo si el run sigue en "pending" o "running" (resume tras crash).
  // Esto previene que dos workers (startRun fire-and-forget + cron) procesen el mismo run.
  const claimed = await db
    .update(automationRuns)
    .set({ status: "running", startedAt: run.startedAt ?? new Date() })
    .where(
      and(
        eq(automationRuns.id, runId),
        or(eq(automationRuns.status, "pending"), eq(automationRuns.status, "running")),
      ),
    )
    .returning({ id: automationRuns.id });
  if (claimed.length === 0) return;

  const startedAt = Date.now();
  let totalExecuted = 0;
  let idx = run.nextStepIndex;

  while (idx < def.steps.length) {
    if (totalExecuted >= MAX_STEPS_PER_RUN) {
      await markFailed(runId, auto.id, `Excedido máximo de ${MAX_STEPS_PER_RUN} steps`);
      return;
    }
    const step = def.steps[idx];
    if (!step) break;

    if (step.type === "sleep") {
      // Defer: marcamos pending y salimos.
      const wakeAt = new Date(Date.now() + Math.max(0, step.ms));
      await db
        .update(automationRuns)
        .set({
          status: "pending",
          nextStepAt: wakeAt,
          nextStepIndex: idx + 1,
          context: ctx as never,
        })
        .where(eq(automationRuns.id, runId));
      // Persistimos el step "sleep" como completado.
      await db.insert(automationSteps).values({
        runId,
        stepIndex: idx,
        type: "sleep",
        name: step.name ?? null,
        status: "success",
        input: { ms: step.ms } as never,
        output: { wakeAt: wakeAt.toISOString() } as never,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 0,
      });
      // Empuja outputs en ctx.steps para alinear índices
      ctx.steps[idx] = { output: { wakeAt: wakeAt.toISOString() } };
      return;
    }

    if (step.type === "branch") {
      const cond = step.conditions;
      const branch = evalConditions(cond, ctx) ? step.then : (step.else ?? []);
      // Persistimos el branch como step
      const stepRow = await persistStepStart(runId, idx, "branch", step.name);
      try {
        for (const sub of branch) {
          totalExecuted++;
          if (totalExecuted >= MAX_STEPS_PER_RUN) {
            throw new Error(`Excedido máximo de ${MAX_STEPS_PER_RUN} steps`);
          }
          if (sub.type === "sleep") {
            // Sleep dentro de branch: persistimos el branch como success y aplicamos defer del run.
            await persistStepEnd(
              stepRow,
              "success",
              { branch: branch === step.then ? "then" : "else", taken: branch.length },
              undefined,
            );
            const wakeAt = new Date(Date.now() + Math.max(0, sub.ms));
            await db
              .update(automationRuns)
              .set({
                status: "pending",
                nextStepAt: wakeAt,
                // Volvemos al step después del branch — los sleeps dentro de branch sólo postponen el siguiente.
                nextStepIndex: idx + 1,
                context: ctx as never,
              })
              .where(eq(automationRuns.id, runId));
            return;
          }
          if (sub.type === "branch") {
            // Branches anidados: evaluamos pero no soportamos sleep dentro de branch anidado.
            const inner = evalConditions(sub.conditions, ctx) ? sub.then : (sub.else ?? []);
            for (const innerStep of inner) {
              if (innerStep.type === "sleep" || innerStep.type === "branch") continue;
              await runOneAction(runId, idx, innerStep, ctx, auto.workspaceId);
            }
            continue;
          }
          await runOneAction(runId, idx, sub, ctx, auto.workspaceId);
        }
        await persistStepEnd(
          stepRow,
          "success",
          { branch: branch === step.then ? "then" : "else", taken: branch.length },
          undefined,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await persistStepEnd(stepRow, "failed", undefined, message);
        await markFailed(runId, auto.id, message);
        return;
      }
      idx++;
      totalExecuted++;
      continue;
    }

    // Step regular (action)
    const stepRow = await persistStepStart(runId, idx, step.type, step.name);
    try {
      const renderedStep = renderObject(step, ctx);
      const result = await executeStep(renderedStep as Step, {
        workspaceId: auto.workspaceId,
        runId,
      });
      await persistStepEnd(stepRow, "success", result.output, undefined);
      ctx.steps[idx] = { output: result.output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await persistStepEnd(stepRow, "failed", undefined, message);
      await markFailed(runId, auto.id, message);
      return;
    }
    idx++;
    totalExecuted++;
  }

  await db
    .update(automationRuns)
    .set({
      status: "success",
      output: ctx as never,
      context: ctx as never,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt,
      nextStepIndex: idx,
    })
    .where(eq(automationRuns.id, runId));
}

async function runOneAction(
  runId: string,
  stepIndex: number,
  step: Step,
  ctx: RenderContext,
  workspaceId: string,
): Promise<void> {
  const stepRow = await persistStepStart(runId, stepIndex, step.type, step.name);
  try {
    const rendered = renderObject(step, ctx);
    const result = await executeStep(rendered as Step, { workspaceId, runId });
    await persistStepEnd(stepRow, "success", result.output, undefined);
    ctx.steps.push({ output: result.output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persistStepEnd(stepRow, "failed", undefined, message);
    throw err;
  }
}

async function persistStepStart(
  runId: string,
  stepIndex: number,
  type: string,
  name: string | undefined,
): Promise<string> {
  if (!db) return "";
  const [row] = await db
    .insert(automationSteps)
    .values({
      runId,
      stepIndex,
      type,
      name: name ?? null,
      status: "running",
      startedAt: new Date(),
    })
    .returning({ id: automationSteps.id });
  return row?.id ?? "";
}

async function persistStepEnd(
  stepRowId: string,
  status: "success" | "failed",
  output: unknown,
  error: string | undefined,
): Promise<void> {
  if (!db || !stepRowId) return;
  const finishedAt = new Date();
  const [existing] = await db
    .select({ startedAt: automationSteps.startedAt })
    .from(automationSteps)
    .where(eq(automationSteps.id, stepRowId))
    .limit(1);
  const durationMs = existing?.startedAt ? finishedAt.getTime() - existing.startedAt.getTime() : 0;
  await db
    .update(automationSteps)
    .set({
      status,
      output: (output ?? null) as never,
      error: error ?? null,
      finishedAt,
      durationMs,
    })
    .where(eq(automationSteps.id, stepRowId));
}

async function markFailed(runId: string, automationId: string, error: string): Promise<void> {
  if (!db) return;
  await db
    .update(automationRuns)
    .set({ status: "failed", error: error.slice(0, 1000), finishedAt: new Date() })
    .where(eq(automationRuns.id, runId));
  await db
    .update(automations)
    .set({ runsFailed: sql`${automations.runsFailed} + 1` })
    .where(eq(automations.id, automationId));
}

// ============================================================
// Cron: drena runs en pending listos para ejecutar
// ============================================================

export type ProcessResult = {
  picked: number;
  succeeded: number;
  failed: number;
  pending: number;
};

export async function processPendingRuns(maxBatch: number = MAX_BATCH): Promise<ProcessResult> {
  if (!db) return { picked: 0, succeeded: 0, failed: 0, pending: 0 };

  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.status, "pending"),
          or(sql`${automationRuns.nextStepAt} IS NULL`, lte(automationRuns.nextStepAt, new Date())),
        ),
      )
      .orderBy(automationRuns.createdAt)
      .limit(maxBatch)
      .for("update", { skipLocked: true });
    if (candidates.length === 0) return [];
    const ids = candidates.map((c) => c.id);
    await tx
      .update(automationRuns)
      .set({ status: "running" })
      .where(
        and(
          eq(automationRuns.status, "pending"),
          sql`${automationRuns.id} IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );
    return ids;
  });

  let succeeded = 0;
  let failed = 0;
  let pending = 0;
  for (const id of claimed) {
    try {
      await runStepsLoop(id);
      const [r] = await db
        .select({ status: automationRuns.status })
        .from(automationRuns)
        .where(eq(automationRuns.id, id))
        .limit(1);
      if (r?.status === "success") succeeded++;
      else if (r?.status === "failed") failed++;
      else pending++;
    } catch (err) {
      console.error("[automations cron] error en run", id, err);
      failed++;
    }
  }

  return { picked: claimed.length, succeeded, failed, pending };
}

/** Helper de testing: ejecuta una automation con un payload simulado SIN persistir. */
export type DryRunResult = {
  steps: Array<{
    index: number;
    type: string;
    status: "success" | "failed" | "skipped";
    output?: unknown;
    error?: string;
    durationMs: number;
  }>;
  finalContext: RenderContext;
};

export async function dryRun(
  automation: {
    workspaceId: string;
    trigger: Trigger;
    conditions?: ConditionGroup | null;
    actions: Step[];
  },
  triggerEvent: string,
  triggerPayload: unknown,
): Promise<DryRunResult> {
  const ctx: RenderContext = {
    trigger: { event: triggerEvent, payload: triggerPayload },
    steps: [],
  };
  const out: DryRunResult["steps"] = [];

  if (!evalConditions(automation.conditions ?? undefined, ctx)) {
    return { steps: [], finalContext: ctx };
  }

  for (let i = 0; i < automation.actions.length; i++) {
    const step = automation.actions[i];
    if (!step) continue;
    const startedAt = Date.now();
    if (step.type === "sleep") {
      out.push({
        index: i,
        type: "sleep",
        status: "success",
        output: { skipped: true },
        durationMs: 0,
      });
      ctx.steps[i] = { output: { skipped: true } };
      continue;
    }
    if (step.type === "branch") {
      const taken = evalConditions(step.conditions, ctx) ? "then" : "else";
      out.push({
        index: i,
        type: "branch",
        status: "success",
        output: { taken },
        durationMs: 0,
      });
      ctx.steps[i] = { output: { taken } };
      continue;
    }
    try {
      const rendered = renderObject(step, ctx);
      const result = await executeStep(rendered as Step, {
        workspaceId: automation.workspaceId,
        runId: "dry",
      });
      out.push({
        index: i,
        type: step.type,
        status: "success",
        output: result.output,
        durationMs: Date.now() - startedAt,
      });
      ctx.steps[i] = { output: result.output };
    } catch (err) {
      out.push({
        index: i,
        type: step.type,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      });
      break;
    }
  }
  return { steps: out, finalContext: ctx };
}

// Re-export helper en caso de necesitar interpolación fuera del engine.
export { renderTemplate };
