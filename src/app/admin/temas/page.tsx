import { requireUser } from "@/auth/server";
import { requireWorkspace } from "@/lib/workspace";
import { listAvailableThemes, resolveActiveTheme } from "@/themes/active";
import type { Metadata } from "next";
import { ThemeGallery } from "./gallery";

export const metadata: Metadata = { title: "Temas" };

export default async function ThemesPage() {
  await requireUser();
  const ctx = await requireWorkspace("editor");
  const [{ builtins, customs }, active] = await Promise.all([
    listAvailableThemes(ctx.workspace.id),
    resolveActiveTheme(ctx.workspace.id),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Apariencia
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Temas</h1>
        <p className="max-w-2xl text-muted-foreground">
          Cambia la apariencia del sitio público al instante. Cada tema reescribe tipografías,
          paletas, sombras y layouts. Solo afecta al sitio público — el admin mantiene su estilo.
        </p>
      </header>

      <ThemeGallery
        builtins={builtins}
        customs={customs.map((c) => ({ id: c.id, spec: c.spec, basedOn: c.basedOn }))}
        activeSlug={active.spec.slug}
      />
    </div>
  );
}
