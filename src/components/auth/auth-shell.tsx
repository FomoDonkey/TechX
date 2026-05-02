import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden">
      {/* gradient mesh background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_15%_15%,oklch(from_var(--brand-1)_l_c_h_/_0.35),transparent),radial-gradient(50%_60%_at_85%_30%,oklch(from_var(--brand-2)_l_c_h_/_0.32),transparent),radial-gradient(60%_60%_at_50%_100%,oklch(from_var(--brand-3)_l_c_h_/_0.25),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,oklch(from_var(--background)_l_c_h_/_0.7))]" />
        <svg
          className="absolute inset-0 size-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <title>Noise</title>
          <filter id="n">
            <feTurbulence baseFrequency="0.85" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#n)" />
        </svg>
      </div>

      <header className="flex items-center justify-between p-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-medium tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-white shadow-md transition-transform group-hover:scale-105">
            ✦
          </span>
          <span className="font-display text-lg font-semibold">CSM</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-12">
        <div className="glass rounded-3xl p-8 shadow-[0_24px_80px_-30px_oklch(from_var(--brand-1)_l_c_h_/_0.5)]">
          <h1 className="text-balance font-display text-3xl font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}
