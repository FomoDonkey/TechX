"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FormSchema } from "@/forms/types";
import { isInputField } from "@/forms/types";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSubmissionsAction, setSubmissionStatusAction } from "../../_actions";

type SubmissionRow = {
  id: string;
  createdAt: string;
  status: "received" | "spam" | "processed" | "archived";
  spamScore: number;
  spamReasons: string[];
  country: string | null;
  data: Record<string, unknown>;
};

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    received: { label: "Recibida", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    processed: { label: "Procesada", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
    archived: { label: "Archivada", cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
    spam: { label: "Spam", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  };
  const conf = m[status] ?? { label: status, cls: "" };
  return <Badge className={`text-[10px] ${conf.cls}`}>{conf.label}</Badge>;
}

export function SubmissionsClient({
  rows,
  formSchema,
}: {
  rows: SubmissionRow[];
  formSchema: FormSchema | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<SubmissionRow | null>(null);
  const [pending, start] = useTransition();

  const inputFields = useMemo(() => {
    if (!formSchema) return [];
    return formSchema.fields
      .filter(isInputField)
      .filter((f): f is typeof f & { key: string } => "key" in f && Boolean(f.key));
  }, [formSchema]);

  const previewKeys = inputFields.slice(0, 3).map((f) => f.key);

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function bulkSetStatus(status: SubmissionRow["status"]) {
    if (selected.size === 0) return;
    start(async () => {
      for (const id of selected) {
        await setSubmissionStatusAction({ id, status });
      }
      toast.success(`${selected.size} actualizadas`);
      setSelected(new Set());
      location.reload();
    });
  }

  function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Eliminar ${selected.size} submissions?`)) return;
    start(async () => {
      const r = await deleteSubmissionsAction(Array.from(selected));
      if (r.ok) {
        toast.success(`${r.deleted} eliminadas`);
        setSelected(new Set());
        location.reload();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-2">
          <span className="text-xs">{selected.size} seleccionadas</span>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={pending}
            onClick={() => bulkSetStatus("processed")}
          >
            <CheckCircle2 className="size-3.5" /> Procesar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={pending}
            onClick={() => bulkSetStatus("archived")}
          >
            <Archive className="size-3.5" /> Archivar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={pending}
            onClick={() => bulkSetStatus("spam")}
          >
            <ShieldAlert className="size-3.5" /> Marcar spam
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-rose-500"
            disabled={pending}
            onClick={bulkDelete}
          >
            <Trash2 className="size-3.5" /> Eliminar
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs">
            <tr>
              <th className="p-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  className="size-3.5"
                />
              </th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Estado</th>
              {previewKeys.map((k) => (
                <th key={k} className="p-2 text-left font-mono">
                  {k}
                </th>
              ))}
              <th className="p-2 text-left">Spam</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setSelected(next);
                    }}
                    className="size-3.5"
                  />
                </td>
                <td className="p-2 text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("es-ES")}
                </td>
                <td className="p-2">
                  <StatusBadge status={r.status} />
                </td>
                {previewKeys.map((k) => (
                  <td key={k} className="p-2 text-xs max-w-[200px] truncate">
                    {String(r.data[k] ?? "")}
                  </td>
                ))}
                <td className="p-2 text-[11px]">
                  {r.spamScore > 0 ? (
                    <Badge variant="outline" className="text-[10px]">
                      {r.spamScore}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">
                  <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={detail !== null} onOpenChange={() => setDetail(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-semibold">Submission</Dialog.Title>
            {detail ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={detail.status} />
                  <span>{new Date(detail.createdAt).toLocaleString("es-ES")}</span>
                  {detail.country ? <span>· {detail.country}</span> : null}
                  {detail.spamScore > 0 ? <span>· spam {detail.spamScore}</span> : null}
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(detail.data).map(([k, v]) => (
                        <tr key={k} className="border-t first:border-t-0">
                          <td className="py-1.5 pr-3 align-top font-mono text-[11px] text-muted-foreground">
                            {k}
                          </td>
                          <td className="py-1.5 break-words">{String(v ?? "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail.spamReasons.length > 0 ? (
                  <div className="text-[11px] text-muted-foreground">
                    Razones spam: {detail.spamReasons.join(", ")}
                  </div>
                ) : null}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        await setSubmissionStatusAction({ id: detail.id, status: "processed" });
                        toast.success("Procesada");
                        setDetail(null);
                        location.reload();
                      })
                    }
                  >
                    Marcar procesada
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        await setSubmissionStatusAction({ id: detail.id, status: "archived" });
                        toast.success("Archivada");
                        setDetail(null);
                        location.reload();
                      })
                    }
                  >
                    Archivar
                  </Button>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
