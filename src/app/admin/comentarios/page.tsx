import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { countByStatus, listForModeration } from "@/lib/comments";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, inArray } from "drizzle-orm";
import { ModerationList } from "./moderation-list";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function CommentsPage(props: Props) {
  const sp = await props.searchParams;
  const ctx = await requireWorkspace("editor");
  const status = sp.status === "approved" || sp.status === "spam" ? sp.status : "pending";
  const [list, counts] = await Promise.all([
    listForModeration({ workspaceId: ctx.workspace.id, status, limit: 200 }),
    countByStatus(ctx.workspace.id),
  ]);

  // Cargar títulos+slug de los entries referenciados en una sola query (multi-tenant safe)
  const entryIds = [...new Set(list.map((c) => c.entryId))];
  const entryMap = new Map<string, { title: string; slug: string }>();
  if (db && entryIds.length > 0) {
    const rows = await db
      .select({ id: entries.id, title: entries.title, slug: entries.slug })
      .from(entries)
      .where(and(eq(entries.workspaceId, ctx.workspace.id), inArray(entries.id, entryIds)));
    for (const r of rows) {
      entryMap.set(r.id, { title: r.title, slug: r.slug });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Comentarios</h1>
        <p className="text-sm text-muted-foreground">
          Moderación con score IA: el modelo y la heurística clasifican entre 0 (limpio) y 100
          (spam). Los aprobados (&lt;35) se publican automáticamente; los pendientes (35-74) esperan
          revisión; los marcados spam (≥75) quedan ocultos.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-2 text-sm">
        <Tab
          href="/admin/comentarios?status=pending"
          active={status === "pending"}
          label="Pendientes"
          count={counts.pending}
        />
        <Tab
          href="/admin/comentarios?status=approved"
          active={status === "approved"}
          label="Aprobados"
          count={counts.approved}
        />
        <Tab
          href="/admin/comentarios?status=spam"
          active={status === "spam"}
          label="Spam"
          count={counts.spam}
        />
      </div>

      <ModerationList items={list} entryMap={Object.fromEntries(entryMap)} status={status} />
    </div>
  );
}

function Tab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <a
      href={href}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {label}
      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-background/40 px-1.5 text-[10px] font-semibold">
        {count}
      </span>
    </a>
  );
}
