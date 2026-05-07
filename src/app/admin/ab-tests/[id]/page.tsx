import { getAbTest, recentAbEventCounts } from "@/ab/queries";
import { computeTestResults, formatLift, formatPValue, formatRate } from "@/ab/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Eye,
  FlaskConical,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteWithWinner } from "./_client";

export const metadata: Metadata = { title: "Resultados A/B · techx" };
export const dynamic = "force-dynamic";

export default async function AbTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const ctx = await requireWorkspace("editor");
  const test = await getAbTest(ctx.workspace.id, id);
  if (!test) notFound();

  const controlId = test.variants.find((v) => v.isControl)?.id ?? null;
  const variantIds = test.variants.map((v) => v.id);
  const [results, recent] = await Promise.all([
    computeTestResults(test.id, variantIds, controlId, test.minSampleSize),
    recentAbEventCounts(ctx.workspace.id, test.id, 24),
  ]);

  const variantById = new Map(test.variants.map((v) => [v.id, v] as const));
  const winnerId = test.winnerVariantId ?? results.significantWinnerId;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <div>
        <Link
          href="/admin/ab-tests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver a tests
        </Link>
      </div>
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <FlaskConical className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
              {test.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{test.key}</code>
              <Badge variant="outline">{test.target}</Badge>
              <Badge
                variant="outline"
                className={cn(
                  test.status === "running"
                    ? "border-emerald-400/40 text-emerald-300"
                    : test.status === "completed"
                      ? "border-pink-400/40 text-pink-300"
                      : test.status === "paused"
                        ? "border-amber-400/40 text-amber-300"
                        : "border-violet-400/40 text-violet-200",
                )}
              >
                {test.status}
              </Badge>
              {test.startedAt ? (
                <span>Inició {new Date(test.startedAt).toLocaleDateString("es-ES")}</span>
              ) : null}
            </div>
            {test.description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{test.description}</p>
            ) : null}
          </div>
          {test.status === "running" || test.status === "paused" ? (
            <CompleteWithWinner
              testId={test.id}
              variants={test.variants.map((v) => ({ id: v.id, label: v.label }))}
              suggestedWinnerId={results.significantWinnerId}
            />
          ) : null}
        </div>
      </header>

      <SignificanceBanner
        winnerId={winnerId}
        winnerLabel={winnerId ? (variantById.get(winnerId)?.label ?? winnerId) : null}
        explicit={test.winnerVariantId !== null}
        anySignificant={results.significantWinnerId !== null}
        anyReachedSample={results.variants.some((v) => v.reachedMinSample)}
      />

      <section>
        <div className="grid gap-3 md:grid-cols-2">
          {results.variants.map((s) => {
            const v = variantById.get(s.variantId);
            const isWinner = winnerId === s.variantId;
            return (
              <div
                key={s.variantId}
                className={cn(
                  "relative rounded-2xl border p-5 transition-colors",
                  isWinner
                    ? "border-pink-400/60 bg-pink-500/5 shadow-lg shadow-pink-500/10"
                    : "border-border bg-card/40",
                )}
              >
                {isWinner ? (
                  <Trophy className="absolute right-4 top-4 size-5 text-pink-300" />
                ) : null}
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{v?.label ?? s.variantId}</h3>
                  {v?.isControl ? (
                    <Badge variant="outline" className="gap-1 border-violet-400/40 text-violet-200">
                      <Crown className="size-3" /> Control
                    </Badge>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {v?.weight ?? 0}% allocation
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat
                    label="Conversión"
                    value={formatRate(s.conversionRate)}
                    accent="text-foreground"
                    big
                  />
                  <Stat
                    label="Lift vs control"
                    value={v?.isControl ? "—" : formatLift(s.liftVsControl)}
                    accent={
                      s.liftVsControl !== null && s.liftVsControl > 0
                        ? "text-emerald-300"
                        : s.liftVsControl !== null && s.liftVsControl < 0
                          ? "text-red-300"
                          : "text-muted-foreground"
                    }
                  />
                  <Stat
                    label="p-value"
                    value={v?.isControl ? "—" : formatPValue(s.pValueVsControl)}
                    accent={
                      s.pValueVsControl !== null && s.pValueVsControl < 0.05
                        ? "text-emerald-300"
                        : "text-muted-foreground"
                    }
                  />
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" /> {s.uniqueImpressions.toLocaleString("es-ES")}{" "}
                    impresiones únicas
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Target className="size-3.5" /> {s.uniqueConversions.toLocaleString("es-ES")}{" "}
                    conversiones
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-1 rounded-full",
                      s.reachedMinSample ? "bg-emerald-400" : "bg-amber-400",
                    )}
                    style={{
                      width: `${Math.min(100, (s.uniqueImpressions * 100) / Math.max(1, test.minSampleSize))}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {s.reachedMinSample ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 className="size-3" /> Muestra mínima alcanzada
                    </span>
                  ) : (
                    <>
                      Faltan{" "}
                      {Math.max(0, test.minSampleSize - s.uniqueImpressions).toLocaleString(
                        "es-ES",
                      )}{" "}
                      muestras (mín. {test.minSampleSize.toLocaleString("es-ES")})
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-card/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-violet-300" />
          <h3 className="font-display text-base font-semibold">Cómo medir conversiones</h3>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Marca cualquier botón o enlace con el atributo{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">data-ab-conversion="{test.key}"</code>{" "}
            y el script tracker llamará a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/api/ab/event</code> al click.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-background/60 p-3 text-[11px]">
            {`<a href="/precios" data-ab-conversion="${test.key}" data-ab-value="29">
  Comprar plan Pro
</a>`}
          </pre>
          <p className="text-muted-foreground">
            O dispárala manualmente:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              window.csm.ab.track("{test.key}")
            </code>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card/40 p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Últimas 24h</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin eventos en las últimas 24h.</p>
        ) : (
          <div className="grid grid-cols-12 gap-1 text-[11px]">
            {recent.map((h) => (
              <div key={h.hour} className="flex flex-col items-center">
                <div
                  className="w-full rounded bg-violet-500/30"
                  style={{
                    height: `${Math.min(60, h.impressions * 2)}px`,
                  }}
                  title={`${h.impressions} imp · ${h.conversions} conv`}
                />
                <span className="mt-1 text-muted-foreground">{new Date(h.hour).getHours()}h</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(big ? "text-2xl" : "text-base", "font-semibold", accent)}>{value}</div>
    </div>
  );
}

function SignificanceBanner({
  winnerId,
  winnerLabel,
  explicit,
  anySignificant,
  anyReachedSample,
}: {
  winnerId: string | null;
  winnerLabel: string | null;
  explicit: boolean;
  anySignificant: boolean;
  anyReachedSample: boolean;
}) {
  if (winnerId && winnerLabel) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-pink-400/40 bg-pink-500/5 px-4 py-3 text-sm">
        <Trophy className="size-5 text-pink-300" />
        <div>
          <div className="font-medium">
            {explicit ? "Variante ganadora declarada:" : "Variante significativa detectada:"}{" "}
            <span className="text-pink-300">{winnerLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {explicit
              ? "Marcaste esta variante como ganadora al cerrar el test."
              : "Chi-squared p < 0.05 con muestra mínima alcanzada vs control."}
          </p>
        </div>
      </div>
    );
  }
  if (anyReachedSample && !anySignificant) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/5 px-4 py-3 text-sm">
        <Sparkles className="size-5 text-amber-300" />
        <div className="text-xs text-muted-foreground">
          Muestra alcanzada pero <strong>sin diferencia estadísticamente significativa</strong> (p ≥
          0.05). Considera dejar correr más, ampliar muestra mínima, o cerrar como empate.
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card/40 px-4 py-3 text-sm">
      <Sparkles className="size-5 text-violet-300" />
      <div className="text-xs text-muted-foreground">
        Aún recopilando datos. La significancia se evalúa con chi-squared 2×2 con corrección de
        Yates a partir de la muestra mínima.
      </div>
    </div>
  );
}
