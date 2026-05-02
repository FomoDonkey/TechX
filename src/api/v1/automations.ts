import type { ApiContext } from "@/api/runtime";
import { paginatedResponseSchema } from "@/api/schemas";
import { getAutomationById, getRunWithSteps, listAutomations, listRuns } from "@/automations/lib";
import { z } from "zod";

export const AutomationResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  triggerType: z.enum(["event", "form_submit", "cron", "webhook_in", "manual"]),
  active: z.boolean(),
  runsTotal: z.number().int(),
  runsFailed: z.number().int(),
  lastRunAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListAutomationsResponseSchema = paginatedResponseSchema(AutomationResourceSchema);

export async function listAutomationsHandler({ ctx }: { ctx: ApiContext }) {
  const rows = await listAutomations(ctx.workspaceId);
  return {
    data: rows.map(serializeAutomation),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const AutomationDetailParams = z.object({ id: z.string().uuid() });

export async function getAutomationHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const a = await getAutomationById(ctx.workspaceId, params.id);
  if (!a) return null;
  return serializeAutomation(a);
}

export const RunResourceSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "running", "success", "failed", "skipped"]),
  triggerEvent: z.string(),
  durationMs: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
  steps: z
    .array(
      z.object({
        index: z.number().int(),
        type: z.string(),
        status: z.string(),
        durationMs: z.number().int().nullable(),
        error: z.string().nullable(),
      }),
    )
    .optional(),
});

export const ListRunsResponseSchema = paginatedResponseSchema(RunResourceSchema);

export async function listRunsHandler({
  params,
  ctx,
}: {
  params: { id: string };
  ctx: ApiContext;
}) {
  const rows = await listRuns(ctx.workspaceId, params.id, 50);
  return {
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      triggerEvent: r.triggerEvent,
      durationMs: r.durationMs,
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
      error: r.error,
    })),
    meta: { nextCursor: null, hasMore: false, count: rows.length },
  };
}

export const RunDetailParams = z.object({ id: z.string().uuid(), runId: z.string().uuid() });

export async function getRunHandler({
  params,
  ctx,
}: {
  params: { id: string; runId: string };
  ctx: ApiContext;
}) {
  const r = await getRunWithSteps(ctx.workspaceId, params.runId);
  if (!r || r.run.automationId !== params.id) return null;
  return {
    id: r.run.id,
    status: r.run.status,
    triggerEvent: r.run.triggerEvent,
    durationMs: r.run.durationMs,
    startedAt: r.run.startedAt?.toISOString() ?? null,
    finishedAt: r.run.finishedAt?.toISOString() ?? null,
    error: r.run.error,
    steps: r.steps.map((s) => ({
      index: s.stepIndex,
      type: s.type,
      status: s.status,
      durationMs: s.durationMs,
      error: s.error,
    })),
  };
}

function serializeAutomation(a: Awaited<ReturnType<typeof listAutomations>>[number]) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    triggerType: a.triggerType as "event" | "form_submit" | "cron" | "webhook_in" | "manual",
    active: a.active,
    runsTotal: a.runsTotal,
    runsFailed: a.runsFailed,
    lastRunAt: a.lastRunAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
