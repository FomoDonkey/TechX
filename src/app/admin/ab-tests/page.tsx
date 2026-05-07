import { abKpis, listAbTests } from "@/ab/queries";
import { Badge } from "@/components/ui/badge";
import { features } from "@/env";
import { requireWorkspace } from "@/lib/workspace";
import { Beaker, FlaskConical, Pause, PlayCircle, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { AbTestsBoard } from "./_client";

export const metadata: Metadata = { title: "A/B Tests · techx" };
export const dynamic = "force-dynamic";

export default async function AbTestsPage() {
  const ctx = await requireWorkspace("editor");
  if (!features.database) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <FlaskConical className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Activa la base de datos para usar A/B testing.
        </p>
      </div>
    );
  }

  const [tests, kpis] = await Promise.all([
    listAbTests(ctx.workspace.id),
    abKpis(ctx.workspace.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <FlaskConical className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
              A/B Tests
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Crea variantes, asigna pesos y mide qué versión convierte mejor. Las asignaciones son
              sticky por visitante: cada anon recibe siempre la misma variant.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="size-3.5" /> {kpis.totalAssignments.toLocaleString("es-ES")}{" "}
            visitantes asignados
          </Badge>
        </div>

        <KpiGrid kpis={kpis} />
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Tus tests</h2>
            <p className="text-xs text-muted-foreground">
              Inserta el bloque <code>Variantes A/B</code> en una página y referencia el{" "}
              <code>key</code> del test.
            </p>
          </div>
        </div>
        <AbTestsBoard
          tests={tests.map((t) => ({
            id: t.id,
            key: t.key,
            name: t.name,
            description: t.description,
            status: t.status,
            target: t.target,
            variants: t.variants,
            minSampleSize: t.minSampleSize,
            winnerVariantId: t.winnerVariantId,
            startedAt: t.startedAt?.toISOString() ?? null,
            endedAt: t.endedAt?.toISOString() ?? null,
            updatedAt: t.updatedAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: Awaited<ReturnType<typeof abKpis>> }) {
  const items = [
    { label: "Total", value: kpis.total, icon: Beaker, accent: "text-foreground" },
    { label: "Activos", value: kpis.running, icon: PlayCircle, accent: "text-emerald-300" },
    { label: "Borrador", value: kpis.draft, icon: Sparkles, accent: "text-violet-300" },
    { label: "Pausados", value: kpis.paused, icon: Pause, accent: "text-amber-300" },
    { label: "Completados", value: kpis.completed, icon: Trophy, accent: "text-pink-300" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {it.label}
              </span>
              <Icon className={`size-4 ${it.accent}`} />
            </div>
            <div className={`mt-1 text-2xl font-semibold ${it.accent}`}>{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}
