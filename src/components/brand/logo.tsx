import { cn } from "@/lib/utils";

/**
 * Identidad de marca **techx**.
 *
 * Tres componentes:
 *  - `<LogoMark>` — solo el monograma TX (cuadrado rojo). Para sidebar, favicon visual,
 *    badges pequeños.
 *  - `<LogoWordmark>` — el wordmark "techx" en rojo. Para footer, contextos donde hay
 *    espacio horizontal.
 *  - `<LogoLockup>` — monograma + wordmark en horizontal. Para topbar admin, nav
 *    público, login.
 *
 * El monograma se dibuja como SVG inline (no PNG) para que escale nítido en cualquier
 * tamaño y respete el `currentColor` cuando se usa sobre fondos contrastados.
 */

const TX_PATH =
  // Monograma TX construido a partir del logo techx (Photoroom).
  // T: barra horizontal arriba + asta vertical centro. X: cruzada saliendo del fondo.
  // Coordenadas en viewBox 100x100, coherente con el aspecto cuadrado del logo original.
  "M16 22h68v12H56v44H44V34H16zM58 38l11 14 11-14h12L66 62l26 32H80L57 65 34 94H22l26-32L22 38z";

export function LogoMark({
  className,
  variant = "filled",
}: {
  className?: string;
  /** "filled" = cuadrado relleno con TX en blanco. "ghost" = TX en color brand sobre transparente. */
  variant?: "filled" | "ghost";
}) {
  if (variant === "ghost") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={cn("text-[var(--brand-1)]", className)}
        aria-hidden="true"
      >
        <title>techx</title>
        <path d={TX_PATH} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("text-[var(--brand-1)]", className)}
      aria-hidden="true"
    >
      <title>techx</title>
      <rect width="100" height="100" rx="22" fill="currentColor" />
      <path d={TX_PATH} fill="white" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[var(--brand-1)] tracking-tight",
        "lowercase font-bold",
        className,
      )}
      style={{ letterSpacing: "-0.02em" }}
    >
      techx
    </span>
  );
}

export function LogoLockup({
  className,
  size = "md",
  showWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const sizes = {
    sm: { mark: "size-6", word: "text-base" },
    md: { mark: "size-8", word: "text-lg" },
    lg: { mark: "size-10", word: "text-2xl" },
  } as const;
  const cfg = sizes[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cfg.mark} />
      {showWordmark && <LogoWordmark className={cfg.word} />}
    </span>
  );
}
