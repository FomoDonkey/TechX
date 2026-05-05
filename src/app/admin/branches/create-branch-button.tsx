"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createBranchAction } from "./_actions";

const COLORS = [
  { name: "Violeta", value: "oklch(0.55 0.22 290)" },
  { name: "Magenta", value: "oklch(0.72 0.25 340)" },
  { name: "Cian", value: "oklch(0.78 0.18 180)" },
  { name: "Lima", value: "oklch(0.85 0.20 130)" },
  { name: "Naranja", value: "oklch(0.72 0.20 50)" },
  { name: "Rojo", value: "oklch(0.65 0.25 25)" },
];

export function CreateBranchButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]?.value);

  function close() {
    setOpen(false);
    setName("");
    setSlug("");
    setDescription("");
    setColor(COLORS[0]?.value);
  }

  function submit() {
    start(async () => {
      const result = await createBranchAction({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        color: color ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Branch "${result.slug}" creada`);
      close();
      router.push(`/admin/branches/${result.id}`);
    });
  }

  if (!open) {
    return (
      <Button variant={variant} className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nueva branch
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Nueva branch</h3>
          <p className="text-xs text-muted-foreground">
            Crea una rama para experimentar sin afectar a producción. Forkea entradas al editarlas.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">Nombre</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .normalize("NFD")
                      // biome-ignore lint/suspicious/noMisleadingCharacterClass: combining diacritics range
                      .replace(/[̀-ͯ]/g, "")
                      .replace(/[^a-z0-9-/\s]/g, "")
                      .replace(/\s+/g, "-")
                      .slice(0, 60),
                  );
                }
              }}
              placeholder="Rediseño homepage Q3"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branch-slug">
              Slug{" "}
              <span className="text-xs font-normal text-muted-foreground">— usa / para anidar</span>
            </Label>
            <Input
              id="branch-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-/]/g, ""))}
              placeholder="feat/redesign-home"
              maxLength={60}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branch-desc">Descripción</Label>
            <Textarea
              id="branch-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué pretende esta rama (visible para el equipo)"
              maxLength={280}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`size-7 rounded-full border-2 transition-transform ${
                    color === c.value
                      ? "scale-110 border-foreground"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c.value }}
                  title={c.name}
                  aria-label={`Color ${c.name}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Creando..." : "Crear branch"}
          </Button>
        </div>
      </div>
    </div>
  );
}
