import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-32">
      <div className="relative overflow-hidden rounded-3xl border bg-card/40 p-10 text-center backdrop-blur md:p-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "conic-gradient(from 180deg at 50% 50%, oklch(0.55 0.22 290) 0deg, oklch(0.72 0.25 340) 120deg, oklch(0.78 0.18 180) 240deg, oklch(0.55 0.22 290) 360deg)",
            filter: "blur(80px)",
          }}
        />
        <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
          ¿Listo para <span className="gradient-text">brillar</span>?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-muted-foreground">
          Lanza tu CSM en menos de 60 segundos. Gratis para siempre. Tu contenido, tus datos.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="xl" className="rounded-2xl">
            <Link href="/admin">
              Crear mi workspace <ArrowRight className="ml-1" />
            </Link>
          </Button>
          <Button asChild variant="glass" size="xl" className="rounded-2xl">
            <Link href="https://github.com" target="_blank" rel="noreferrer">
              <Github className="mr-1" />
              Star en GitHub
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
