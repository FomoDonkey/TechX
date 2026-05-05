/**
 * Layout standalone del iframe del builder. NO hereda chrome de admin
 * (sidebar/topbar) — esta ruta se carga DENTRO de un iframe en el editor
 * de páginas y solo debe pintar el contenido de la layout.
 *
 * Hereda del root layout (`src/app/layout.tsx`) que carga fonts, theme
 * provider y globals.css. Las clases responsive Tailwind (`md:`, `lg:`)
 * dentro del iframe responden al ancho del iframe — que es lo que
 * queremos para que el preview por dispositivo sea fiel.
 *
 * Auth: protegida por `middleware.ts` (PROTECTED regex incluye `/builder-frame/`).
 */

import type { ReactNode } from "react";

export default function BuilderFrameLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
