import "server-only";
import type { Workspace } from "@/db/schema";
import Link from "next/link";

interface PublicNavProps {
  workspace: Pick<Workspace, "id" | "name" | "slug" | "branding"> | null | undefined;
}

/**
 * Minimal public site navigation. Renders the workspace name (with optional logo)
 * + 3 default links (Inicio, Blog, Suscribirse). Themed via parent ThemeShell.
 */
export function PublicNav({ workspace }: PublicNavProps) {
  const name = workspace?.name ?? "CSM";
  const branding = workspace?.branding as { logo?: string; voice?: string } | null | undefined;
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--th-border)] bg-[color:var(--th-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--th-bg)]/65">
      <nav className="mx-auto flex h-16 max-w-[var(--th-container-max)] items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[color:var(--th-fg)]"
          style={{ fontFamily: "var(--th-font-display)" }}
        >
          {branding?.logo ? (
            <img src={branding.logo} alt={name} className="h-7 w-auto" />
          ) : (
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--th-radius-md)] bg-[color:var(--th-brand)] text-[color:var(--th-brand-fg)] text-sm font-bold"
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-[15px]">{name}</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <NavLink href="/">Inicio</NavLink>
          <NavLink href="/blog">Blog</NavLink>
          <NavLink href="/suscribir" emphasis>
            Suscribirse
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
  emphasis,
}: {
  href: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  if (emphasis) {
    return (
      <Link
        href={href}
        className="ml-2 inline-flex items-center rounded-[var(--th-radius-pill)] bg-[color:var(--th-brand)] px-4 py-1.5 text-sm font-medium text-[color:var(--th-brand-fg)] shadow-[var(--th-shadow-md)] transition-transform hover:scale-[1.02]"
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-[var(--th-radius-md)] px-3 py-1.5 text-[color:var(--th-fg-muted)] transition-colors hover:bg-[color:var(--th-bg-muted)] hover:text-[color:var(--th-fg)]"
    >
      {children}
    </Link>
  );
}
