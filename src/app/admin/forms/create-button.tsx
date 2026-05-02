"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_TEMPLATES } from "@/forms/templates";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFormAction } from "./_actions";

export function CreateFormButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo formulario
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
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!name.trim()) return toast.error("Pon un nombre");
    start(async () => {
      const r = await createFormAction({
        name,
        slug: slug.trim() || undefined,
        templateSlug: template ?? undefined,
      });
      if (r.ok) {
        toast.success("Formulario creado");
        onOpenChange(false);
        router.push(`/admin/forms/${r.id}`);
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
          <Dialog.Title className="text-lg font-semibold">Nuevo formulario</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Empieza desde una plantilla o desde cero. Podrás cambiar todo después.
          </Dialog.Description>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-name">Nombre</Label>
                <Input
                  id="f-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contacto"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-slug">Slug (opcional)</Label>
                <Input
                  id="f-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="contacto"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Sparkles className="size-3.5" /> Plantilla
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
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
                  <div className="text-xl">✨</div>
                  <div className="mt-1.5 text-sm font-medium">En blanco</div>
                  <div className="text-[11px] text-muted-foreground">Empieza desde cero</div>
                </button>
                {FORM_TEMPLATES.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setTemplate(t.slug)}
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
