"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, FileText, ImageIcon, Sparkles } from "lucide-react";
import { useFormStatus } from "react-dom";

const TIPS = [
  { icon: FileText, label: "Estructura tu primer post con headings y citas" },
  { icon: ImageIcon, label: "Subiremos imágenes con drag & drop en Fase 3" },
  { icon: Sparkles, label: "El editor incluye AI Inline ⌘J" },
];

export function EmptyState({
  createPost,
}: {
  createPost: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card className="relative overflow-hidden p-8 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, var(--brand-1), transparent 50%), radial-gradient(circle at 70% 80%, var(--brand-2), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-lg">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="size-3" /> Lienzo en blanco
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Tu primer post está a un click.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Editor Notion-like con slash menu, autosave y revisiones automáticas. Lo publicas cuando
          quieras.
        </p>
        <form action={createPost} className="mt-5 inline-block">
          <CreateButton />
        </form>
        <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left">
          {TIPS.map((t) => (
            <li
              key={t.label}
              className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <t.icon className="size-4 shrink-0 text-primary" /> {t.label}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" size="lg" className="rounded-xl" disabled={pending}>
      {pending ? "Creando…" : "Crear primera entrada"} <ArrowRight className="size-4" />
    </Button>
  );
}
