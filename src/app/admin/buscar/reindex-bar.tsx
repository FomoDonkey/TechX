"use client";

import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { reindexAllAction } from "./_actions";

export function ReindexBar() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function processBatch() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ai/process-jobs?size=20", { method: "POST" });
      if (!r.ok) throw new Error("error");
      const j = (await r.json()) as { processed: number; errors: number; skipped: number };
      toast.success(
        `Procesados: ${j.processed} · saltados: ${j.skipped}${j.errors > 0 ? ` · errores: ${j.errors}` : ""}`,
      );
      router.refresh();
    } catch {
      toast.error("No se pudo procesar el lote");
    } finally {
      setBusy(false);
    }
  }

  async function reindexAll() {
    setBusy(true);
    try {
      const r = await reindexAllAction();
      if (!r.ok) throw new Error(r.error);
      toast.success(`Re-encoladas ${r.count} entradas. Pulsa "Procesar lote" para empezar.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto inline-flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={processBatch} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{" "}
        Procesar lote
      </Button>
      <Button size="sm" variant="ghost" onClick={reindexAll} disabled={busy}>
        Re-encolar todo
      </Button>
    </div>
  );
}
