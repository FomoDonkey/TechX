import { Badge } from "@/components/ui/badge";
import { countSubmissionsByForm, listForms } from "@/forms/lib";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateFormButton } from "./create-button";

export const metadata: Metadata = { title: "Formularios · techx" };
export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "ahora";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h`;
  return d.toISOString().slice(0, 10);
}

export default async function FormsPage() {
  const ctx = await requireWorkspace("editor");
  const [items, counts] = await Promise.all([
    listForms(ctx.workspace.id),
    countSubmissionsByForm(ctx.workspace.id),
  ]);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Formularios</h1>
          <p className="text-sm text-muted-foreground">
            Crea formularios drag-and-drop con lógica condicional, multi-step, anti-spam, double
            opt-in y submissions inbox. Embed donde quieras.
          </p>
        </div>
        <CreateFormButton />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <ClipboardList className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sin formularios todavía. Empieza desde una plantilla (Contacto, Newsletter, NPS, Demo,
            Soporte) o desde cero.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {items.map((f) => {
            const subs = counts[f.id] ?? f.submissionsCount;
            return (
              <li key={f.id}>
                <Link
                  href={`/admin/forms/${f.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {f.status === "published" ? (
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
                          Publicado v{f.version}
                        </Badge>
                      ) : f.status === "draft" ? (
                        <Badge variant="outline" className="text-[10px]">
                          Borrador
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Archivado
                        </Badge>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /forms/{f.slug}
                    </p>
                    <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                      <span>
                        Envíos: <strong className="text-foreground">{subs}</strong>
                      </span>
                      <span>
                        Spam: <strong className="text-foreground">{f.spamCount}</strong>
                      </span>
                      <span>
                        Último envío:{" "}
                        <strong className="text-foreground">
                          {formatDate(f.lastSubmissionAt)}
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
