/**
 * Cabeceras de seguridad para sitio público + admin.
 *
 * **Diseño:**
 * - CSP en `report-only` por defecto en F10a (telemetría sin romper UI). Cuando
 *   tengamos endpoint `/api/csp-report` con datos, pasamos a enforce en F10d.
 * - CSP usa `'strict-dynamic'` con nonce per-request — permite inline scripts
 *   firmados pero bloquea inyecciones.
 * - Whitelisted: Stripe, UploadThing, Vercel og/blob, Replicate (proxy), Resend
 *   (analytics open-tracking pixel cuando aplique).
 * - HSTS sólo en prod (en dev https no aplica). `preload` requiere domain
 *   submission a https://hstspreload.org así que lo dejamos opt-in.
 */

export type SecurityHeaderOptions = {
  /** Nonce inyectado en CSP `script-src`. Debe coincidir con el nonce de cada `<Script>` server-rendered. */
  nonce: string;
  /** `true` añade `Content-Security-Policy`, `false` añade `Content-Security-Policy-Report-Only`. */
  enforce: boolean;
  /** Activa HSTS (sólo en prod sobre https). */
  hsts: boolean;
  /** Activa preload HSTS — cuidado: irreversible para subdominios. */
  hstsPreload: boolean;
};

/**
 * Construye la cadena CSP. Lista whitelisted basada en proveedores que CSM
 * usa en runtime; ampliar aquí cuando se integre algún script de terceros.
 */
export function buildCsp({ nonce }: { nonce: string }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic' permite que scripts firmados con nonce carguen otros sin
    // tener que listarlos explícitamente. 'unsafe-inline' es ignorado por
    // navegadores que entienden 'strict-dynamic' (queda como fallback IE).
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-inline'",
      "https:",
      "https://js.stripe.com",
      "https://challenges.cloudflare.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://*.upload.io",
      "https://utfs.io",
      "https://*.utfs.io",
      "https://*.public.blob.vercel-storage.com",
      "https://images.unsplash.com",
      "https://avatars.githubusercontent.com",
      "https://lh3.googleusercontent.com",
      // Showcase templates assets — usados sólo en /template-preview/[id] para
      // renderizar plantillas espectaculares con vídeos+imágenes ya curados.
      // Todos son CDNs públicos de assets pre-aprobados (no user-generated).
      "https://d8j0ntlcm91z4.cloudfront.net",
      "https://shrug-person-78902957.figma.site",
      "https://motionsites.ai",
      "https://images.higgs.ai",
    ],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      "https://api.resend.com",
      "https://api.replicate.com",
      "https://*.upload.io",
      "https://api.uploadthing.com",
      "wss://*.vercel.app",
      // SSE + LISTEN/NOTIFY (mismo origen) ya cubierto por 'self'.
    ],
    "frame-src": ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    "media-src": ["'self'", "data:", "blob:", "https:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "upgrade-insecure-requests": [],
    // Endpoint local que persiste violaciones en `csp_reports`. Browsers antiguos
    // sólo entienden `report-uri`; los modernos prefieren el header `Reporting-Endpoints`
    // (lo añadimos en `applySecurityHeaders`).
    "report-uri": ["/api/security/csp-report"],
    "report-to": ["csp-endpoint"],
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function buildPermissionsPolicy(): string {
  // Bloqueamos por defecto features sensibles. El editor pedirá permiso runtime
  // para microphone (voice-to-content) sólo cuando el user lo active.
  return [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "display-capture=()",
    "document-domain=()",
    "encrypted-media=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=(self)",
    "midi=()",
    "payment=(self)",
    "picture-in-picture=(self)",
    "publickey-credentials-get=(self)",
    "screen-wake-lock=()",
    "sync-xhr=(self)",
    "usb=()",
    "xr-spatial-tracking=()",
  ].join(", ");
}

export function applySecurityHeaders(headers: Headers, opts: SecurityHeaderOptions): void {
  const csp = buildCsp({ nonce: opts.nonce });
  if (opts.enforce) {
    headers.set("Content-Security-Policy", csp);
  } else {
    headers.set("Content-Security-Policy-Report-Only", csp);
  }
  // Reporting API moderna: navegadores que la entienden enviarán reportes vía
  // este header en lugar de `report-uri`. Mismo endpoint, formato distinto
  // (gestionado en `/api/security/csp-report`).
  headers.set("Reporting-Endpoints", `csp-endpoint="/api/security/csp-report"`);
  headers.set("Permissions-Policy", buildPermissionsPolicy());
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-DNS-Prefetch-Control", "on");
  if (opts.hsts) {
    const value = opts.hstsPreload
      ? "max-age=63072000; includeSubDomains; preload"
      : "max-age=31536000; includeSubDomains";
    headers.set("Strict-Transport-Security", value);
  }
}

/**
 * Resuelve si CSP debe aplicarse en modo enforce. Por defecto: report-only.
 * Para promover a enforce en prod basta con `CSP_ENFORCE=1` en el env.
 *
 * El admin puede consultar el estado actual desde `/admin/ajustes/seguridad/headers`
 * que también muestra reportes históricos.
 */
export function shouldEnforceCsp(): boolean {
  const flag = process.env.CSP_ENFORCE;
  if (!flag) return false;
  return flag === "1" || flag.toLowerCase() === "true";
}

export function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i] ?? 0);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
