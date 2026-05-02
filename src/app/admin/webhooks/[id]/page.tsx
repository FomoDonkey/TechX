import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { getWebhookById, listDeliveries } from "@/webhooks/lib";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WebhookDetailClient } from "./client";

export const metadata: Metadata = { title: "Webhook · CSM" };
export const dynamic = "force-dynamic";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireWorkspace("admin");
  const wh = await getWebhookById(ctx.workspace.id, id);
  if (!wh) notFound();
  const deliveries = await listDeliveries(ctx.workspace.id, id, 50);

  const summary = {
    success: deliveries.filter((d) => d.status === "success").length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    pending: deliveries.filter((d) => d.status === "pending" || d.status === "retrying").length,
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
          <Link href="/admin/webhooks">
            <ArrowLeft className="size-4" /> Webhooks
          </Link>
        </Button>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{wh.name}</h1>
              {wh.active ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  Activo
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  Pausado
                </Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{wh.url}</p>
          </div>
        </div>
      </header>

      <WebhookDetailClient
        wh={{
          id: wh.id,
          name: wh.name,
          description: wh.description,
          url: wh.url,
          events: wh.events,
          maxAttempts: wh.maxAttempts,
          active: wh.active,
        }}
        deliveries={deliveries.map((d) => ({
          id: d.id,
          event: d.event,
          status: d.status,
          attempt: d.attempt,
          maxAttempts: d.maxAttempts,
          statusCode: d.statusCode,
          durationMs: d.durationMs,
          error: d.error,
          responseSnippet: d.responseSnippet,
          createdAt: d.createdAt.toISOString(),
          sentAt: d.sentAt?.toISOString() ?? null,
        }))}
        summary={summary}
      />
    </div>
  );
}
