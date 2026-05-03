/**
 * Helper anti open-redirect.
 *
 * Acepta SOLO paths internos:
 *   - Empieza por "/"
 *   - El segundo char NO es "/" ni "\" (evita //evil.com y /\evil.com que el
 *     browser interpreta como protocolo-relativos)
 *   - No es URL absoluta (sin ":" en los primeros 8 chars, evita javascript:)
 *
 * Devuelve el path si es seguro, o el fallback si no lo es.
 */
export function safeInternalPath(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const s = input.trim();
  if (s.length === 0 || s.length > 2048) return fallback;
  if (!s.startsWith("/")) return fallback;
  // Reject protocol-relative // or /\
  if (s.length >= 2) {
    const second = s[1];
    if (second === "/" || second === "\\") return fallback;
  }
  // Reject any colon in the first segment (mitigates exotic schemes via path)
  const firstSegment = s.split("/")[1] ?? "";
  if (firstSegment.includes(":")) return fallback;
  return s;
}
