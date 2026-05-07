import { Badge } from "@/components/ui/badge";
import { requireWorkspace } from "@/lib/workspace";
import { listMenus } from "@/menus/lib";
import { type MenuItem, flattenItems } from "@/menus/types";
import { ArrowRight, ListTree } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateMenuButton } from "./create-button";

export const metadata: Metadata = { title: "Menús · techx" };
export const dynamic = "force-dynamic";

const LOCATION_LABEL: Record<string, string> = {
  header: "Cabecera",
  footer: "Pie",
  sidebar: "Lateral",
  custom: "Personalizado",
};

export default async function MenusPage() {
  const ctx = await requireWorkspace("editor");
  const items = await listMenus(ctx.workspace.id);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Menús</h1>
          <p className="text-sm text-muted-foreground">
            Construye menús de navegación con drag-and-drop y anidamiento. Disponibles para tu sitio
            público o vía API/JSON.
          </p>
        </div>
        <CreateMenuButton />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <ListTree className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sin menús todavía. Empieza desde una plantilla (Cabecera, Footer con columnas) o desde
            cero.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {items.map((m) => {
            const items = (m.items as unknown as MenuItem[] | null) ?? [];
            const totalItems = flattenItems(items).length;
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/menus/${m.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {LOCATION_LABEL[m.location] ?? m.location}
                      </Badge>
                      {m.isDefault ? (
                        <Badge className="bg-primary/15 text-primary text-[10px]">
                          Por defecto
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /menus/{m.slug}
                    </p>
                    <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                      <span>
                        Ítems: <strong className="text-foreground">{totalItems}</strong>
                      </span>
                      <span>
                        Versión: <strong className="text-foreground">v{m.version}</strong>
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
