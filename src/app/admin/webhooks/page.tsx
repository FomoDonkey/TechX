import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/workspace";
import { listWebhooks } from "@/webhooks/lib";
import { ArrowRight, Webhook } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateWebhookButton } from "./create-button";

export const metadata: Metadata = { title: "Webhooks · CSM" };
export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "ahora";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h`;
  return d.toISOString().slice(0, 10);
}

export default async function WebhooksPage() {
  const ctx = await requireWorkspace("admin");
  const hooks = await listWebhooks(ctx.workspace.id);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Recibe notificaciones HTTP firmadas (HMAC SHA-256) cuando ocurren eventos en tu
            workspace. Hasta 5 reintentos con backoff exponencial.
          </p>
        </div>
        <CreateWebhookButton />
      </header>

      {hooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Webhook className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sin webhooks. Crea uno para integrar Zapier, Make, Slack o tu propio backend.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {hooks.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/webhooks/${h.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/30"
              >
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.name}</span>
                    {h.active ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Pausado
                      </Badge>
                    )}
                    {h.lastDeliveryStatus === "success" ? (
                      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
                        último OK
                      </Badge>
                    ) : h.lastDeliveryStatus === "failed" ? (
                      <Badge variant="destructive" className="text-[10px]">
                        último FALLO
                      </Badge>
                    ) : h.lastDeliveryStatus === "retrying" ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px]">
                        reintentando
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate font-mono text-xs text-muted-foreground">{h.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {(h.events ?? []).slice(0, 6).map((e) => (
                      <Badge key={e} variant="outline" className="text-[10px] font-mono">
                        {e}
                      </Badge>
                    ))}
                    {(h.events ?? []).length > 6 ? (
                      <Badge variant="outline" className="text-[10px]">
                        +{(h.events ?? []).length - 6}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                    <span>
                      Entregas: <strong className="text-foreground">{h.deliveriesTotal}</strong>
                    </span>
                    <span>
                      OK: <strong className="text-foreground">{formatDate(h.lastSuccessAt)}</strong>
                    </span>
                    <span>
                      Fallo:{" "}
                      <strong className="text-foreground">{formatDate(h.lastFailureAt)}</strong>
                    </span>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" asChild className="text-xs text-muted-foreground">
        <Link href="/admin/api-docs#webhooks">
          Ver formato de los payloads y verificación de firma →
        </Link>
      </Button>
    </div>
  );
}
