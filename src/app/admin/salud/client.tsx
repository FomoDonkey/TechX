"use client";

import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, RefreshCw, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rescanEntryAction, rescanWorkspaceAction } from "./_actions";

export type EntryHealthRow = {
  entryId: string;
  title: string;
  slug: string;
  status: string;
  score: number;
  counts: { low: number; medium: number; high: number; critical: number };
  scannedAt: string;
};

export function HealthDashboard({ entries }: { entries: EntryHealthRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanningWs, setScanningWs] = useState(false);
  const [scanningEntry, setScanningEntry] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  const filtered = entries.filter((e) => {
    if (filter === "all") return true;
    return e.counts[filter] > 0;
  });

  async function handleRescanWs() {
    setScanningWs(true);
    try {
      await rescanWorkspaceAction();
      startTransition(() => router.refresh());
    } finally {
      setScanningWs(false);
    }
  }

  async function handleRescanEntry(id: string) {
    setScanningEntry(id);
    try {
      await rescanEntryAction({ entryId: id });
      startTransition(() => router.refresh());
    } finally {
      setScanningEntry(null);
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/30 p-1 text-xs">
          {(["all", "critical", "high", "medium", "low"] as const).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                filter === f
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all"
                ? "Todas"
                : f === "critical"
                  ? "Críticas"
                  : f === "high"
                    ? "Altas"
                    : f === "medium"
                      ? "Medias"
                      : "Bajas"}
            </button>
          ))}
        </div>
        <Button onClick={handleRescanWs} disabled={scanningWs || pending} size="sm">
          <RefreshCw className={`mr-1.5 size-3.5 ${scanningWs ? "animate-spin" : ""}`} />
          {scanningWs ? "Escaneando…" : "Re-escanear todo"}
        </Button>
      </header>

      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card/30 px-6 py-12 text-center">
          <p className="text-sm font-medium">
            {entries.length === 0 ? "Sin datos todavía" : "Sin issues con ese filtro"}
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {entries.length === 0
              ? 'Lanza el primer escaneo con "Re-escanear todo".'
              : "Cambia el filtro o re-escanea para ver issues nuevos."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {filtered.map((e) => (
            <li
              key={e.entryId}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ScoreBadge score={e.score} />
                <div className="min-w-0">
                  <Link
                    href={`/admin/contenido/${e.entryId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {e.title || <em className="text-muted-foreground">(sin título)</em>}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    /{e.slug} · {e.status} · escaneado{" "}
                    {formatDistanceToNow(new Date(e.scannedAt), { addSuffix: true, locale: es })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.counts.critical > 0 ? (
                      <CountPill count={e.counts.critical} severity="critical" />
                    ) : null}
                    {e.counts.high > 0 ? <CountPill count={e.counts.high} severity="high" /> : null}
                    {e.counts.medium > 0 ? (
                      <CountPill count={e.counts.medium} severity="medium" />
                    ) : null}
                    {e.counts.low > 0 ? <CountPill count={e.counts.low} severity="low" /> : null}
                    {e.counts.low + e.counts.medium + e.counts.high + e.counts.critical === 0 ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Sin issues
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRescanEntry(e.entryId)}
                  disabled={scanningEntry === e.entryId}
                >
                  <Wrench
                    className={`mr-1.5 size-3.5 ${scanningEntry === e.entryId ? "animate-spin" : ""}`}
                  />
                  {scanningEntry === e.entryId ? "Escaneando…" : "Re-escanear"}
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/contenido/${e.entryId}`}>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : score >= 65
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <div
      className={`grid size-12 shrink-0 place-items-center rounded-xl border font-mono text-base font-bold ${tone}`}
    >
      {score}
    </div>
  );
}

function CountPill({
  count,
  severity,
}: {
  count: number;
  severity: "low" | "medium" | "high" | "critical";
}) {
  const map = {
    critical: "bg-destructive/15 text-destructive",
    high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  } as const;
  const label = {
    critical: "crítico",
    high: "alto",
    medium: "medio",
    low: "bajo",
  } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[severity]}`}
    >
      {count} {label[severity]}
    </span>
  );
}
