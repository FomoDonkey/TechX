import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex max-w-6xl items-center justify-between px-4">
      <div className="glass flex w-full items-center justify-between rounded-full px-4 py-2 shadow-sm">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-full bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-white">
            <Sparkles className="size-4" />
          </span>
          <span className="text-base">CSM</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="#caracteristicas"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Características
          </Link>
          <Link
            href="#por-que"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Por qué CSM
          </Link>
          <Link
            href="#stack"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Stack
          </Link>
          <Link
            href="#fases"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Roadmap
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="gradient" size="sm" className="rounded-full">
            <Link href="/admin">Entrar al admin</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
