import { requireUser } from "@/auth/server";
import { requireWorkspace } from "@/lib/workspace";
import { resolveTheme } from "@/themes/active";
import { BUILTIN_THEMES_BY_SLUG, getBuiltinTheme } from "@/themes/builtins";
import { themeCss, themeFontsLink } from "@/themes/css";
import type { NextRequest } from "next/server";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  await requireUser();
  const ctx = await requireWorkspace("editor");
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  if (!slug || !SLUG_RE.test(slug) || slug.length > 80) {
    return new Response("Slug inválido", { status: 400 });
  }

  // Validar antes de resolver: rechaza slugs que no son ni builtin ni custom del workspace.
  // Sin esto, un slug arbitrario caería al getBuiltinTheme(slug) que devuelve el default
  // silenciosamente — preview engañoso. Mejor 404 explícito.
  try {
    const resolved = await resolveTheme(ctx.workspace.id, slug);
    const isKnown = resolved.source === "custom" || Boolean(BUILTIN_THEMES_BY_SLUG[slug]);
    if (!isKnown) {
      return new Response("Tema no encontrado", { status: 404 });
    }
    const spec = resolved.spec.slug === slug ? resolved.spec : getBuiltinTheme(slug);
    const css = themeCss(spec);
    const fontsHref = themeFontsLink(spec);

    const html = renderPreviewHtml({ wsName: ctx.workspace.name, spec, css, fontsHref });
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return new Response("Error al resolver el tema", { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPreviewHtml(args: {
  wsName: string;
  spec: ReturnType<typeof getBuiltinTheme>;
  css: string;
  fontsHref: string | null;
}): string {
  const { wsName, spec, css, fontsHref } = args;
  const fontsTag = fontsHref
    ? `<link rel="stylesheet" href="${escapeHtml(fontsHref)}" crossorigin="anonymous">`
    : "";
  const ws = escapeHtml(wsName);
  const themeName = escapeHtml(spec.name);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview · ${themeName}</title>
${fontsTag}
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  body { font-family: var(--th-font-sans, system-ui); background: var(--th-bg); color: var(--th-fg); -webkit-font-smoothing: antialiased; }
  ${css}
  [data-csm-theme] { padding: 0; min-height: 100vh; }
  .nav { position:sticky; top:0; z-index:10; backdrop-filter:saturate(150%) blur(10px); background: color-mix(in oklch, var(--th-bg) 88%, transparent); border-bottom: 1px solid var(--th-border); }
  .nav-inner { max-width: var(--th-container-max); margin: 0 auto; padding: 1rem 1.5rem; display:flex; align-items:center; justify-content:space-between; }
  .brand { font-family: var(--th-font-display); font-weight:700; font-size: 1.05rem; display:flex; align-items:center; gap:.6rem; }
  .brand-mark { display:inline-flex; align-items:center; justify-content:center; width:1.75rem; height:1.75rem; border-radius: var(--th-radius-md); background:var(--th-brand); color: var(--th-brand-fg); font-weight:800; font-size:.85rem; }
  .nav a { color: var(--th-fg-muted); text-decoration:none; font-size:.875rem; padding:.4rem .75rem; border-radius: var(--th-radius-md); }
  .nav a:hover { color: var(--th-fg); background: var(--th-bg-muted); }
  .cta { background: var(--th-brand); color: var(--th-brand-fg); border-radius: var(--th-radius-pill); padding: .55rem 1rem; font-weight: 500; box-shadow: var(--th-shadow-md); }
  .hero { max-width: var(--th-container-max); margin: 0 auto; padding: 4rem 1.5rem 3rem; }
  .badge { display:inline-flex; align-items:center; gap:.4rem; border:1px solid var(--th-border); background:var(--th-surface); color:var(--th-fg-muted); padding:.3rem .75rem; border-radius: var(--th-radius-pill); font-size: .75rem; }
  h1 { font-family: var(--th-font-display); font-size: clamp(2rem, 6vw, 3.6rem); line-height:1.05; margin: 1rem 0 1rem; letter-spacing:-0.02em; }
  .lede { font-family: var(--th-font-serif); font-size: clamp(1.05rem, 2vw, 1.25rem); color: var(--th-fg-muted); max-width: 42rem; line-height: 1.55; }
  .grid { max-width: var(--th-container-max); margin: 0 auto; padding: 0 1.5rem 4rem; display:grid; gap:1.25rem; grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 900px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  .card { padding: 1.25rem 1.25rem 1.5rem; border:1px solid var(--th-border); background: var(--th-bg-elevated); border-radius: var(--th-radius-xl); transition: transform var(--th-motion-duration) var(--th-motion-ease), box-shadow var(--th-motion-duration) var(--th-motion-ease); }
  .card:hover { transform: translateY(-2px); box-shadow: var(--th-shadow-lg); border-color: var(--th-brand); }
  .card .meta { font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: var(--th-fg-subtle); }
  .card h3 { font-family: var(--th-font-display); margin: .35rem 0 .5rem; font-size: 1.35rem; line-height:1.2; letter-spacing:-0.01em; }
  .card p { color: var(--th-fg-muted); font-size: .95rem; line-height:1.55; margin:0; }
  footer { border-top: 1px solid var(--th-border); padding: 2rem 1.5rem; text-align:center; color: var(--th-fg-subtle); font-size:.85rem; }
</style>
</head>
<body>
<div data-csm-theme="${escapeHtml(spec.slug)}">
  <header class="nav"><div class="nav-inner">
    <span class="brand"><span class="brand-mark">${ws.slice(0, 1)}</span>${ws}</span>
    <nav><a href="#">Inicio</a><a href="#">Blog</a><a href="#" class="cta">Suscribirse</a></nav>
  </div></header>
  <section class="hero">
    <span class="badge">✦ Preview · ${themeName}</span>
    <h1>${escapeHtml(spec.tagline)}</h1>
    <p class="lede">${escapeHtml(spec.description)} Esta es una previsualización en vivo del tema seleccionado, con tipografías, paletas y radios reales aplicados al instante.</p>
  </section>
  <div class="grid">
    ${[
      "Lanzamiento V2",
      "Cómo escribimos código",
      "Notas del kickoff",
      "Estética del producto",
      "Diario de redacción",
      "Recetas de comunidad",
    ]
      .map(
        (t, i) =>
          `<article class="card"><p class="meta">May 2026 · ${5 + i} min</p><h3>${escapeHtml(t)}</h3><p>Una pequeña muestra de cómo se vería un listado de publicaciones con este tema. Tipografía, color y aire respiran como en producción.</p></article>`,
      )
      .join("")}
  </div>
  <footer>${ws} · Preview de tema</footer>
</div>
</body>
</html>`;
}
