import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/workspace";
import { listCampaigns } from "@/newsletter/campaigns-lib";
import { Newspaper, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateCampaignButton } from "./create-button";

export const metadata: Metadata = { title: "Campañas · CSM" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const ctx = await requireWorkspace("editor");
  const items = await listCampaigns(ctx.workspace.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Newspaper className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
            Campañas
          </h1>
          <p className="text-sm text-muted-foreground">
            Diseña, programa y envía boletines a tus segmentos. Métricas de apertura y clicks
            integradas.
          </p>
        </div>
        <CreateCampaignButton />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Newspaper className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sin campañas todavía. Pulsa <strong>Nueva campaña</strong> para crear tu primera.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/campanas/${c.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/30"
              >
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.subject}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {c.status === "sent" || c.status === "sending" ? (
                    <>
                      <p>
                        {c.sent ?? 0} enviados ·{" "}
                        {c.totalRecipients
                          ? Math.round(((c.opens ?? 0) / Math.max(1, c.totalRecipients)) * 100)
                          : 0}
                        % open
                      </p>
                      <p className="text-muted-foreground/80">
                        {c.uniqueClicks ?? 0} clicks · {c.bounced ?? 0} bounce
                      </p>
                    </>
                  ) : (
                    <p>
                      {c.scheduledAt
                        ? `Programada ${new Date(c.scheduledAt).toLocaleString()}`
                        : "Borrador"}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Borrador", className: "" },
    scheduled: { label: "Programada", className: "border-amber-500/40 text-amber-600" },
    sending: { label: "Enviando", className: "border-sky-500/40 text-sky-600 animate-pulse" },
    sent: { label: "Enviada", className: "border-emerald-500/40 text-emerald-600" },
    paused: { label: "Pausada", className: "" },
    failed: { label: "Error", className: "border-rose-500/40 text-rose-600" },
  };
  const m = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}
