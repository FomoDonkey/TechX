import { createPageFormAction } from "@/app/admin/paginas/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPages } from "@/lib/pages";
import { requireWorkspace } from "@/lib/workspace";
import { Eye, FileText, Home, Pencil, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Páginas · techx" };

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireWorkspace("editor");
  const sp = await searchParams;
  const status =
    sp.status === "published" || sp.status === "draft" || sp.status === "archived"
      ? sp.status
      : "all";
  const { rows, counts } = await listPages(ctx.workspace.id, {
    status,
    q: sp.q || undefined,
    limit: 200,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <FileText className="size-3.5" /> Builder visual
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Páginas
          </h1>
          <p className="mt-2 max-w-prose text-sm text-foreground/70">
            Crea páginas con el editor visual estilo Framer. Arrastra bloques, ajusta props y
            publica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/plantillas"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkles className="size-4" /> Empezar desde plantilla
          </Link>
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 [&::-webkit-details-marker]:hidden">
              <Plus className="size-4" /> Nueva página
            </summary>
            <form
              action={createPageFormAction}
              className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-2xl border bg-popover p-4 shadow-2xl"
            >
              <div className="space-y-1.5">
                <Label htmlFor="np-title">Título</Label>
                <Input id="np-title" name="title" placeholder="Mi nueva página" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-path">Ruta (opcional)</Label>
                <Input id="np-path" name="path" placeholder="/sobre-nosotros" />
              </div>
              <Button type="submit" variant="gradient" className="w-full">
                Crear en blanco
              </Button>
              <p className="text-[11px] text-muted-foreground">
                ¿Prefieres un diseño listo? Prueba las{" "}
                <Link href="/admin/plantillas" className="text-primary hover:underline">
                  plantillas
                </Link>
                .
              </p>
            </form>
          </details>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/30 p-1">
        {(["all", "draft", "published", "archived"] as const).map((s) => {
          const active = status === s;
          const params = new URLSearchParams();
          if (s !== "all") params.set("status", s);
          const href = params.toString() ? `?${params.toString()}` : "/admin/paginas";
          return (
            <Link
              key={s}
              href={href}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              scroll={false}
            >
              {
                {
                  all: "Todas",
                  draft: "Borradores",
                  published: "Publicadas",
                  archived: "Archivadas",
                }[s]
              }
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {counts[s] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No tienes páginas aún. Crea la primera con el botón <strong>Nueva página</strong>.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/40">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                  {p.isHome ? <Home className="size-4" /> : <FileText className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/paginas/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.isHome ? <Badge className="bg-primary/12 text-primary">home</Badge> : null}
                    {p.status === "published" ? (
                      <Badge className="bg-success/15 text-success">publicada</Badge>
                    ) : p.status === "archived" ? (
                      <Badge variant="secondary">archivada</Badge>
                    ) : (
                      <Badge variant="secondary">borrador</Badge>
                    )}
                  </div>
                  <code className="text-xs text-muted-foreground">{p.path}</code>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {p.status === "published" ? (
                  <Link
                    href={encodeURI(p.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Ver"
                  >
                    <Eye className="size-3.5" />
                  </Link>
                ) : null}
                <Link
                  href={`/admin/paginas/${p.id}`}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Editar"
                >
                  <Pencil className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
