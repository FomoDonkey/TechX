import { AuroraBackground } from "@/components/marketing/aurora-background";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
      <AuroraBackground />
      <div className="font-display text-8xl font-black tracking-tighter">
        <span className="gradient-text">404</span>
      </div>
      <h1 className="mt-4 text-balance text-2xl font-semibold md:text-3xl">
        Esta página se fue de paseo.
      </h1>
      <p className="mt-2 max-w-md text-balance text-muted-foreground">
        Quizá nunca existió, o la moviste, o el slug cambió. Volvamos a casa.
      </p>
      <Button asChild variant="gradient" size="lg" className="mt-8 rounded-2xl">
        <Link href="/">
          <ArrowLeft className="mr-1" /> Volver al inicio
        </Link>
      </Button>
    </main>
  );
}
