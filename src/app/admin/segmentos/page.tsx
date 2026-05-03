import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/workspace";
import { listSegments, listSubscriberCountsForSegments } from "@/newsletter/segments-lib";
import { Filter, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Segmentos · CSM" };
export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const ctx = await requireWorkspace("editor");
  const [segments, counts] = await Promise.all([
    listSegments(ctx.workspace.id),
    listSubscriberCountsForSegments(ctx.workspace.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Filter className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
            Segmentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Define audiencias por reglas (status, etiquetas, idioma, fechas, membresía…). Las
            campañas envían sólo a quienes matchean.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/segmentos/nuevo">
            <Plus className="mr-1.5 size-4" />
            Nuevo segmento
          </Link>
        </Button>
      </header>

      {segments.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Filter className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sin segmentos. Crea uno para empezar a enviar campañas a audiencias específicas.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {segments.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/segmentos/${s.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/30"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {counts.get(s.id) ?? 0} suscriptores
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {summarizeRules(s.rules)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summarizeRules(rules: unknown): string {
  if (!rules) return "Sin reglas (todos los suscriptores)";
  if (typeof rules !== "object") return "Reglas inválidas";
  if ("all" in rules) return `${(rules as { all: unknown[] }).all.length} reglas combinadas (AND)`;
  if ("any" in rules) return `${(rules as { any: unknown[] }).any.length} reglas combinadas (OR)`;
  if ("field" in rules) return "1 regla simple";
  return "Reglas personalizadas";
}
