"use client";

import { deleteMediaAction } from "@/app/admin/medios/_actions";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";

export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function doDelete() {
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} archivo(s)?`)) return;
    start(async () => {
      const res = await deleteMediaAction(ids);
      if (res.ok) {
        toast.success(`${res.deleted} archivo(s) eliminado(s)`);
        onClear();
        router.refresh();
      }
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: doDelete depende de ids vía closure; ids.join evita re-suscribir innecesario
  useEffect(() => {
    function handler() {
      doDelete();
    }
    window.addEventListener("csm:medios:bulk-delete", handler);
    return () => window.removeEventListener("csm:medios:bulk-delete", handler);
  }, [ids.join(",")]);

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-2xl">
      <span className="text-sm font-medium">{ids.length} seleccionados</span>
      <span className="text-muted-foreground/50">·</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={doDelete}
        disabled={pending}
        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Eliminar
      </Button>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Limpiar selección"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
