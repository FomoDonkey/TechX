import { getKeyForWorkspace, listKeyAudit } from "@/api/keys";
import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { apiKeyAudit } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, gte, sql } from "drizzle-orm";
import { ArrowLeft, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuditTimeline, RotateKeyButton } from "./client";

export const metadata: Metadata = { title: "API Key · techx" };
export const dynamic = "force-dynamic";

const STATUS_TONE = (code: number): "ok" | "warn" | "err" => {
  if (code >= 500) return "err";
  if (code >= 400) return "warn";
  return "ok";
};

export default async function ApiKeyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await requireWorkspace("admin");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const key = await getKeyForWorkspace(ctx.workspace.id, id);
  if (!key) notFound();

  const audit = (await listKeyAudit(ctx.workspace.id, id, 100)) as Array<{
    id: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    denyReason: string | null;
    ipHash: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;

  // Histograma últimos 14 días — sparkline visual del uso reciente.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 13);
  const histRows = db
    ? ((await db
        .select({
          day: sql<string>`to_char(${apiKeyAudit.createdAt}, 'YYYY-MM-DD')`,
          total: sql<number>`COUNT(*)::int`,
          errors: sql<number>`SUM(CASE WHEN ${apiKeyAudit.statusCode} >= 400 THEN 1 ELSE 0 END)::int`,
        })
        .from(apiKeyAudit)
        .where(and(eq(apiKeyAudit.apiKeyId, id), gte(apiKeyAudit.createdAt, since)))
        .groupBy(sql`to_char(${apiKeyAudit.createdAt}, 'YYYY-MM-DD')`)) as Array<{
        day: string;
        total: number;
        errors: number;
      }>)
    : [];

  // Rellena días faltantes con 0 para sparkline regular.
  const histMap = new Map(histRows.map((r) => [r.day, r] as const));
  const sparkData: Array<{ day: string; total: number; errors: number }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    sparkData.push(histMap.get(key) ?? { day: key, total: 0, errors: 0 });
  }
  const maxDay = Math.max(1, ...sparkData.map((d) => d.total));

  const isRevoked = !!key.revokedAt;
  const isExpired = key.expiresAt && key.expiresAt < new Date();
  const status = isRevoked ? "Revocada" : isExpired ? "Expirada" : "Activa";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <Link
        href="/admin/api-keys"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver a API keys
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{key.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-0.5 text-xs">
                {key.prefix}
                <span className="text-muted-foreground">…</span>
              </code>
              <Badge
                variant={key.environment === "live" ? "default" : "outline"}
                className="text-[10px]"
              >
                {key.environment}
              </Badge>
              <Badge
                variant={isRevoked || isExpired ? "destructive" : "default"}
                className="text-[10px]"
              >
                {status}
              </Badge>
            </div>
            {key.description && (
              <p className="max-w-xl text-sm text-muted-foreground">{key.description}</p>
            )}
          </div>
        </div>
        <RotateKeyButton id={id} disabled={isRevoked} />
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoy</p>
          <p className="text-2xl font-semibold tabular-nums">
            {key.requestsToday.toLocaleString("es")}
          </p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold tabular-nums">
            {key.requestsTotal.toLocaleString("es")}
          </p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Rate limit</p>
          <p className="text-2xl font-semibold tabular-nums">
            {key.rateLimit.toLocaleString("es")}/h
          </p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Última call</p>
          <p className="text-sm">
            {key.lastUsedAt
              ? new Date(key.lastUsedAt).toLocaleString("es-ES", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—"}
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Uso últimos 14 días</h2>
          <p className="text-xs text-muted-foreground">
            {sparkData.reduce((s, d) => s + d.total, 0).toLocaleString("es")} calls
          </p>
        </div>
        <Card className="p-4">
          <div className="flex items-end gap-1 h-24">
            {sparkData.map((d) => {
              const h = (d.total / maxDay) * 100;
              const errorH = (d.errors / Math.max(1, d.total)) * h;
              return (
                <div
                  key={d.day}
                  className="flex-1 flex flex-col-reverse"
                  title={`${d.day}: ${d.total} calls (${d.errors} errores)`}
                >
                  <div className="rounded-sm bg-primary/40" style={{ height: `${h - errorH}%` }} />
                  {d.errors > 0 && (
                    <div className="rounded-sm bg-rose-500/70" style={{ height: `${errorH}%` }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>{sparkData[0]?.day}</span>
            <span>hoy</span>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Timeline ({audit.length})</h2>
          <a
            href={`/api/admin/api-keys/${id}/audit.csv`}
            className="text-xs text-muted-foreground hover:text-foreground"
            download
          >
            Exportar CSV
          </a>
        </div>
        <AuditTimeline
          rows={audit.map((r) => ({
            id: r.id,
            method: r.method,
            path: r.path,
            statusCode: r.statusCode,
            durationMs: r.durationMs,
            denyReason: r.denyReason,
            ipHash: r.ipHash,
            userAgent: r.userAgent,
            createdAtIso: r.createdAt.toISOString(),
            tone: STATUS_TONE(r.statusCode),
          }))}
        />
      </section>
    </div>
  );
}
