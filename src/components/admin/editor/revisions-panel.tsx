"use client";

import { restoreRevisionAction } from "@/app/admin/contenido/_actions";
import { RelativeTime } from "@/components/admin/dashboard/relative-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { diffWords } from "diff";
import { History, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

export type RevisionItem = {
  id: string;
  summary: string | null;
  authorId: string | null;
  createdAt: string;
};

type Props = {
  entryId: string;
  revisions: RevisionItem[];
  currentText: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function RevisionsPanel({ entryId, revisions, currentText, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(revisions[0]?.id ?? null);
  const [snapshotText, setSnapshotText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(revisions[0]?.id ?? null);
  }, [open, revisions]);

  useEffect(() => {
    if (!open || !selected) return;
    let aborted = false;
    setLoading(true);
    fetch(`/api/admin/revisions/${selected}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; bodyText?: string }) => {
        if (aborted) return;
        setSnapshotText(data.bodyText ?? "");
      })
      .catch(() => {
        if (!aborted) setSnapshotText("");
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [open, selected]);

  const diff = useMemo(() => {
    if (!snapshotText) return null;
    return diffWords(snapshotText, currentText, { ignoreCase: false });
  }, [snapshotText, currentText]);

  function restore() {
    if (!selected) return;
    startTransition(async () => {
      const result = await restoreRevisionAction({ entryId, revisionId: selected });
      if (result.ok) {
        toast.success("Revisión restaurada");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo restaurar");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[140] bg-background/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[150] flex w-full max-w-2xl flex-col border-l border-border/70 bg-popover shadow-2xl shadow-black/30 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 font-display text-base font-semibold">
                <History className="size-4" /> Historial de revisiones
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                {revisions.length} {revisions.length === 1 ? "snapshot" : "snapshots"}. Cada cambio
                significativo o cada 5 min.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40">
              <X className="size-4" />
            </Dialog.Close>
          </header>
          <div className="flex flex-1 overflow-hidden">
            <ul className="w-56 shrink-0 overflow-y-auto border-r border-border/60 p-2">
              {revisions.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Sin revisiones aún.
                </li>
              ) : (
                revisions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.id)}
                      className={cn(
                        "block w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        selected === r.id ? "bg-primary/12" : "hover:bg-muted/40",
                      )}
                    >
                      <RelativeTime date={r.createdAt} className="font-medium" />
                      <p className="truncate text-xs text-muted-foreground">
                        {r.summary || "Sin resumen"}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>Diff con el contenido actual</span>
                {selected ? (
                  <Button size="sm" variant="outline" onClick={restore} disabled={pending}>
                    <RotateCcw className="size-3.5" /> {pending ? "Restaurando…" : "Restaurar"}
                  </Button>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 font-sans text-sm leading-relaxed">
                {loading ? (
                  <p className="text-muted-foreground">Cargando snapshot…</p>
                ) : !diff ? (
                  <p className="text-muted-foreground">
                    Selecciona una revisión para ver los cambios.
                  </p>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">
                    {diff.map((part, i) => (
                      <span
                        key={`d-${i}-${part.value.length}`}
                        className={cn(
                          part.added && "rounded bg-success/15 text-success",
                          part.removed && "rounded bg-destructive/15 text-destructive line-through",
                          !part.added && !part.removed && "text-foreground/80",
                        )}
                      >
                        {part.value}
                      </span>
                    ))}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
