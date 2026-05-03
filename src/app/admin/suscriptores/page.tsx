import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { subscribers as subsT } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { listSubscribers } from "@/newsletter/subscribers";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Mailbox } from "lucide-react";
import type { Metadata } from "next";
import { SubscribersClient } from "./client";

export const metadata: Metadata = { title: "Suscriptores · CSM" };
export const dynamic = "force-dynamic";

export default async function SubscribersPage(props: {
  searchParams: Promise<{ q?: string; status?: string; tag?: string; page?: string }>;
}) {
  const ctx = await requireWorkspace("editor");
  const sp = await props.searchParams;
  const limit = 100;
  const page = Math.max(1, Number(sp.page) || 1);

  const status =
    sp.status === "active" || sp.status === "unsubscribed" || sp.status === "bounced"
      ? sp.status
      : undefined;
  const { rows, total } = await listSubscribers({
    workspaceId: ctx.workspace.id,
    q: sp.q,
    status,
    tag: sp.tag,
    limit,
    offset: (page - 1) * limit,
    orderBy: "createdAt",
    direction: "desc",
  });

  // Counters
  const [counts] = db
    ? await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${subsT.status} = 'active' and ${subsT.confirmedAt} is not null)::int`,
          pending: sql<number>`count(*) filter (where ${subsT.status} = 'active' and ${subsT.confirmedAt} is null)::int`,
          unsubscribed: sql<number>`count(*) filter (where ${subsT.status} = 'unsubscribed')::int`,
          bounced: sql<number>`count(*) filter (where ${subsT.status} = 'bounced')::int`,
        })
        .from(subsT)
        .where(eq(subsT.workspaceId, ctx.workspace.id))
    : [{ total: 0, active: 0, pending: 0, unsubscribed: 0, bounced: 0 }];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Mailbox className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
            Suscriptores
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tu lista. Importa, exporta, segmenta y dispara campañas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" /> {counts?.active ?? 0} activos
          </Badge>
          {counts?.pending && counts.pending > 0 ? (
            <Badge variant="outline" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-500" /> {counts.pending} pendientes
            </Badge>
          ) : null}
          {counts?.unsubscribed && counts.unsubscribed > 0 ? (
            <Badge variant="outline" className="gap-1.5 opacity-70">
              <span className="size-1.5 rounded-full bg-muted-foreground" /> {counts.unsubscribed}{" "}
              bajas
            </Badge>
          ) : null}
        </div>
      </header>

      <SubscribersClient
        rows={rows}
        total={total}
        page={page}
        pageSize={limit}
        currentStatus={status}
        currentQuery={sp.q ?? ""}
        currentTag={sp.tag ?? ""}
      />
    </div>
  );
}
