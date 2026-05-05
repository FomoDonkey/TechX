/**
 * Snippet sanitization compartido entre adapters.
 *
 * Estrategia: el adapter genera el snippet con marcadores literales `<mark>`
 * y `</mark>`. Aquí escapamos todo el HTML del documento (que puede contener
 * `<`, `>`, `&`, `"`) y luego restauramos solo nuestros marcadores controlados.
 *
 * El resultado es seguro para `dangerouslySetInnerHTML`.
 */
export function sanitizeSnippet(snippet: string | null | undefined): string {
  if (!snippet) return "";
  const escaped = snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/&lt;mark&gt;/g, "<mark>").replace(/&lt;\/mark&gt;/g, "</mark>");
}

/**
 * Snippet generator para backends que NO tienen `ts_headline` nativo (MySQL).
 *
 * Toma `text` y `terms` (palabras de la query), localiza la primera ocurrencia
 * (case-insensitive, accent-insensitive básico), recorta una ventana alrededor
 * y envuelve cada término con `<mark>...</mark>`.
 *
 * Notas:
 *  - Si no hay match, devuelve los primeros `windowChars` chars (fallback).
 *  - Términos cortos (<3 chars) se ignoran para evitar marcas spurias en stop-words.
 *  - Solo emite los marcadores `<mark>` literales — la función `sanitizeSnippet`
 *    final los hará HTML-safe.
 */
export function generateSnippet(
  text: string | null | undefined,
  terms: string[],
  opts: { windowChars?: number } = {},
): string {
  if (!text) return "";
  const windowChars = opts.windowChars ?? 200;
  const validTerms = terms
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 6);

  if (validTerms.length === 0) {
    return text.slice(0, windowChars) + (text.length > windowChars ? "…" : "");
  }

  // Buscamos primera ocurrencia (case-insensitive) para anclar la ventana.
  const norm = text.toLowerCase();
  let firstHit = -1;
  for (const term of validTerms) {
    const idx = norm.indexOf(term.toLowerCase());
    if (idx !== -1 && (firstHit === -1 || idx < firstHit)) firstHit = idx;
  }

  let start = 0;
  let prefix = "";
  let suffix = "";
  if (firstHit !== -1) {
    start = Math.max(0, firstHit - Math.floor(windowChars / 3));
    prefix = start > 0 ? "…" : "";
  }
  let end = Math.min(text.length, start + windowChars);
  if (end < text.length) suffix = "…";
  // Snap al boundary de palabra cuando es posible (evita cortar mid-word).
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(" ", end);
    if (lastSpace > start + windowChars * 0.6) end = lastSpace;
  }
  if (start > 0) {
    const nextSpace = text.indexOf(" ", start);
    if (nextSpace !== -1 && nextSpace < start + 20) start = nextSpace + 1;
  }

  let window = text.slice(start, end);

  // Marcamos cada término. Construimos un único regex alternativo para evitar
  // pasadas múltiples y cap_lock conflicts. Escapamos chars regex de los términos.
  const escaped = validTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length > 0) {
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    window = window.replace(re, "<mark>$1</mark>");
  }

  return prefix + window + suffix;
}
