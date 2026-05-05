import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <nav className="mb-8 flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          ← Inicio
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/legal/privacidad" className="hover:underline">
          Privacidad
        </Link>
        <Link href="/legal/cookies" className="hover:underline">
          Cookies
        </Link>
        <Link href="/legal/terminos" className="hover:underline">
          Términos
        </Link>
      </nav>
      <article className="prose prose-zinc max-w-none dark:prose-invert">{children}</article>
    </div>
  );
}
