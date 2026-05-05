/**
 * Plantilla genérica para páginas "próximamente" — secciones del sidebar
 * que están reservadas pero aún no implementadas. Evita el 404 dando un
 * placeholder consistente con el resto del admin.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

type Props = {
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Roadmap concreto — qué viene en esta sección. */
  features?: string[];
  eta?: string;
};

export function ComingSoonPage({ title, description, Icon, features = [], eta }: Props) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-8" />
      </div>
      <Badge variant="outline" className="mb-4 gap-1.5 border-violet-400/40 text-violet-300">
        <Sparkles className="size-3" />
        Próximamente
      </Badge>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-lg text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
        {description}
      </p>
      {features.length > 0 ? (
        <ul className="mt-8 grid w-full max-w-md gap-2 text-left text-sm">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/30 px-4 py-3"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-foreground/85">{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {eta ? (
        <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
          ETA · {eta}
        </p>
      ) : null}
      <Button asChild variant="outline" size="sm" className="mt-10">
        <Link href="/admin">
          <ArrowLeft className="size-3.5" />
          Volver al inicio
        </Link>
      </Button>
    </div>
  );
}
