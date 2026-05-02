"use client";

import { deleteCollectionAction } from "@/app/admin/colecciones/_actions";
import { ConfirmDialog } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { ChevronRight, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type CollectionItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  isSingleton: boolean;
  isBuiltin: boolean;
  entryCount: number;
  createdAt: Date;
};

export function CollectionsList({ collections }: { collections: CollectionItem[] }) {
  if (collections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No tienes colecciones aún. Pulsa <strong>Nueva colección</strong> para crear la primera.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((c) => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  );
}

function lucide(name: string | null) {
  const fallback = "Layers";
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[
    name ?? fallback
  ];
  return Cmp ?? Icons.Layers;
}

function CollectionCard({ collection: c }: { collection: CollectionItem }) {
  const Icon = lucide(c.icon);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const detailHref = `/admin/colecciones/${c.id}`;
  // Rutas reales: /admin/contenido/c/[collection] hace el redirect a editor
  // automáticamente para singletons (auto-create entry si no existe).
  const contentHref = `/admin/contenido/c/${c.slug}`;

  function onDelete() {
    startTransition(async () => {
      const res = await deleteCollectionAction(c.id);
      if (res.ok) {
        toast.success("Colección eliminada");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo eliminar");
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border bg-card/40 p-5 transition-colors hover:bg-card/70">
      <div className="flex items-start justify-between gap-3">
        <Link href={detailHref} className="flex flex-1 items-start gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold">{c.name}</span>
              {c.isBuiltin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Lock className="size-2.5" /> builtin
                </span>
              ) : null}
              {c.isSingleton ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                  singleton
                </span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">/{c.slug}</div>
            {c.description ? (
              <p className="line-clamp-2 pt-1 text-xs text-foreground/70">{c.description}</p>
            ) : null}
          </div>
        </Link>
        {!c.isBuiltin ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Eliminar ${c.name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          {c.isSingleton
            ? c.entryCount > 0
              ? "Configurado"
              : "Sin contenido"
            : `${c.entryCount} ${c.entryCount === 1 ? "entrada" : "entradas"}`}
        </span>
        <Link
          href={contentHref}
          className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground"
        >
          Abrir contenido <ChevronRight className="size-3" />
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`¿Eliminar "${c.name}"?`}
        description={
          <>
            Se eliminarán <strong>{c.entryCount}</strong>{" "}
            {c.entryCount === 1 ? "entrada" : "entradas"} asociadas. Esta acción no se puede
            deshacer.
          </>
        }
        confirmLabel="Eliminar"
        variant="destructive"
        pending={pending}
        onConfirm={onDelete}
      />
    </div>
  );
}
