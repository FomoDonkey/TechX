import {
  DEFAULT_MODERATION_THRESHOLDS,
  type ModerationThresholds,
  getModerationThresholds,
} from "@/ai/moderation";
import { getCurrentUser } from "@/auth/server";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { comments } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ModerationForm } from "./client";

export const metadata: Metadata = { title: "Moderación · techx" };
export const dynamic = "force-dynamic";

export default async function ModeracionPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");
  const ctx = await requireWorkspace("admin");

  const current: ModerationThresholds = await getModerationThresholds(ctx.workspace.id);

  // Distribución de scores en últimos 30 días para que el admin vea el impacto
  // de mover los umbrales antes de guardar.
  const histogram = await db
    .select({ status: comments.status, total: count(comments.id) })
    .from(comments)
    .where(eq(comments.workspaceId, ctx.workspace.id))
    .groupBy(comments.status);
  const counts = { pending: 0, approved: 0, spam: 0 };
  for (const r of histogram) {
    if (r.status === "pending") counts.pending = Number(r.total);
    if (r.status === "approved") counts.approved = Number(r.total);
    if (r.status === "spam") counts.spam = Number(r.total);
  }
  const total = counts.pending + counts.approved + counts.spam;

  const isDefault =
    current.spamThreshold === DEFAULT_MODERATION_THRESHOLDS.spamThreshold &&
    current.pendingThreshold === DEFAULT_MODERATION_THRESHOLDS.pendingThreshold;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Moderación de comentarios</h1>
        <p className="text-sm text-muted-foreground">
          Cuándo un comentario se publica directo, cuándo va a pending para revisión humana y cuándo
          se descarta como spam. Los scores los calcula heurística + LLM en{" "}
          <code className="text-xs">src/ai/moderation.ts</code>.
        </p>
      </header>

      <Card className="p-6">
        <ModerationForm
          initial={current}
          isDefault={isDefault}
          defaults={DEFAULT_MODERATION_THRESHOLDS}
        />
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Histórico</h2>
        <p className="text-xs text-muted-foreground">
          Distribución total de comentarios en este workspace por estado actual (
          {total.toLocaleString("es")} comentarios).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Aprobados</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {counts.approved.toLocaleString("es")}
            </p>
          </Card>
          <Card className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {counts.pending.toLocaleString("es")}
            </p>
          </Card>
          <Card className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Spam</p>
            <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {counts.spam.toLocaleString("es")}
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cómo funciona el score</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • <strong>Heurística (gratis)</strong>: penaliza enlaces múltiples, mayúsculas
            excesivas, repeticiones, keywords spam ("viagra", "casino", etc.), nombre con dígitos
            sospechosos.
          </li>
          <li>
            • <strong>LLM (si está disponible)</strong>: el modelo confirma o sube el score con
            explicación libre. Sólo se invoca cuando la heurística está por debajo de 70 (ahorra
            coste).
          </li>
          <li>
            • <strong>Score final</strong>: el máximo entre heurística y LLM (defensivo: cualquiera
            de los dos puede subir, ninguno baja).
          </li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/ajustes/seguridad" className="hover:underline">
          ← Volver al centro de seguridad
        </Link>
      </p>
    </div>
  );
}
