/**
 * Composer: convierte un body editable (Tiptap-like JSON) o HTML raw del admin
 * en HTML inline-safe para emails. Sanitiza tags peligrosos, reescribe enlaces
 * a través del proxy de tracking, e inyecta el pixel de apertura.
 *
 * Reglas (defensa en profundidad):
 *  - Tags permitidos: a, p, br, hr, h1..h4, strong, em, b, i, u, ul, ol, li,
 *    blockquote, img, pre, code, span, div, table, tbody, tr, td, th
 *  - `<script>`, `<iframe>`, `<style>`, `<link>`, `<meta>`, `<form>`, `<input>`,
 *    handlers `on*`, `javascript:` URLs → strip silencioso
 *  - `href` permitidos: http(s), mailto:, tel:; resto → strip
 *  - `src` permitidos: http(s), data:image/* (estáticos pequeños); resto → strip
 */

import { tokens } from "./tokens";

const ALLOWED_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const ALLOWED_ATTRS_GLOBAL = new Set(["style", "title", "lang", "dir"]);
const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["align", "valign", "colspan", "rowspan", "width"]),
  th: new Set(["align", "valign", "colspan", "rowspan", "scope"]),
  table: new Set(["align", "border", "cellpadding", "cellspacing", "role", "width"]),
  pre: new Set(),
};

function decodeHtmlEntitiesForUrlCheck(input: string): string {
  // Decodifica entidades HTML decimales (&#58;) y hex (&#x3A;) + las nombradas
  // mínimas relevantes a esquemas de URL. NO usamos un parser completo —
  // sólo necesitamos defendernos de `javascript&#58;...` y similares.
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&colon;/gi, ":")
    .replace(/&lpar;/gi, "(")
    .replace(/&rpar;/gi, ")");
}

