import { listBranchesWithStats, resolveActiveBranch } from "@/branches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowRight, GitBranch, GitMerge, Lock, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateBranchButton } from "./create-branch-button";

export const metadata: Metadata = { title: "Branches · techx" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Activa",
  merging: "Merging",
  merged: "Mergeada",
  abandoned: "Abandonada",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  merging: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  merged: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  abandoned: "bg-muted text-muted-foreground line-through",
};

export default async function BranchesPage() {
  const ctx = await requireWorkspace("viewer");
  const [rows, active] = await Promise.all([
    listBranchesWithStats(ctx.workspace.id),
    resolveActiveBranch(ctx.workspace.id),
  ]);

  const main = rows.find((r) => r.isDefault);
  const others = rows.filter((r) => !r.isDefault);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <GitBranch className="size-3.5" />
            Branching de contenido
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Branches</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Trabaja contenido en paralelo sin tocar producción. Forkea entradas, edita en aislado,
            previsualiza con un link compartible y mergea con resolución de conflictos por bloque.
            Como Git, pero para tu CMS.
          </p>
        </div>
        <CreateBranchButton />
      </header>

      {main ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Producción
          </h2>
          <Link
            href={`/admin/branches/${main.id}`}
            className="group flex items-center gap-4 rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-5 transition-colors hover:border-emerald-400/50"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <GitBranch className="size-6" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{main.name}</span>
                <Badge className={STATUS_TONE[main.status] ?? "bg-muted"}>
                  {STATUS_LABEL[main.status]}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Lock className="size-3" />
                  protegida
                </Badge>
                {active.id === main.id ? (
                  <Badge className="gap-1 bg-primary/15 text-primary text-[10px]">
                    <Sparkles className="size-3" />
                    activa
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Branch principal. Aquí vive el contenido publicado en producción.
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Branches activas {others.length > 0 ? `· ${others.length}` : ""}
          </h2>
        </div>
        {others.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
            <GitBranch className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Sin branches todavía</p>
              <p className="text-sm text-muted-foreground">
                Crea una rama para preparar un rediseño, traducir un especial o experimentar sin
                miedo.
              </p>
            </div>
            <CreateBranchButton variant="outline" />
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {others.map((branch) => {
              const total = branch.stats.forked + branch.stats.created + branch.stats.deleted;
              const tone = STATUS_TONE[branch.status] ?? "bg-muted";
              const isActive = active.id === branch.id;
              return (
                <li key={branch.id}>
                  <Link
                    href={`/admin/branches/${branch.id}`}
                    className="group block rounded-2xl border bg-card/40 p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 size-3 shrink-0 rounded-full"
                        style={{ background: branch.color ?? "oklch(0.55 0.22 290)" }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{branch.name}</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {branch.slug}
                          </code>
                          <Badge className={`${tone} text-[10px]`}>
                            {STATUS_LABEL[branch.status]}
                          </Badge>
                          {isActive ? (
                            <Badge className="gap-1 bg-primary/15 text-primary text-[10px]">
                              <Sparkles className="size-3" />
                              activa
                            </Badge>
                          ) : null}
                        </div>
                        {branch.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {branch.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{total} entradas con cambios</span>
                          {branch.stats.forked > 0 ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              {branch.stats.forked} forked
                            </span>
                          ) : null}
                          {branch.stats.created > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {branch.stats.created} nuevas
                            </span>
                          ) : null}
                          {branch.stats.deleted > 0 ? (
                            <span className="text-rose-700 dark:text-rose-400">
                              {branch.stats.deleted} borradas
                            </span>
                          ) : null}
                          {branch.stats.conflicts > 0 ? (
                            <span className="font-medium text-orange-700 dark:text-orange-400">
                              ⚠ {branch.stats.conflicts} conflictos
                            </span>
                          ) : null}
                          {branch.stats.openComments > 0 ? (
                            <span>{branch.stats.openComments} comentarios abiertos</span>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Histórico
        </h2>
        <p className="text-sm text-muted-foreground">
          Las branches mergeadas y abandonadas se muestran aquí. (Próximamente: filtro y restore
          desde abandoned.)
        </p>
        <Button variant="outline" size="sm" disabled className="gap-2">
          <GitMerge className="size-4" />
          Ver histórico — pronto
        </Button>
      </section>
    </div>
  );
}
