"use client";

import { createCollectionFormAction } from "@/app/admin/colecciones/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import * as Dialog from "@radix-ui/react-dialog";
import { Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  trigger: ReactNode;
  openInitial?: boolean;
};

export function NewCollectionDialog({ trigger, openInitial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(openInitial));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [singleton, setSingleton] = useState(false);
  const [touchedSlug, setTouchedSlug] = useState(false);

  useEffect(() => {
    if (!touchedSlug) setSlug(slugify(name));
  }, [name, touchedSlug]);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      // limpia query param ?new=1
      router.replace("/admin/colecciones");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-popover p-6 shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <Dialog.Title className="font-display text-lg font-semibold">
                Nueva colección
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Empieza creando el contenedor. Los campos los añadirás después.
              </Dialog.Description>
            </div>
          </div>

          <form action={createCollectionFormAction} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                placeholder="Eventos, Productos, Documentación…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="eventos"
                value={slug}
                onChange={(e) => {
                  setTouchedSlug(true);
                  setSlug(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Aparece en URLs internas y en la API: <code>/api/v1/{slug || "slug"}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Para qué se usa esta colección…"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Singleton</div>
                <div className="text-xs text-muted-foreground">
                  Una sola entrada (Sobre nosotros, Configuración global…)
                </div>
              </div>
              <input type="hidden" name="isSingleton" value={singleton ? "on" : ""} />
              <Switch checked={singleton} onCheckedChange={setSingleton} />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="gradient">
                Crear colección
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
