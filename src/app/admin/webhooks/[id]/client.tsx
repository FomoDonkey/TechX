"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/webhooks/events";
import { Pause, Play, RefreshCw, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteWebhookAction,
  replayDeliveryAction,
  rotateSecretAction,
  testWebhookAction,
  updateWebhookAction,
} from "../_actions";
import { WebhookFormDialog } from "../form-dialog";

type Props = {
  wh: {
    id: string;
    name: string;
    description: string | null;
    url: string;
    events: string[] | null;
    maxAttempts: number;
    active: boolean;
  };
  deliveries: Array<{
    id: string;
    event: string;
    status: "pending" | "success" | "failed" | "retrying" | "dropped";
    attempt: number;
    maxAttempts: number;
    statusCode: number | null;
    durationMs: number | null;
    error: string | null;
    responseSnippet: string | null;
    createdAt: string;
    sentAt: string | null;
  }>;
  summary: { success: number; failed: number; pending: number };
};

export function WebhookDetailClient({ wh, deliveries, summary }: Props) {
  const [tab, setTab] = useState<"deliveries" | "test" | "config">("deliveries");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function handleToggle() {
    start(async () => {
      const r = await updateWebhookAction({ id: wh.id, active: !wh.active });
      if (r.ok) {
        toast.success(wh.active ? "Pausado" : "Activado");
        location.reload();
      } else toast.error(r.error);
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar este webhook? Las entregas pendientes serán dropped.")) return;
    start(async () => {
      const r = await deleteWebhookAction(wh.id);
      if (r.ok) {
        toast.success("Webhook eliminado");
        location.href = "/admin/webhooks";
      } else toast.error(r.error);
    });
  }

  function handleRotateSecret() {
    if (!confirm("¿Rotar el secret? Tendrás que actualizar tu integración.")) return;
    start(async () => {
      const r = await rotateSecretAction(wh.id);
      if (r.ok) {
        prompt("Nuevo secret (cópialo, no se mostrará otra vez):", r.secret);
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={() => setEditing(true)} variant="outline" size="sm">
          Editar
        </Button>
        <Button
          onClick={handleToggle}
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={pending}
        >
          {wh.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {wh.active ? "Pausar" : "Activar"}
        </Button>
        <Button onClick={handleRotateSecret} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="size-3.5" /> Rotar secret
        </Button>
        <Button
          onClick={handleDelete}
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="OK" value={summary.success} tone="success" />
        <SummaryCard label="Fallidos" value={summary.failed} tone="destructive" />
        <SummaryCard label="En cola" value={summary.pending} tone="warning" />
      </div>

      <div className="flex border-b">
        {(["deliveries", "test", "config"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            {t === "deliveries" ? "Entregas" : t === "test" ? "Probar" : "Configuración"}
          </button>
        ))}
      </div>

      {tab === "deliveries" ? (
        <DeliveriesList deliveries={deliveries} pending={pending} startTransition={start} />
      ) : tab === "test" ? (
        <TestPanel webhookId={wh.id} />
      ) : (
        <ConfigPanel wh={wh} />
      )}

      <WebhookFormDialog open={editing} onOpenChange={setEditing} mode="edit" initial={wh} />
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-700 dark:text-green-400"
      : tone === "destructive"
        ? "text-destructive"
        : "text-amber-700 dark:text-amber-400";
  return (
    <div className="rounded-2xl border bg-card/30 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function DeliveriesList({
  deliveries,
  pending,
  startTransition,
}: {
  deliveries: Props["deliveries"];
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  function replay(id: string) {
    startTransition(async () => {
      const r = await replayDeliveryAction(id);
      if (r.ok) {
        toast.success("Reencolada");
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  if (deliveries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        Aún no hay entregas. Dispara un evento o usa la pestaña "Probar".
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-2xl border bg-card/30">
      {deliveries.map((d) => (
        <li key={d.id} className="space-y-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{d.event}</code>
            <DeliveryStatusBadge status={d.status} />
            {d.statusCode ? (
              <Badge variant="outline" className="text-[10px] font-mono">
                {d.statusCode}
              </Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              attempt {d.attempt}/{d.maxAttempts}
            </span>
            {d.durationMs !== null ? (
              <span className="text-[11px] text-muted-foreground">{d.durationMs}ms</span>
            ) : null}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {new Date(d.createdAt).toLocaleString()}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => replay(d.id)}
              disabled={pending}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <RefreshCw className="size-3" /> Replay
            </Button>
          </div>
          {d.error ? <p className="font-mono text-[11px] text-destructive">{d.error}</p> : null}
          {d.responseSnippet ? (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Respuesta</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[10px]">
                {d.responseSnippet}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DeliveryStatusBadge({ status }: { status: Props["deliveries"][number]["status"] }) {
  const map = {
    success: { label: "OK", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
    failed: { label: "Fallo", cls: "bg-destructive/15 text-destructive" },
    pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
    retrying: { label: "Retry", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    dropped: { label: "Dropped", cls: "bg-muted text-muted-foreground" },
  } as const;
  const v = map[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", v.cls)}>
      {v.label}
    </span>
  );
}

function TestPanel({ webhookId }: { webhookId: string }) {
  const [event, setEvent] = useState<WebhookEvent>(WEBHOOK_EVENTS[0]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    statusCode?: number;
    durationMs?: number;
    error?: string;
    snippet?: string;
  } | null>(null);

  function send() {
    start(async () => {
      const r = await testWebhookAction({
        id: webhookId,
        event,
        payload: { test: true, timestamp: new Date().toISOString() },
      });
      if (r.ok) {
        setResult({
          ok: r.result.ok,
          statusCode: r.result.statusCode,
          durationMs: r.result.durationMs,
          error: r.result.error,
          snippet: r.result.responseSnippet,
        });
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card/30 p-5">
      <div>
        <p className="text-sm font-medium">Disparar evento de prueba</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Envía un payload con <code className="font-mono">test: true</code>. No se guarda en el log
          de entregas.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {WEBHOOK_EVENTS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEvent(e)}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px]",
              event === e ? "border-primary bg-primary/10" : "hover:bg-muted",
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <Button onClick={send} disabled={pending} className="gap-2">
        <Send className="size-4" /> {pending ? "Enviando…" : "Enviar prueba"}
      </Button>
      {result ? (
        <div
          className={cn(
            "rounded-xl border p-3 text-xs",
            result.ok
              ? "border-green-500/30 bg-green-500/10"
              : "border-destructive/30 bg-destructive/10",
          )}
        >
          <p className="font-medium">
            {result.ok ? "✓ OK" : "✗ Error"}{" "}
            {result.statusCode ? <span className="font-mono">HTTP {result.statusCode}</span> : null}
            {result.durationMs ? (
              <span className="ml-2 text-muted-foreground">{result.durationMs}ms</span>
            ) : null}
          </p>
          {result.error ? <p className="mt-1 font-mono">{result.error}</p> : null}
          {result.snippet ? (
            <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-2 font-mono text-[10px]">
              {result.snippet}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConfigPanel({ wh }: { wh: Props["wh"] }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card/30 p-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">URL</p>
        <code className="block break-all text-sm">{wh.url}</code>
      </div>
      {wh.description ? (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Descripción</p>
          <p className="text-sm">{wh.description}</p>
        </div>
      ) : null}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Eventos suscritos</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(wh.events ?? []).map((e) => (
            <Badge key={e} variant="outline" className="font-mono text-[10px]">
              {e}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Reintentos máx.</p>
          <p className="text-sm">{wh.maxAttempts}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado</p>
          <p className="text-sm">{wh.active ? "Activo" : "Pausado"}</p>
        </div>
      </div>
    </div>
  );
}
