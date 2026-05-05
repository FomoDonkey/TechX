/**
 * Index del catálogo de showcase components.
 *
 * Mapea `template.id` → componente React custom de página completa.
 *
 * **Patrón**:
 * - Cada showcase es un client component aislado en `./<template-id>.tsx`.
 * - El preview route (`/template-preview/[id]`) prefiere el showcase si existe;
 *   si no, hace fallback al `RenderLayout` block-based del template.
 * - Cuando el usuario hace "Usar esta plantilla" se inserta SIEMPRE el block
 *   layout (versión editable). El showcase es **solo preview** — no editable.
 *
 * Para añadir una plantilla nueva:
 *  1. Crea `./mi-plantilla.tsx` con el componente.
 *  2. Añade el id al map abajo.
 *  3. Asegúrate de que existe `id` correspondiente en `page-templates.ts`.
 */

import type { ComponentType } from "react";
/**
 * Todas las plantillas están MIGRADAS a bloques editables (`tpl-*`).
 *
 * El route `/template-preview/[id]` ya no usa este map — siempre llama
 * `RenderLayout(buildLayout())`, lo que garantiza paridad por construcción
 * entre preview e inserted page.
 *
 * Migradas ✅:
 *  - saas-magnetic → bloques tpl-asme-*
 *  - portfolio-spotlight → bloques tpl-jack-*
 *  - agency-spotlight → bloques tpl-michael-*
 *  - coming-soon-typewriter → bloques tpl-mint-*
 *  - docs-aurora → bloques tpl-nimbus-*
 *  - launch-marquee → bloques tpl-securify-*
 *  - blog-particles → bloques tpl-magazine-*
 *  - newsletter-typewriter → bloques tpl-substack-*
 *
 * Los archivos showcase originales (`./saas-magnetic.tsx`, etc.) se mantienen
 * como referencia/fallback histórico, pero no se importan aquí.
 */
export const SHOWCASE_BY_ID: Record<string, ComponentType> = {};

export function getShowcase(id: string): ComponentType | null {
  return SHOWCASE_BY_ID[id] ?? null;
}
