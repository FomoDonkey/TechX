/**
 * Slug validation + reserved list para subdominios y dominios custom de
 * workspaces (F11a · "URL pública gratis").
 *
 * El slug es la pieza editable que va antes del root domain en
 * `<slug>.<ROOT_DOMAIN>` o tras `/s/` cuando se sirve por path.
 *
 * Reglas:
 *  - 3-30 chars, lowercase a-z 0-9 y guión simple `-`.
 *  - No empieza/termina con guión, no doble guión.
 *  - No coincide con un slug reservado (rutas raíz del producto y términos
 *    técnicos clásicos como `www`, `mail`, etc.).
 */

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

/**
 * Slugs reservados. Cualquier ruta raíz de la app pública o admin va aquí, +
 * subdominios técnicos clásicos. Mantén ORDENADO alfabéticamente para evitar
 * duplicados al añadir nuevos.
 */
export const RESERVED_SLUGS = new Set<string>([
  // App routes (no pueden chocar con un workspace path)
  "admin",
  "ajustes",
  "api",
  "autor",
  "blog",
  "buscar",
  "builder",
  "builder-frame",
  "comentarios",
  "checkout",
  "feed",
  "forms",
  "legal",
  "login",
  "logout",
  "membresia",
  "members",
  "olvide",
  "onboarding",
  "panel",
  "preview",
  "registro",
  "robots",
  "rss",
  "s", // prefijo path-based (`/s/<slug>/...`)
  "sitemap",
  "suscribir",
  "tag",
  "template-preview",

  // Subdominios técnicos clásicos (protegen DNS/MX records)
  "app",
  "auth",
  "cdn",
  "dashboard",
  "dev",
  "developer",
  "docs",
  "ftp",
  "git",
  "help",
  "host",
  "images",
  "img",
  "imap",
  "m",
  "mail",
  "media",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "pop",
  "pop3",
  "root",
  "secure",
  "server",
  "smtp",
  "ssl",
  "static",
  "stats",
  "status",
  "support",
  "test",
  "vpn",
  "webmail",
  "ws",
  "www",
]);

export type SlugValidation = { ok: true; slug: string } | { ok: false; error: SlugError };

export type SlugError =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "leading_or_trailing_dash"
  | "double_dash"
  | "reserved";

export function validateSlug(input: unknown): SlugValidation {
  if (typeof input !== "string") return { ok: false, error: "empty" };
  const slug = input.trim().toLowerCase();
  if (!slug) return { ok: false, error: "empty" };
  if (slug.length < 3) return { ok: false, error: "too_short" };
  if (slug.length > 30) return { ok: false, error: "too_long" };
  if (slug.startsWith("-") || slug.endsWith("-"))
    return { ok: false, error: "leading_or_trailing_dash" };
  if (slug.includes("--")) return { ok: false, error: "double_dash" };
  if (!SLUG_REGEX.test(slug)) return { ok: false, error: "invalid_chars" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "reserved" };
  return { ok: true, slug };
}

export function slugErrorMessage(err: SlugError): string {
  switch (err) {
    case "empty":
      return "Escribe un nombre para tu sitio.";
    case "too_short":
      return "Debe tener al menos 3 caracteres.";
    case "too_long":
      return "Como mucho 30 caracteres.";
    case "invalid_chars":
      return "Solo letras minúsculas, números y guiones (a-z, 0-9, -).";
    case "leading_or_trailing_dash":
      return "No puede empezar ni terminar con guión.";
    case "double_dash":
      return "Sin guiones consecutivos.";
    case "reserved":
      return "Ese nombre está reservado por el sistema.";
  }
}

/**
 * Dominios reservados / "no tiene sentido como custom domain".
 * Bloquea localhost (self-reference), `*.local` (mDNS), `example.*` (IANA reserved),
 * y los TLDs de plataformas de hosting comunes (no son dominios "propios" del user
 * — se gestionan por el resolver vía deploy host detection).
 */
const RESERVED_CUSTOM_DOMAIN_LABELS = new Set<string>([
  "localhost",
  "example.com",
  "example.org",
  "example.net",
  "test",
  "invalid",
]);

const RESERVED_CUSTOM_DOMAIN_SUFFIXES = [
  ".local",
  ".localhost",
  ".test",
  ".invalid",
  ".example",
  ".vercel.app",
  ".fly.dev",
  ".up.railway.app",
  ".onrender.com",
  ".netlify.app",
  ".pages.dev",
];

/**
 * Validador básico de un dominio custom (RFC 1035 simplificado).
 * Acepta `example.com`, `blog.example.com`, `xn--ñandú.com` (IDN ya en punycode).
 * Rechaza:
 *  - Espacios, esquemas (`http://`), paths (`/`).
 *  - IPs (v4 públicas Y privadas — `10.*`, `192.168.*`, `172.16-31.*`, `127.*`, `169.254.*`).
 *  - Hosts reservados (`localhost`, `*.local`, `example.com`, etc).
 *  - Hosts auto-asignados por hosting (`*.vercel.app`, etc) — esos se sirven vía
 *    deploy host detection, no se "vinculan" como custom.
 */
export function validateCustomDomain(input: unknown): {
  ok: boolean;
  domain?: string;
  error?: "empty" | "invalid" | "too_long" | "ip_address" | "reserved";
} {
  if (typeof input !== "string") return { ok: false, error: "empty" };
  const raw = input.trim().toLowerCase();
  if (!raw) return { ok: false, error: "empty" };
  if (raw.length > 253) return { ok: false, error: "too_long" };
  // Strip esquema y trailing slash si el user pega "https://foo.com/"
  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // IPs públicas y privadas (no tiene sentido como custom domain)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) return { ok: false, error: "ip_address" };

  // Hosts reservados
  if (RESERVED_CUSTOM_DOMAIN_LABELS.has(cleaned)) {
    return { ok: false, error: "reserved" };
  }
  if (RESERVED_CUSTOM_DOMAIN_SUFFIXES.some((s) => cleaned === s.slice(1) || cleaned.endsWith(s))) {
    return { ok: false, error: "reserved" };
  }

  // Cada label: 1-63 chars, alphanum y guión, sin guión inicial/final.
  const re = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!re.test(cleaned)) return { ok: false, error: "invalid" };
  return { ok: true, domain: cleaned };
}
