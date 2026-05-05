/**
 * Tracking de uso de IA con rate-limit por user/día y cost cap por workspace/mes.
 *
 * **Diseño**:
 * - Una llamada AI invoca `recordAiUsage()` antes (con `costMicrosUsd` estimado)
 *   o después (con coste real si el provider devuelve tokens).
 * - `checkAiBudget()` chequea si el workspace puede seguir gastando — devuelve
 *   `ok` + `state` (`ok` | `warn` | `block`).
 * - `checkUserDailyLimit()` chequea cuota por user/día (defaults: 100 inline, 50 ask).
 *
 * **Política**:
 * - Free workspaces: budget mensual fijo en env (`AI_BUDGET_FREE_USD_MICROS`,
 *   default 1 USD = 1_000_000 micros). Block hard al alcanzar 100%.
 * - Workspaces de pago: budget configurable en `settings` con key `ai_budget`.
 *   Soft warn a 80% (no bloquea, sólo advierte por email + UI), block hard a 100%.
 *
 * **Por qué cap doble (per-user diario + workspace mensual)**:
 * Un solo cap por workspace deja a un user malicioso/bug consumir todo el
 * budget en un día. El cap diario por user es la primera barrera; el monthly
 * por workspace es la segunda.
 */

import { db } from "@/db/client";
import { aiUsageDaily, settings } from "@/db/schema";
import { and, between, eq, sql } from "drizzle-orm";

export type AiFeature = "inline" | "ask" | "agent" | "moderation" | "embeddings" | "vision";

const DEFAULT_PER_USER_DAILY: Record<AiFeature, number> = {
  inline: 100,
  ask: 50,
  agent: 30,
  moderation: 0, // sin cap — auto en backend
  embeddings: 0, // background
  vision: 50,
};

/** 1 USD por defecto para free tier. Configurable por workspace. */
const DEFAULT_MONTHLY_BUDGET_MICROS = 1_000_000; // 1 USD
const SOFT_WARN_PCT = 0.8;

export type AiBudgetConfig = {
  /** Budget mensual en micro-USD. 0 = ilimitado (sólo per-user cap aplica). */
  monthlyBudgetMicros: number;
  /** Email avisar a este % de consumo. 0..1. */
  alertAtPct: number;
  /** Hard block al alcanzar el budget? (vs sólo warn). */
  hardBlock: boolean;
  /** Override per-feature daily limit. Null deja default. */
  perUserDailyLimits?: Partial<Record<AiFeature, number>>;
};

export const DEFAULT_AI_BUDGET: AiBudgetConfig = {
  monthlyBudgetMicros: DEFAULT_MONTHLY_BUDGET_MICROS,
  alertAtPct: SOFT_WARN_PCT,
  hardBlock: true,
};

const AI_BUDGET_SETTINGS_KEY = "ai_budget";

export type AiUsageCheck =
  | { ok: true; state: "ok" | "warn"; spentMicros: number; budgetMicros: number; pct: number }
  | {
      ok: false;
      state: "block";
      reason: "monthly_cap" | "user_daily_cap";
      retryAfterSeconds: number;
      spentMicros?: number;
      budgetMicros?: number;
    };

export async function getAiBudget(workspaceId: string): Promise<AiBudgetConfig> {
  if (!db) return DEFAULT_AI_BUDGET;
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, AI_BUDGET_SETTINGS_KEY)))
      .limit(1);
    if (!row?.value || typeof row.value !== "object") return DEFAULT_AI_BUDGET;
    const v = row.value as Record<string, unknown>;
    return {
      monthlyBudgetMicros:
        typeof v.monthlyBudgetMicros === "number" && v.monthlyBudgetMicros >= 0
          ? v.monthlyBudgetMicros
          : DEFAULT_AI_BUDGET.monthlyBudgetMicros,
      alertAtPct:
        typeof v.alertAtPct === "number" && v.alertAtPct >= 0 && v.alertAtPct <= 1
          ? v.alertAtPct
          : DEFAULT_AI_BUDGET.alertAtPct,
      hardBlock: typeof v.hardBlock === "boolean" ? v.hardBlock : DEFAULT_AI_BUDGET.hardBlock,
      ...(v.perUserDailyLimits && typeof v.perUserDailyLimits === "object"
        ? { perUserDailyLimits: v.perUserDailyLimits as Partial<Record<AiFeature, number>> }
        : {}),
    };
  } catch {
    return DEFAULT_AI_BUDGET;
  }
}

