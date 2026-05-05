import { z } from "zod";

/**
 * Validador estricto para URLs **outbound absolutas** (http o https).
 *
 * **Casos de uso**:
 * - Webhooks (target URL): el server hace POST → debe ser http(s) público.
 * - ogImage: navegadores y crawlers cargan la URL → bloquea `data:`/`javascript:`.
 * - Imports remotos por URL: pre-validación antes del SSRF check (`assertPublicUrl`).
 * - Menús externos: la URL acaba en un `<a href>` del sitio público.
 *
 * **Por qué no `z.string().url()`**:
 * Zod usa `URL` constructor, que ACEPTA `javascript:alert(1)` y `data:text/html,...`.
 * Para fields user-controllable que renderizan o disparan fetch, eso abre la puerta
 * a stored XSS y SSRF a esquemas raros (file:, gopher:). Nuestro check exige
 * explícitamente prefix `http://` o `https://`.
 *
 * **Diferencia con `isSafeUrl` (blocks/registry.ts)**:
 * `isSafeUrl` permite también paths relativos (`/algo`), anchors (`#id`), `mailto:`,
 * `tel:`, y cadena vacía — apropiado para fields *internos* de bloques que pueden
 * apuntar al propio sitio. `isHttpUrl` es más estricto: SOLO http(s) absoluto.
 */
export function isHttpUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 2048) return false;
  if (!/^https?:\/\/[^\s<>"]+$/i.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlSchema = (max = 2048) =>
  z.string().max(max).refine(isHttpUrl, { message: "Se requiere URL http(s) válida" });
