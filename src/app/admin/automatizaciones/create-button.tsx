"use client";

import { AUTOMATION_TEMPLATES } from "@/automations/templates";
import { TRIGGER_TYPES, type TriggerType } from "@/automations/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAutomationAction } from "./_actions";

export function CreateAutomationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nueva automatización
      </Button>
      <CreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function CreateDialog({
  open,
  onOpenChange,
}: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("event");
  const [template, setTemplate] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!name.trim()) return toast.error("Pon un nombre");
    start(async () => {
      const r = await createAutomationAction({
        name,
        triggerType,
        templateSlug: template ?? undefined,
      });
      if (r.ok) {
        toast.success("Creada");
        onOpenChange(false);
        router.push(`/admin/automatizaciones/${r.id}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Nueva automatización</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Empieza desde una plantilla o crea desde cero seleccionando el tipo de trigger.
          </Dialog.Description>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-name">Nombre</Label>
              <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Sparkles className="size-3.5" /> Plantilla (opcional)
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setTemplate(null)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    template === null
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="text-xl">⚡</div>
                  <div className="mt-1.5 text-sm font-medium">En blanco</div>
                  <div className="text-[11px] text-muted-foreground">Configura todo a mano</div>
                </button>
                {AUTOMATION_TEMPLATES.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => {
                      setTemplate(t.slug);
                      setTriggerType(t.definition.triggerType);
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      template === t.slug
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:border-border",
                    )}
                  >
                    <div className="text-xl">{t.icon}</div>
                    <div className="mt-1.5 text-sm font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {template === null ? (
              <div className="space-y-2">
                <Label>Trigger</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRIGGER_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTriggerType(t.value)}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs",
                        triggerType === t.value
                          ? "border-primary bg-primary/10"
                          : "border-border/60",
                      )}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Creando…" : "Crear"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
