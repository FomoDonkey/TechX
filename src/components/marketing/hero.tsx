import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-4 text-center">
      <Badge variant="gradient" className="mb-6 gap-1.5 px-4 py-1.5 text-xs">
        <Sparkles className="size-3" />
        Edición colaborativa · IA conversacional · open source
      </Badge>

      <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
        Publica donde otros{" "}
        <span className="relative inline-block">
          <span className="gradient-text">brillan</span>
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-2 mx-auto w-full"
            viewBox="0 0 200 8"
            preserveAspectRatio="none"
          >
            <title>Subrayado</title>
            <path
              d="M2 6 Q50 -2 100 4 T198 4"
              stroke="oklch(0.66 0.2 18)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </span>
        ,
        <br />
        diseña como nadie.
      </h1>

      <p className="mt-8 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
        El CMS espectacular para equipos editoriales modernos. Edición colaborativa en tiempo real,
        IA conversacional integrada, búsqueda semántica, branching de contenido, multi-tenant. Open
        source y gratis para empezar.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="gradient" size="xl" className="rounded-2xl">
          <Link href="/admin">
            Empezar ahora <ArrowRight className="ml-1" />
          </Link>
        </Button>
        <Button asChild variant="glass" size="xl" className="rounded-2xl">
          <Link href="https://github.com" target="_blank" rel="noreferrer">
            <Github className="mr-1" />
            Ver código
          </Link>
        </Button>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="size-3.5 text-success" /> Setup en &lt;90s
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Lighthouse 100/100/100/100
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Type-safe end-to-end
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" /> Stack 100% gratis
        </span>
      </div>
    </section>
  );
}
