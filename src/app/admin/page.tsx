import { createNewPostFormAction } from "@/app/admin/contenido/_actions";
import { requireUser } from "@/auth/server";
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { EmptyState } from "@/components/admin/dashboard/empty-state";
import { HeroGreeting } from "@/components/admin/dashboard/hero-greeting";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { TopPosts } from "@/components/admin/dashboard/top-posts";
import { Card } from "@/components/ui/card";
import { loadDashboardKpis, loadRecentActivity, loadTopPosts } from "@/lib/dashboard";
import { requireWorkspace } from "@/lib/workspace";
import { Eye, FileEdit, Mailbox, MessageCircle, Newspaper } from "lucide-react";

export const metadata = { title: "Inicio" };

export default async function AdminHome() {
  const user = await requireUser();
  const ctx = await requireWorkspace();

  const [kpis, activity, topPosts] = await Promise.all([
    loadDashboardKpis(ctx.workspace.id),
    loadRecentActivity(ctx.workspace.id, 8),
    loadTopPosts(ctx.workspace.id, 5),
  ]);

  const isEmpty = kpis.entriesTotal === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <HeroGreeting
        workspaceName={ctx.workspace.name}
        userName={user.name ?? user.email}
        publishedCount={kpis.entriesPublished}
        draftCount={kpis.entriesDrafts}
        totalCount={kpis.entriesTotal}
        createPost={createNewPostFormAction}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Entradas"
          value={kpis.entriesTotal}
          hint={`${kpis.entriesPublished} publicadas · ${kpis.entriesDrafts} borradores`}
          series={kpis.series.entries}
          icon={Newspaper}
          accent="primary"
        />
        <KpiCard
          label="Suscriptores"
          value={kpis.subscribersTotal}
          hint="Newsletter en Fase 8"
          series={kpis.series.subscribers}
          icon={Mailbox}
          accent="brand-3"
        />
        <KpiCard
          label="Comentarios"
          value={kpis.commentsTotal}
          hint="Moderación AI en Fase 6"
          series={kpis.series.comments}
          icon={MessageCircle}
          accent="accent"
        />
        <KpiCard
          label="Vistas"
          value={kpis.viewsTotal}
          hint="Analytics propias en Fase 10"
          series={kpis.series.views}
          icon={Eye}
          accent="primary"
        />
      </section>

      {isEmpty ? (
        <EmptyState createPost={createNewPostFormAction} />
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <TopPosts rows={topPosts} workspaceSlug={ctx.workspace.slug} />
          <ActivityFeed rows={activity} />
        </section>
      )}

      {!isEmpty ? (
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileEdit className="size-4" /> Borradores
            </div>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
              {kpis.entriesDrafts}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.entriesDrafts > 0
                ? "Termina lo que empezaste — un click y publicas."
                : "Todo limpio. Empieza algo nuevo con ⌘K."}
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-base font-semibold">Atajos</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Shortcut k="⌘K" label="Buscar" />
              <Shortcut k="⌘N" label="Nuevo (pronto)" />
              <Shortcut k="⌘B" label="Workspace" />
              <Shortcut k="⌘." label="Tema" />
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-base font-semibold">Próximas fases</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>• Media Library + AI bg-removal (Fase 3)</li>
              <li>• Page builder visual (Fase 4)</li>
              <li>• 5 temas + SEO completo (Fase 5)</li>
              <li>• Búsqueda semántica + Ask CSM (Fase 6)</li>
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/40 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">{k}</kbd>
    </div>
  );
}
