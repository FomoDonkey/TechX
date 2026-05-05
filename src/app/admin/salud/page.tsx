import { Badge } from "@/components/ui/badge";
import { ISSUE_TYPE_LABEL, getWorkspaceHealthSummary, listEntriesByHealth } from "@/health";
import { requireWorkspace } from "@/lib/workspace";
import { Activity, AlertTriangle, Heart, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { HealthDashboard } from "./client";

export const metadata: Metadata = { title: "Salud del contenido · CSM" };
export const dynamic = "force-dynamic";

export default async function SaludPage() {
  const ctx = await requireWorkspace("editor");
  const summary = await getWorkspaceHealthSummary(ctx.workspace.id);
  const entries = await listEntriesByHealth({
    workspaceId: ctx.workspace.id,
    limit: 100,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge className="border-transparent bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] text-white">
            ✦ Único en CMS open-source 2026
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Salud del contenido</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Una IA y un set de heurísticas revisan tu contenido publicado cada lunes y detectan
            enlaces rotos, fechas obsoletas, problemas SEO y de accesibilidad. Trata cada issue como
            sugerencia: descártalo si no aplica.
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <ScoreRing score={summary.avgScore} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Heart}
          label="Score promedio"
          value={summary.avgScore.toString()}
          unit="/100"
          tone={summary.avgScore >= 85 ? "ok" : summary.avgScore >= 65 ? "warn" : "critical"}
        />
        <KpiCard
          icon={Activity}
          label="Entradas escaneadas"
          value={summary.totalScanned.toString()}
          tone="neutral"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Issues abiertos"
          value={Object.values(summary.issuesBySeverity)
            .reduce((a, b) => a + b, 0)
            .toString()}
          tone={
            summary.issuesBySeverity.critical + summary.issuesBySeverity.high > 0 ? "warn" : "ok"
          }
        />
        <KpiCard
          icon={Sparkles}
          label="Críticos / Altos"
          value={`${summary.issuesBySeverity.critical} / ${summary.issuesBySeverity.high}`}
          tone={
            summary.issuesBySeverity.critical > 0
              ? "critical"
              : summary.issuesBySeverity.high > 0
                ? "warn"
                : "ok"
          }
        />
      </section>

      {Object.keys(summary.issuesByType).length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Por tipo de issue
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(summary.issuesByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, n]) => (
                <li
                  key={type}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <span>{ISSUE_TYPE_LABEL[type as keyof typeof ISSUE_TYPE_LABEL] ?? type}</span>
                  <span className="font-mono text-xs text-muted-foreground">{n}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <HealthDashboard
        entries={entries.map((e) => ({
          entryId: e.entryId,
          title: e.title,
          slug: e.slug,
          status: e.status,
          score: e.score,
          counts: e.counts,
          scannedAt: e.scannedAt.toISOString(),
        }))}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  unit?: string;
  tone: "ok" | "warn" | "critical" | "neutral";
}) {
  const ring = {
    ok: "border-emerald-500/30",
    warn: "border-amber-500/30",
    critical: "border-destructive/30",
    neutral: "border-border",
  }[tone];
  const iconBg = {
    ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    critical: "bg-destructive/15 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className={`rounded-xl border bg-card p-4 ${ring}`}>
      <div className="flex items-center gap-2">
        <div className={`grid size-8 place-items-center rounded-md ${iconBg}`}>
          <Icon className="size-4" />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color =
    score >= 85 ? "stroke-emerald-500" : score >= 65 ? "stroke-amber-500" : "stroke-destructive";
  return (
    <div className="relative grid size-20 place-items-center">
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0 -rotate-90"
        role="img"
        aria-label={`Score promedio: ${score} de 100`}
      >
        <title>Score {score}/100</title>
        <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={`fill-none ${color}`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="text-lg font-semibold">{score}</span>
    </div>
  );
}
