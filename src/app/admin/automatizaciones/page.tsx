import { countRunsByAutomation, listAutomations } from "@/automations/lib";
import { Badge } from "@/components/ui/badge";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowRight, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateAutomationButton } from "./create-button";

export const metadata: Metadata = { title: "Automatizaciones · CSM" };
export const dynamic = "force-dynamic";

const TRIGGER_LABELS: Record<string, string> = {
  event: "Evento",
  form_submit: "Form",
  cron: "Cron",
  webhook_in: "Webhook entrante",
  manual: "Manual",
};

export default async function AutomationsPage() {
  const ctx = await requireWorkspace("editor");
  const [items, runs] = await Promise.all([
    listAutomations(ctx.workspace.id),
    countRunsByAutomation(ctx.workspace.id),
  ]);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Conecta eventos (publicación, envíos, comentarios) con acciones (webhooks, emails, IA,
            Slack, base de datos). Sin código.
          </p>
        </div>
        <CreateAutomationButton />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Zap className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Aún sin automatizaciones. Empieza desde una plantilla — Slack al publicar, email al
            recibir un form, clasificación con IA, ramificaciones, retrasos…
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {items.map((a) => {
            const totalRuns = runs[a.id] ?? a.runsTotal;
            return (
              <li key={a.id}>
                <Link
                  href={`/admin/automatizaciones/${a.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      {a.active ? (
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Pausada
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {TRIGGER_LABELS[a.triggerType] ?? a.triggerType}
                      </Badge>
                    </div>
                    {a.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                      <span>
                        Runs: <strong className="text-foreground">{totalRuns}</strong>
                      </span>
                      <span>
                        Fallos: <strong className="text-foreground">{a.runsFailed}</strong>
                      </span>
                      <span>
                        Steps:{" "}
                        <strong className="text-foreground">
                          {((a.actions as unknown[]) ?? []).length}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
