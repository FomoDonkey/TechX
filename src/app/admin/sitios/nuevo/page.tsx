/**
 * F11d — /admin/sitios/nuevo
 *
 * Form simple para crear un nuevo workspace (sitio). Siguiendo el patrón
 * del onboarding pero sin AI: solo nombre + identificador.
 */

import { requireWorkspace } from "@/lib/workspace";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewSiteForm } from "./client";

export const metadata: Metadata = { title: "Nuevo sitio · techx" };
export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  // Crear un workspace nuevo es operación con coste real (DB, posibles envíos
  // de email, branding, etc.). Requiere mínimo "editor" para evitar que un
  // viewer (rol más bajo) pueda spam-crear workspaces. Cualquier user logueado
  // que no tenga workspace todavía pasa por /onboarding (no por aquí).
  await requireWorkspace("editor");
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <Link
        href="/admin/sitios"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3" />
        Mis sitios
      </Link>
      <header className="mb-6 space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Nuevo sitio</h1>
        <p className="text-sm text-muted-foreground">
          Cada sitio es independiente: tiene su propia URL, posts, branding y miembros. Vives todos
          dentro de la misma instalación.
        </p>
      </header>
      <NewSiteForm />
    </div>
  );
}
