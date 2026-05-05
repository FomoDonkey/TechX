import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { SOURCE_LABELS } from "@/imports/registry";
import type { ImportStats } from "@/imports/types";
import { requireWorkspace } from "@/lib/workspace";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UploadZone } from "./upload-zone";

export const metadata: Metadata = { title: "Importar · CSM" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Subido",
  ready: "Listo",
  running: "En curso",
  completed: "Completado",
  failed: "Fallido",
  reverted: "Revertido",
};

const STATUS_TONE: Record<string, string> = {
  uploaded: "bg-muted text-muted-foreground",
  ready: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  running: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  reverted: "bg-muted text-muted-foreground",
};

function fmtBytes(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ImportsPage() {
  const ctx = await requireWorkspace("editor");
  const rows = db
    ? await db
        .select()
        .from(imports)
        .where(eq(imports.workspaceId, ctx.workspace.id))
        .orderBy(desc(imports.createdAt))
        .limit(50)
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Importar contenido</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Trae tu blog de WordPress, Notion, Ghost, RSS, Markdown o CSV. Detecta el formato
          automáticamente, te deja editar el mapeo de campos, hace dry-run con preview real y luego
          ejecuta con barra de progreso en vivo. Y siempre puedes deshacerlo.
        </p>
      </header>

      <UploadZone />

      {rows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Imports recientes
          </h2>
          <ul className="divide-y rounded-2xl border bg-card/30">
            {rows.map((row) => {
              const stats = (row.stats ?? {}) as Partial<ImportStats>;
              const status = STATUS_LABELS[row.status] ?? row.status;
              const tone = STATUS_TONE[row.status] ?? "bg-muted";
              return (
                <li key={row.id}>
                  <Link
                    href={`/admin/importar/${row.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Download className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{row.fileName ?? "Sin nombre"}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABELS[row.source]}
                        </Badge>
                        <Badge className={`${tone} text-[10px]`}>{status}</Badge>
                        {row.dryRun ? (
                          <Badge variant="secondary" className="text-[10px]">
                            dry-run
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                        <span>
                          {fmtBytes(row.fileSize)} · {stats.detected ?? 0} detectados
                        </span>
                        <span>{stats.imported ?? 0} importados</span>
                        {(stats.errored ?? 0) > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            {stats.errored} con error
                          </span>
                        ) : null}
                        <span>{new Date(row.createdAt).toLocaleString("es-ES")}</span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
