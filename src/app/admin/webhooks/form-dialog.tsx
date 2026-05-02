"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WEBHOOK_EVENT_GROUPS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from "@/webhooks/events";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWebhookAction, updateWebhookAction } from "./_actions";

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    description: string | null;
    url: string;
    events: string[] | null;
    maxAttempts: number;
    active: boolean;
  };
};

export function WebhookFormDialog({ open, onOpenChange, mode, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [events, setEvents] = useState<string[]>(initial?.events ?? ["*"]);
  const [maxAttempts, setMaxAttempts] = useState(initial?.maxAttempts ?? 5);
  const [active, setActive] = useState(initial?.active ?? true);
  const [pending, start] = useTransition();

  const allWildcard = events.includes("*");

  function toggleEvent(e: string) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev.filter((x) => x !== "*"), e],
    );
  }

  function handleSubmit() {
    if (!name.trim()) return toast.error("Pon un nombre");
    if (!url.trim()) return toast.error("Pon una URL");
    if (events.length === 0) return toast.error("Selecciona al menos un evento");
    start(async () => {
      const r =
        mode === "create"
          ? await createWebhookAction({
              name,
              description: description || undefined,
              url,
              events,
              maxAttempts,
              active,
            })
          : await updateWebhookAction({
              id: initial!.id,
              name,
              description,
              url,
              events,
              maxAttempts,
              active,
            });
      if (r.ok) {
        toast.success(mode === "create" ? "Webhook creado" : "Webhook actualizado");
        onOpenChange(false);
        if (mode === "create" && "secret" in r) {
          alert(
            `Secret del webhook (guárdalo, lo usarás para verificar firmas):\n\n${r.secret}\n\nLas firmas vienen en el header X-CSM-Signature como hex(HMAC-SHA256(timestamp + "." + body)).`,
          );
        }
        location.reload();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            {mode === "create" ? "Nuevo webhook" : "Editar webhook"}
          </Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Cada delivery se firma con HMAC SHA-256 y se reintenta hasta {maxAttempts} veces con
            backoff exponencial.
          </Dialog.Description>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">Nombre</Label>
                <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-attempts">Reintentos</Label>
                <Input
                  id="wh-attempts"
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                value={url}
                placeholder="https://example.com/webhook"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-desc">Descripción (opcional)</Label>
              <Textarea
                id="wh-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Eventos</Label>
              <button
                type="button"
                onClick={() => setEvents(allWildcard ? [] : ["*"])}
                className={cn(
                  "block w-full rounded-lg border px-3 py-1.5 text-left text-xs",
                  allWildcard ? "border-primary bg-primary/10" : "border-dashed",
                )}
              >
                <span className="font-mono">*</span> &nbsp;— Todos los eventos
              </button>
              {WEBHOOK_EVENT_GROUPS.map((g) => (
                <div
                  key={g.label}
                  className={cn(allWildcard ? "opacity-40 pointer-events-none" : "")}
                >
                  <p className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.events.map((e: WebhookEvent) => {
                      const checked = events.includes(e);
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() => toggleEvent(e)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs",
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border/60 hover:border-border",
                          )}
                        >
                          <span>
                            <span className="font-mono">{e}</span>
                            <span className="ml-2 text-muted-foreground">
                              {WEBHOOK_EVENT_LABELS[e]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded"
              />
              Activo
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Crear webhook" : "Guardar"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