export async function setAiBudget(workspaceId: string, config: AiBudgetConfig): Promise<void> {
  if (!db) return;
  if (config.monthlyBudgetMicros < 0 || config.alertAtPct < 0 || config.alertAtPct > 1) {
    throw new Error("Config inválida");
  }
  await db
    .insert(settings)
    .values({
      workspaceId,
      key: AI_BUDGET_SETTINGS_KEY,
      value: config,
    })
    .onConflictDoUpdate({
      target: [settings.workspaceId, settings.key],
      set: { value: config },
    });
}

/**
 * Chequea cuota antes de una call. Combina cap mensual workspace + cap diario user.
 * El caller debería invocar esto ANTES de hacer la call al provider — si block,
 * devuelve 429 al cliente sin gastar tokens.
 */
export async function checkAiBudget(input: {
  workspaceId: string;
  userId?: string | null;
  feature: AiFeature;
}): Promise<AiUsageCheck> {
  if (!db) return { ok: true, state: "ok", spentMicros: 0, budgetMicros: 0, pct: 0 };

  const budget = await getAiBudget(input.workspaceId);

  // Per-user daily cap.
  if (input.userId) {
    const limit =
      budget.perUserDailyLimits?.[input.feature] ?? DEFAULT_PER_USER_DAILY[input.feature];
    if (limit > 0) {
      const today = todayUtc();
      const [row] = await db
        .select({ calls: aiUsageDaily.callsCount })
        .from(aiUsageDaily)
        .where(
          and(
            eq(aiUsageDaily.workspaceId, input.workspaceId),
            eq(aiUsageDaily.userId, input.userId),
            eq(aiUsageDaily.day, today),
            eq(aiUsageDaily.feature, input.feature),
          ),
        )
        .limit(1);
      if (row && row.calls >= limit) {
        return {
          ok: false,
          state: "block",
          reason: "user_daily_cap",
          retryAfterSeconds: secondsUntilNextUtcMidnight(),
        };
      }
    }
  }

  // Workspace monthly cap.
  if (budget.monthlyBudgetMicros > 0) {
    const spent = await getMonthlySpend(input.workspaceId);
    const pct = spent / budget.monthlyBudgetMicros;
    if (budget.hardBlock && spent >= budget.monthlyBudgetMicros) {
      return {
        ok: false,
        state: "block",
        reason: "monthly_cap",
        retryAfterSeconds: secondsUntilNextMonthUtc(),
        spentMicros: spent,
        budgetMicros: budget.monthlyBudgetMicros,
      };
    }
    return {
      ok: true,
      state: pct >= budget.alertAtPct ? "warn" : "ok",
      spentMicros: spent,
      budgetMicros: budget.monthlyBudgetMicros,
      pct,
    };
  }

  return { ok: true, state: "ok", spentMicros: 0, budgetMicros: 0, pct: 0 };
}

/**
 * Registra una call. Idempotente vía UPSERT en `(ws, user, day, feature)`.
 * `costMicrosUsd` puede ser estimado o real. Si el provider devuelve tokens,
 * el caller debe traducir a micros antes de invocar.
 */
