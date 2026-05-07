import { LogoLockup } from "@/components/brand/logo";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col items-center justify-between gap-6 border-t pt-8 md:flex-row">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <LogoLockup size="sm" />
          <span className="hidden sm:inline">·</span>
          <span>Hecho con cariño en ES · MIT</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground transition-colors">
            Admin
          </Link>
          <Link href="/blog" className="hover:text-foreground transition-colors">
            Blog
          </Link>
          <Link href="https://github.com" className="hover:text-foreground transition-colors">
            GitHub
          </Link>
          <Link href="/sitemap.xml" className="hover:text-foreground transition-colors">
            Sitemap
          </Link>
          <Link href="/legal/privacidad" className="hover:text-foreground transition-colors">
            Privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
