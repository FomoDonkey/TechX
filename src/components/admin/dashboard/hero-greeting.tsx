"use client";

import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const GREETINGS = {
  morning: "Buenos días",
  afternoon: "Buenas tardes",
  evening: "Buenas noches",
} as const;

function pickPart(date: Date): keyof typeof GREETINGS {
  const h = date.getHours();
  if (h < 6) return "evening";
  if (h < 14) return "morning";
  if (h < 21) return "afternoon";
  return "evening";
}

export function HeroGreeting({
  workspaceName,
  userName,
  publishedCount,
  draftCount,
  totalCount,
  createPost,
}: {
  workspaceName: string;
  userName: string;
  publishedCount: number;
  draftCount: number;
  totalCount: number;
  createPost: (formData: FormData) => Promise<void>;
}) {
  const [greeting, setGreeting] = useState<keyof typeof GREETINGS>("morning");

  useEffect(() => {
    setGreeting(pickPart(new Date()));
  }, []);

  const status =
    totalCount === 0
      ? "Aún no has creado contenido. Empieza con tu primera entrada."
      : draftCount > 0
        ? `${draftCount} ${draftCount === 1 ? "borrador" : "borradores"} esperando · ${publishedCount} publicados.`
        : `${publishedCount} ${publishedCount === 1 ? "post publicado" : "posts publicados"} · todo al día.`;

  return (
    <header className="relative overflow-hidden rounded-2xl border bg-card/40 p-6 md:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute -left-16 -bottom-24 size-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand-3), transparent 60%)" }}
      />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {workspaceName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight md:text-4xl">
            {GREETINGS[greeting]}, <span className="gradient-text">{firstName(userName)}</span>.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">{status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createPost}>
            <PrimaryAction />
          </form>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href="/admin/contenido">
              Ver contenido <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function PrimaryAction() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" size="lg" className="rounded-xl" disabled={pending}>
      <Sparkles className="size-4" /> {pending ? "Creando…" : "Crear entrada"}
    </Button>
  );
}

function firstName(s: string): string {
  return s.trim().split(/\s+/)[0] ?? s;
}
