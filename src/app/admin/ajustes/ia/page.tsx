import { DEFAULT_AI_BUDGET, getAiBudget, getAiUsageSummary } from "@/ai/usage";
import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BudgetForm } from "./client";
import { AiProvidersForm, type ProviderId } from "./providers-form";

export const metadata: Metadata = { title: "IA · CSM" };
export const dynamic = "force-dynamic";

const FEATURE_LABEL: Record<string, string> = {
  inline: "Editor Inline",
  ask: "Ask CSM",
  agent: "Agente",
  moderation: "Moderación",
  embeddings: "Búsqueda semántica",
  vision: "Vision (alt-text)",
};

function microsToUsd(micros: number): string {
  return `${(micros / 1_000_000).toFixed(4)} USD`;
}

export default async function AiPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");
  const ctx = await requireWorkspace("admin");

  const [budget, usage] = await Promise.all([
    getAiBudget(ctx.workspace.id),
    getAiUsageSummary(ctx.workspace.id),
  ]);

  // Resolve nombres de top users
  const userIds = usage.topUsers.map((u) => u.userId).filter((id): id is string => Boolean(id));
  const userMap = new Map<string, { name: string | null; email: string }>();
  if (userIds.length > 0) {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const r of rows) userMap.set(r.id, { name: r.name, email: r.email });
  }

  const isDefault =
    budget.monthlyBudgetMicros === DEFAULT_AI_BUDGET.monthlyBudgetMicros &&
    budget.alertAtPct === DEFAULT_AI_BUDGET.alertAtPct &&
    budget.hardBlock === DEFAULT_AI_BUDGET.hardBlock;

  // El provider activo viene del workspace (default "groq" si no está set).
  const activeProviderRaw = ctx.workspace.aiProvider ?? "anthropic";
  const SUPPORTED: ProviderId[] = ["anthropic", "openai", "xai", "openrouter", "ollama"];
  const initialActive: ProviderId = SUPPORTED.includes(activeProviderRaw as ProviderId)
    ? (activeProviderRaw as ProviderId)
    : "anthropic";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inteligencia Artificial</h1>
        <p className="text-sm text-muted-foreground">
          Configura el proveedor activo (Anthropic, OpenAI, Grok, OpenRouter, Ollama local) y
          revisa el uso y presupuesto de tu workspace.
        </p>
      </header>

      {/* Proveedores AI — selector + API keys + auto-detección Ollama */}
      <AiProvidersForm initialActiveProvider={initialActive} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mes actual</p>
          <p className="text-2xl font-semibold tabular-nums">{microsToUsd(usage.monthlyMicros)}</p>
          {budget.monthlyBudgetMicros > 0 && (
            <p className="text-xs text-muted-foreground">
              {(usage.pct * 100).toFixed(1)}% de {microsToUsd(budget.monthlyBudgetMicros)}
            </p>
          )}
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
          <p className="text-lg font-semibold">
            {usage.pct >= 1 ? (
              <span className="text-rose-600 dark:text-rose-400">Bloqueado</span>
            ) : usage.pct >= budget.alertAtPct ? (
              <span className="text-amber-600 dark:text-amber-400">Aviso</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
            )}
          </p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Calls totales</p>
          <p className="text-2xl font-semibold tabular-nums">
            {usage.byFeature.reduce((s, f) => s + f.calls, 0).toLocaleString("es")}
          </p>
        </Card>
      </section>

      {budget.monthlyBudgetMicros > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Consumo del mes</h2>
            <Badge
              variant={
                usage.pct >= 1
                  ? "destructive"
                  : usage.pct >= budget.alertAtPct
                    ? "outline"
                    : "default"
              }
            >
              {(usage.pct * 100).toFixed(0)}%
            </Badge>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full border">
            <div
              className={`absolute inset-y-0 left-0 ${
                usage.pct >= 1
                  ? "bg-rose-500"
                  : usage.pct >= budget.alertAtPct
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, usage.pct * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {microsToUsd(usage.monthlyMicros)} de {microsToUsd(budget.monthlyBudgetMicros)} mensual
          </p>
        </section>
      )}

      <Card className="p-6">
        <BudgetForm initial={budget} isDefault={isDefault} />
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Por feature</h2>
        {usage.byFeature.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">Sin uso de IA este mes.</Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Feature</th>
                  <th className="px-3 py-2 font-medium">Calls</th>
                  <th className="px-3 py-2 font-medium">Coste</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usage.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td className="px-3 py-2 font-medium">
                      {FEATURE_LABEL[f.feature] ?? f.feature}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{f.calls.toLocaleString("es")}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {microsToUsd(f.micros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usage.topUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Top usuarios</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 font-medium">Calls</th>
                  <th className="px-3 py-2 font-medium">Coste</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usage.topUsers.map((u) => {
                  const info = u.userId ? userMap.get(u.userId) : null;
                  return (
                    <tr key={u.userId ?? "system"}>
                      <td className="px-3 py-2">
                        {info ? (
                          (info.name ?? info.email)
                        ) : (
                          <span className="text-muted-foreground">Sistema</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{u.calls.toLocaleString("es")}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {microsToUsd(u.micros)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/ajustes" className="hover:underline">
          ← Volver a ajustes
        </Link>
      </p>
    </div>
  );
}
