"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCampaignAction } from "./_actions";

export function CreateCampaignButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createCampaignAction({ name, subject });
      if (r.ok) {
        router.push(`/admin/campanas/${r.campaign.id}`);
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Nueva campaña
      </Button>
    );
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: <dialog> requiere openModal imperativo; mantenemos div+role
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-2xl"
      >
        <h2 className="font-semibold">Nueva campaña</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-name">
              Nombre interno
            </label>
            <Input
              id="cmp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Newsletter mayo 2026"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-subj">
              Asunto del email
            </label>
            <Input
              id="cmp-subj"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="✦ Las novedades de mayo"
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim() || !subject.trim()}>
            {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Crear y editar
          </Button>
        </div>
      </form>
    </div>
  );
}
