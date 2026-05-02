import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { Mail, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Suscribirse",
  description: "Recibe nuevas publicaciones por email",
};

export default async function SubscribePage() {
  const ws = features.database ? await getDefaultPublicWorkspace() : null;
  const workspaceName = ws?.name ?? "CSM";

  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <div className="rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-8 shadow-[var(--th-shadow-md)] md:p-12">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-[color:var(--th-brand)] text-[color:var(--th-brand-fg)] shadow-[var(--th-shadow-glow)]">
              <Mail className="size-6" />
            </span>
            <h1
              className="mt-5 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--th-font-display)" }}
            >
              Suscríbete a {workspaceName}
            </h1>
            <p className="mt-3 text-[color:var(--th-fg-muted)]">
              Recibe nuevas publicaciones en tu bandeja de entrada. Sin spam, fácil cancelación.
            </p>
          </div>

          <form className="space-y-3" aria-label="Formulario de suscripción">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              disabled
              placeholder="tu@email.com"
              className="w-full rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-4 py-3 text-[color:var(--th-fg)] outline-none placeholder:text-[color:var(--th-fg-subtle)] focus:border-[color:var(--th-brand)] focus:ring-2 focus:ring-[color:var(--th-ring)] disabled:opacity-60"
            />
            <button
              type="button"
              disabled
              className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--th-radius-md)] bg-[color:var(--th-brand)] px-4 py-3 font-medium text-[color:var(--th-brand-fg)] opacity-70"
            >
              <Sparkles className="size-4" />
              Próximamente
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[color:var(--th-fg-subtle)]">
            La suscripción por email llega con la fase de Newsletter. Mientras tanto, sigue por RSS:{" "}
            <a href="/feed.xml" className="text-[color:var(--th-brand)] hover:underline">
              feed.xml
            </a>
            ,{" "}
            <a href="/feed.atom" className="text-[color:var(--th-brand)] hover:underline">
              feed.atom
            </a>{" "}
            o{" "}
            <a href="/feed.json" className="text-[color:var(--th-brand)] hover:underline">
              feed.json
            </a>
            .
          </p>
        </div>
      </main>
    </ThemeShell>
  );
}
