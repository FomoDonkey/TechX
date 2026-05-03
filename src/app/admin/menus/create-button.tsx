"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MENU_TEMPLATES } from "@/menus/templates";
import * as Dialog from "@radix-ui/react-dialog";
import { ListTree, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMenuAction, updateMenuAction } from "./actions";

const LOCATIONS: Array<{ value: "header" | "footer" | "sidebar" | "custom"; label: string }> = [
  { value: "header", label: "Cabecera" },
  { value: "footer", label: "Pie" },
  { value: "sidebar", label: "Lateral" },
  { value: "custom", label: "Personalizado" },
];

export function CreateMenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo menú
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
  const [location, setLocation] = useState<"header" | "footer" | "sidebar" | "custom">("header");
  const [template, setTemplate] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!name.trim()) return toast.error("Pon un nombre");
    start(async () => {
      try {
        const tpl = template ? MENU_TEMPLATES.find((t) => t.id === template) : null;
        const finalLocation = tpl?.location ?? location;
        const r = await createMenuAction({
          name,
          slug: slug.trim() || undefined,
          location: finalLocation,
        });
        if (tpl) {
          await updateMenuAction({ id: r.id, items: tpl.items });
        }
        toast.success("Menú creado");
        onOpenChange(false);
        router.push(`/admin/menus/${r.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Nuevo menú</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Empieza desde una plantilla o desde cero. Podrás cambiar todo después.
          </Dialog.Description>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-name">Nombre</Label>
                <Input
                  id="m-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cabecera principal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-slug">Slug (opcional)</Label>
                <Input
                  id="m-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="header"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <div className="grid grid-cols-4 gap-2">
                {LOCATIONS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLocation(l.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs transition-colors",
                      location === l.value
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:border-border",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Sparkles className="size-3.5" /> Plantilla
              </Label>
              <div className="grid grid-cols-2 gap-2">
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
                  <ListTree className="size-4 text-muted-foreground" />
                  <div className="mt-1.5 text-sm font-medium">En blanco</div>
                  <div className="text-[11px] text-muted-foreground">Empieza desde cero</div>
                </button>
                {MENU_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      template === t.id
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:border-border",
                    )}
                  >
                    <div className="text-sm font-medium">{t.name}</div>
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