export async function recordAiUsage(input: {
  workspaceId: string;
  userId?: string | null;
  feature: AiFeature;
  /** Micro-USD. Puede ser 0 si no hay coste asociado (e.g., heuristic-only). */
  costMicrosUsd?: number;
  /** Calls a sumar (default 1). */
  calls?: number;
}): Promise<void> {
  if (!db) return;
  const today = todayUtc();
  const calls = input.calls ?? 1;
  const cost = Math.max(0, Math.floor(input.costMicrosUsd ?? 0));

  try {
    // UPSERT atómico — el unique index permite el ON CONFLICT.
    // userId NULL se trata como "" via COALESCE en el index.
    await db.execute(sql`
      INSERT INTO ai_usage_daily (workspace_id, user_id, day, feature, calls_count, cost_micros_usd, updated_at)
      VALUES (${input.workspaceId}::uuid, ${input.userId ?? null}, ${today}, ${input.feature}, ${calls}, ${cost}, NOW())
      ON CONFLICT (workspace_id, COALESCE(user_id, ''), day, feature)
      DO UPDATE SET
        calls_count = ai_usage_daily.calls_count + ${calls},
        cost_micros_usd = ai_usage_daily.cost_micros_usd + ${cost},
        updated_at = NOW()
    `);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[ai/usage] record failed", err);
  }
}

async function getMonthlySpend(workspaceId: string): Promise<number> {
  if (!db) return 0;
  const start = startOfMonthUtc();
  const end = endOfMonthUtc();
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${aiUsageDaily.costMicrosUsd}), 0)::int`,
    })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.workspaceId, workspaceId), between(aiUsageDaily.day, start, end)));
  return Number(row?.total ?? 0);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function endOfMonthUtc(): string {
  const d = new Date();
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}
function secondsUntilNextUtcMidnight(): number {
  const now = Date.now();
  const next = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((next - now) / 1000));
}
function secondsUntilNextMonthUtc(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
  return Math.max(60, Math.floor((next.valueOf() - now.valueOf()) / 1000));
}

/**
 * Resumen del workspace para la UI `/admin/ajustes/ia`. Devuelve uso de mes
 * actual desglosado por feature + total monthly + top 5 users.
 */
export async function getAiUsageSummary(workspaceId: string): Promise<{
  monthlyMicros: number;
  budgetMicros: number;
  pct: number;
  byFeature: Array<{ feature: string; calls: number; micros: number }>;
  topUsers: Array<{ userId: string | null; calls: number; micros: number }>;
}> {
  if (!db) {
    return { monthlyMicros: 0, budgetMicros: 0, pct: 0, byFeature: [], topUsers: [] };
  }
  const start = startOfMonthUtc();
  const end = endOfMonthUtc();
  const budget = await getAiBudget(workspaceId);

  const featureRows = (await db
    .select({
      feature: aiUsageDaily.feature,
      calls: sql<number>`SUM(${aiUsageDaily.callsCount})::int`,
      micros: sql<number>`SUM(${aiUsageDaily.costMicrosUsd})::int`,
    })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.workspaceId, workspaceId), between(aiUsageDaily.day, start, end)))
    .groupBy(aiUsageDaily.feature)) as Array<{ feature: string; calls: number; micros: number }>;

  const userRows = (await db
    .select({
      userId: aiUsageDaily.userId,
      calls: sql<number>`SUM(${aiUsageDaily.callsCount})::int`,
      micros: sql<number>`SUM(${aiUsageDaily.costMicrosUsd})::int`,
    })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.workspaceId, workspaceId), between(aiUsageDaily.day, start, end)))
    .groupBy(aiUsageDaily.userId)
    .orderBy(sql`SUM(${aiUsageDaily.callsCount}) DESC`)
    .limit(5)) as Array<{ userId: string | null; calls: number; micros: number }>;

  const monthlyMicros = featureRows.reduce((s, r) => s + Number(r.micros), 0);
  const pct = budget.monthlyBudgetMicros > 0 ? monthlyMicros / budget.monthlyBudgetMicros : 0;

  return {
    monthlyMicros,
    budgetMicros: budget.monthlyBudgetMicros,
    pct,
    byFeature: featureRows.map((r) => ({
      feature: r.feature,
      calls: Number(r.calls),
      micros: Number(r.micros),
    })),
    topUsers: userRows,
  };
}
