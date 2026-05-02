import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-4 text-center">
      <Badge variant="gradient" className="mb-6 gap-1.5 px-4 py-1.5 text-xs">
        <Sparkles className="size-3" />
        Versión 0.1 · open source · gratis para siempre
      </Badge>

      <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
        El CMS que <span className="gradient-text">brilla</span>
        <br />
        donde WordPress se{" "}
        <span className="relative inline-block">
          apaga
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-2 mx-auto w-full"
            viewBox="0 0 200 8"
            preserveAspectRatio="none"
          >
            <title>Subrayado</title>
            <path
              d="M2 6 Q50 -2 100 4 T198 4"
              stroke="oklch(0.72 0.25 340)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </span>
        .
      </h1>

      <p className="mt-8 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
        Publica como en <strong className="text-foreground">Notion</strong>. Diseña como en{" "}
        <strong className="text-foreground">Framer</strong>. Escala como{" "}
        <strong className="text-foreground">Vercel</strong>. Mide como{" "}
        <strong className="text-foreground">Linear</strong>. Un CMS open-source, AI-native,
        multi-tenant, headless-first. En español, gratis y espectacular.
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
            Ver en GitHub
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
