import { createSymbolFormAction } from "@/app/admin/simbolos/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listSymbols } from "@/lib/symbols";
import { requireWorkspace } from "@/lib/workspace";
import { Component, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Símbolos · CSM" };

export default async function SymbolsPage() {
  const ctx = await requireWorkspace("editor");
  const symbols = await listSymbols(ctx.workspace.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Component className="size-3.5" /> Componentes reusables
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Símbolos
          </h1>
          <p className="mt-2 max-w-prose text-sm text-foreground/70">
            Crea componentes que puedes insertar en cualquier página. Edita el símbolo una vez y se
            actualiza en todos los sitios donde aparece.
          </p>
        </div>
        <details className="relative">
          <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 [&::-webkit-details-marker]:hidden">
            <Plus className="size-4" /> Nuevo símbolo
          </summary>
          <form
            action={createSymbolFormAction}
            className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-2xl border bg-popover p-4 shadow-2xl"
          >
            <div className="space-y-1.5">
              <Label htmlFor="ns-name">Nombre</Label>
              <Input id="ns-name" name="name" placeholder="Header, Footer, Hero…" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-desc">Descripción (opcional)</Label>
              <Textarea id="ns-desc" name="description" rows={2} />
            </div>
            <Button type="submit" variant="gradient" className="w-full">
              Crear símbolo
            </Button>
          </form>
        </details>
      </header>

      {symbols.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/30 p-12 text-center">
          <Component className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tienes símbolos. Crea el primero (Header, Footer, etc.) para reusar entre páginas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {symbols.map((s) => (
            <Link
              key={s.id}
              href={`/admin/simbolos/${s.id}`}
              className="group flex flex-col gap-2 rounded-2xl border bg-card/40 p-5 transition-colors hover:bg-card/70"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Component className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-base font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.slug}</div>
                </div>
              </div>
              {s.description ? (
                <p className="line-clamp-2 text-xs text-foreground/70">{s.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
