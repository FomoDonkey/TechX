import { applySecurityHeaders, generateNonce, shouldEnforceCsp } from "@/lib/security-headers";
import { type NextRequest, NextResponse } from "next/server";

// `/preview/branch/<token>` es público (token + opcional password) — sólo el preview
// admin `/preview/<uuid>` requiere login. Por eso usamos `[^/]+` y NO el patrón
// `(\/|$)` para no matchear el segmento `branch`.
const PROTECTED = [
  /^\/admin(\/|$)/,
  /^\/onboarding(\/|$)/,
  // `/preview/<id>` (Tiptap admin) protegido. `/preview/branch/...` (público) excluido.
  /^\/preview\/(?!branch\/)[^/]+/,
  // `/builder-frame/<pageId>` — iframe del page builder, requiere editor+.
  /^\/builder-frame\/[^/]+/,
];
const GUEST_ONLY = [/^\/login$/, /^\/registro$/, /^\/olvide$/];

const ANON_COOKIE = "csm_aid";
const ANON_RE = /^[A-Za-z0-9_-]{16,128}$/;
const ONE_YEAR_S = 60 * 60 * 24 * 365;

/**
 * F11a — Path-based workspace prefix. Cualquier URL pública que empiece por
 * `/s/<slug>/...` se reescribe a `/...` para que las rutas existentes (`/`,
 * `/blog`, `/blog/[slug]`, etc.) sigan matcheando, y se inyecta la cabecera
 * `x-csm-path-slug` que el resolver Node lee en SSR para elegir workspace.
 *
 * Slugs: lowercase a-z 0-9 guión, 3-30 chars (mismo regex que `src/domain/slug.ts`).
 */
const SLUG_PREFIX = /^\/s\/([a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?)(\/.*|$)/;

function generateAnonId(): string {
  // 16 bytes random → base64url. Edge runtime: globalThis.crypto está disponible.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i] ?? 0);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Better-Auth firma su cookie como `csm.session_token` (cookiePrefix=csm).
  // Cookies grandes (OAuth con id_token) se chunkean en `.0/.1/.2…`.
  const isAuthed = req.cookies
    .getAll()
    .some((c) => c.name === "csm.session_token" || c.name.startsWith("csm.session_token."));

  if (PROTECTED.some((re) => re.test(pathname)) && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (GUEST_ONLY.some((re) => re.test(pathname)) && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Generamos un nonce CSP por request y lo pasamos a la app vía request header
  // `x-nonce` para que server components puedan inyectarlo en `<Script nonce={…}>`.
  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // F11a — Conserva el pathname canónico. SSR lo necesita para construir
  // redirects 301 al renombrar slug (los rewrites cambian req.nextUrl pero
  // el header conserva la URL original que el visitante tecleó).
  requestHeaders.set("x-csm-pathname", pathname);

  // F11a — `/s/<slug>/...` → reescribe a `/...` con header. NO aplicamos el
  // rewrite a rutas /admin, /api, /preview, /builder-frame, /onboarding,
  // /login, /registro, /olvide ni /s solitario — solo URLs públicas.
  const rewriteTarget = computeSlugRewrite(pathname);
  let response: NextResponse;
  if (rewriteTarget) {
    requestHeaders.set("x-csm-path-slug", rewriteTarget.slug);
    const url = req.nextUrl.clone();
    url.pathname = rewriteTarget.rest;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isHttps = req.nextUrl.protocol === "https:";
  applySecurityHeaders(response.headers, {
    nonce,
    // Default report-only. Activable con `CSP_ENFORCE=1` cuando el dashboard
    // `/admin/ajustes/seguridad/headers` muestre la cola de reports limpia.
    enforce: shouldEnforceCsp(),
    hsts: isHttps && process.env.NODE_ENV === "production",
    hstsPreload: false,
  });

  // Set csm_aid (anon id) si no existe o es inválido — necesario para A/B
  // sticky variant y futuros analytics. No bloquea, no logea.
  const existing = req.cookies.get(ANON_COOKIE)?.value;
  if (!existing || !ANON_RE.test(existing)) {
    response.cookies.set({
      name: ANON_COOKIE,
      value: generateAnonId(),
      maxAge: ONE_YEAR_S,
      sameSite: "lax",
      // No httpOnly: el cliente lee este id para tracking de conversions.
      httpOnly: false,
      // En prod queremos secure; el toggle automático según protocolo lo hace
      // Next al respetar req.nextUrl.protocol, pero forzamos secure si https.
      secure: isHttps,
      path: "/",
    });
  }
  return response;
}

function computeSlugRewrite(pathname: string): { slug: string; rest: string } | null {
  const m = pathname.match(SLUG_PREFIX);
  if (!m) return null;
  const slug = m[1];
  if (!slug) return null;
  const rest = m[2] || "/";
  // Sanity: si tras el strip queda otro `/s/...` (recursión), abort.
  if (rest.startsWith("/s/")) return null;
  return { slug, rest };
}

export const config = {
  matcher: [
    // Match todo excepto static assets y rutas internas de Next/api. El
    // middleware se ejecuta en el sitio público + admin para setear csm_aid.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|map|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|json|xml|txt)).*)",
  ],
};