function isSafeUrl(url: string, allowDataImage = false): boolean {
  // Strip control chars + zero-width chars que algunos clientes ignoran al
  // resolver la URL. Bypass clasico: control char antes de javascript:.
  const trimmed = url
    // biome-ignore lint/suspicious/noControlCharactersInRegex: defendemos contra control chars en URLs
    .replace(/[\x00-\x20\u00a0]+/g, "")
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, "");
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  // Decodificamos entidades antes de comprobar el esquema. Bloquea
  // `javascript&#58;...` y `&#x6A;avascript:...` que algunos clientes/navegadores
  // resuelven al equivalente literal.
  const decoded = decodeHtmlEntitiesForUrlCheck(trimmed);
  // Lista negra explícita de esquemas peligrosos (defensa en profundidad antes
  // del allowlist).
  if (/^\s*(javascript|vbscript|data|file|blob|about):/i.test(decoded)) {
    if (allowDataImage && /^\s*data:image\//i.test(decoded)) {
      return true;
    }
    return false;
  }
  const proto = decoded.match(/^([a-z][a-z0-9+\-.]*):/i)?.[1]?.toLowerCase();
  if (!proto) return true; // relative, OK
  if (proto === "http" || proto === "https") return true;
  if (proto === "mailto" || proto === "tel") return true;
  if (allowDataImage && decoded.toLowerCase().startsWith("data:image/")) return true;
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizador HTML mínimo basado en regex/parser de tokens muy conservador.
 * Evita dependencias externas (DOMPurify es DOM-side, sanitize-html es 200KB).
 * Para v1 esto es suficiente: el body procede del editor admin (autenticado
 * editor+) y el output se ve sólo en clientes de email (no es HTML del DOM
 * navegable). Para body desde untrusted input ampliaremos en F8c.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Strip script/style/iframe/object/embed/svg/math completamente (incl. su contenido).
  // Añadidos svg/math (pueden contener event handlers + foreignObject) y noframes.
  let cleaned = html.replace(
    /<\s*(script|style|iframe|object|embed|noscript|noframes|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // Strip tags vacíos peligrosos sin cierre. base puede cambiar resolución de URLs.
  cleaned = cleaned.replace(
    /<\s*(script|iframe|object|embed|link|meta|input|form|base|svg|math|frame|frameset|button|select|option|textarea)\b[^>]*\/?>/gi,
    "",
  );
  // Strip comentarios HTML (incluye condicionales de Outlook) — pueden contener
  // bypass como `<!--[if]><script>...<![endif]-->`.
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // Strip CDATA por si acaso.
  cleaned = cleaned.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // Procesar etiquetas restantes: regex que captura `</tag>` o `<tag attrs>`.
  return cleaned.replace(
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\/?\s*>/g,
    (full, slash: string | undefined, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      const isClose = !!slash;
      if (isClose) return `</${tag}>`;
      // Self-closing: marcador `/>` o tag típicamente void (br/hr/img).
      const selfClose = /\/\s*>$/.test(full) || tag === "br" || tag === "hr" || tag === "img";
      const safeAttrs = sanitizeAttrs(tag, rawAttrs);
      return `<${tag}${safeAttrs ? ` ${safeAttrs}` : ""}${selfClose ? " /" : ""}>`;
    },
  );
}

function sanitizeAttrs(tag: string, raw: string): string {
  if (!raw) return "";
  // Match attr="value", attr='value', attr=value, o attr (boolean).
  const out: string[] = [];
  const re = /\s+([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while (true) {
    match = re.exec(raw);
    if (!match) break;
    const name = match[1]?.toLowerCase() ?? "";
    if (!name) continue;
    if (name.startsWith("on")) continue; // strip onload, onclick, etc.
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    const tagAttrs = ALLOWED_ATTRS_BY_TAG[tag];
    const isAllowed = ALLOWED_ATTRS_GLOBAL.has(name) || tagAttrs?.has(name);
    if (!isAllowed) continue;

    if (name === "href") {
      if (!isSafeUrl(value, false)) continue;
    }
    if (name === "src") {
      if (!isSafeUrl(value, true)) continue;
    }
    if (name === "style") {
      // Permitimos style pero strip url(javascript:), expression(...)
      if (/javascript:|expression\s*\(/i.test(value)) continue;
    }

    out.push(`${name}="${escapeHtml(value)}"`);
  }
  return out.join(" ");
}

/**
 * Reescribe `<a href="...">` para pasar por el proxy de click. Sólo URLs http(s)
 * absolutas (no mailto: ni anchors). Ignora si href ya empieza por la URL del
 * proxy (idempotente).
 *
 * Soporta los 3 estilos HTML: `href="..."`, `href='...'`, `href=...` (sin
 * comillas). Históricamente sólo cubríamos `href="..."` y un href con single-
 * quotes que esquivara el sanitizer pasaba sin tracking + permitía abrir un
 * `javascript:` schema sin pasar por el verify de `/api/email/click`.
 */
export function rewriteLinksForTracking(
  html: string,
  recipientId: string,
  proxyOrigin: string,
  kind: "c" | "d" = "c",
): { html: string; rewritten: number } {
  let count = 0;
  const proxyPrefix = `${proxyOrigin}/api/email/click/`;
  const rewritten = html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))([^>]*)>/gi,
    (full, pre, dq, sq, uq, post) => {
      const href = (typeof dq === "string" ? dq : typeof sq === "string" ? sq : uq) ?? "";
      const trimmed = String(href).trim();
      if (!trimmed) return full;
      if (trimmed.startsWith(proxyPrefix)) return full;
      if (!/^https?:\/\//i.test(trimmed)) return full;
      const token = tokens.signClick(recipientId, trimmed, kind);
      count += 1;
      return `<a${pre}href="${proxyPrefix}${token}"${post}>`;
    },
  );
  return { html: rewritten, rewritten: count };
}

/**
 * Convierte un body Tiptap-like (JSON) en HTML simple. Si ya es string, lo
 * pasa por sanitizeHtml. Para v1 soportamos los bloques básicos del editor;
 * el editor de campañas reusa el mismo Tiptap del editor de posts.
 */
export type ComposerBody =
  | string
  | { type: string; content?: ComposerBody[]; text?: string; attrs?: Record<string, unknown> };

export function bodyToHtml(body: unknown): string {
  if (typeof body === "string") return sanitizeHtml(body);
  if (!body || typeof body !== "object") return "";
  return sanitizeHtml(jsonToHtml(body as ComposerBody));
}

function jsonToHtml(node: ComposerBody): string {
  if (typeof node === "string") return escapeHtml(node);
  if (!node || typeof node !== "object") return "";

  const type = (node.type ?? "").toLowerCase();
  const text = typeof node.text === "string" ? escapeHtml(node.text) : "";
  const inner = (node.content ?? []).map(jsonToHtml).join("");
  const href = typeof node.attrs?.href === "string" ? node.attrs.href : "";
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" ? escapeHtml(node.attrs.alt) : "";
  const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;

  switch (type) {
    case "doc":
      return inner;
    case "paragraph":
      return `<p style="margin:0 0 16px;color:#b8b3c7;">${inner || text}</p>`;
    case "heading": {
      const tag = `h${Math.min(4, Math.max(1, level))}`;
      return `<${tag} style="margin:24px 0 12px;color:#fff;font-weight:700;">${inner || text}</${tag}>`;
    }
    case "blockquote":
      return `<blockquote style="border-left:3px solid #9b5cff;padding:8px 16px;margin:16px 0;color:#b8b3c7;">${inner}</blockquote>`;
    case "bulletlist":
    case "bullet_list":
      return `<ul style="margin:0 0 16px 20px;color:#b8b3c7;">${inner}</ul>`;
    case "orderedlist":
    case "ordered_list":
      return `<ol style="margin:0 0 16px 20px;color:#b8b3c7;">${inner}</ol>`;
    case "listitem":
    case "list_item":
      return `<li style="margin:4px 0;">${inner || text}</li>`;
    case "horizontalrule":
    case "horizontal_rule":
      return `<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:24px 0;" />`;
    case "image":
      return src && /^https?:\/\//i.test(src)
        ? `<img src="${escapeHtml(src)}" alt="${alt}" style="max-width:100%;border-radius:12px;margin:16px 0;display:block;" />`
        : "";
    case "codeblock":
    case "code_block": {
      const first = node.content?.[0];
      const codeText =
        typeof first === "object" && first !== null && typeof first.text === "string"
          ? first.text
          : "";
      return `<pre style="background:#0a0814;color:#c08bff;padding:16px;border-radius:12px;overflow:auto;font-size:13px;font-family:'JetBrains Mono',ui-monospace,monospace;">${escapeHtml(codeText)}</pre>`;
    }
    case "hardbreak":
    case "hard_break":
      return "<br />";
    case "text": {
      const marks =
        (node.attrs?.marks as
          | Array<{ type: string; attrs?: Record<string, unknown> }>
          | undefined) ?? [];
      let out = text;
      for (const mark of marks) {
        switch (mark.type) {
          case "bold":
            out = `<strong>${out}</strong>`;
            break;
          case "italic":
            out = `<em>${out}</em>`;
            break;
          case "underline":
            out = `<u>${out}</u>`;
            break;
          case "code":
            out = `<code style="background:rgba(155,92,255,.15);padding:1px 6px;border-radius:4px;font-family:'JetBrains Mono',ui-monospace,monospace;">${out}</code>`;
            break;
          case "link": {
            const linkHref = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
            if (linkHref && /^(https?:|mailto:|tel:)/i.test(linkHref)) {
              out = `<a href="${escapeHtml(linkHref)}" style="color:#c08bff;text-decoration:underline;">${out}</a>`;
            }
            break;
          }
          default:
            break;
        }
      }
      return out;
    }
    default:
      // Si tiene href/text usa anchor genérico
      if (href && /^(https?:|mailto:|tel:)/i.test(href)) {
        return `<a href="${escapeHtml(href)}" style="color:#c08bff;">${inner || text || escapeHtml(href)}</a>`;
      }
      return inner || text;
  }
}

/**
 * Texto plano fallback (algunos clientes lo prefieren). Strip tags, mantiene
 * URLs visibles.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
