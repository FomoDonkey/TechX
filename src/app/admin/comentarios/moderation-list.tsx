"use client";

import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Loader2, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveCommentsAction,
  deleteCommentsAction,
  spamCommentsAction,
  unapproveCommentsAction,
} from "./_actions";

type Item = {
  id: string;
  entryId: string;
  authorName: string;
  authorEmail: string | null;
  body: string;
  status: "pending" | "approved" | "spam";
  aiScore: number | null;
  aiReason: string | null;
  createdAt: Date;
};

type Props = {
  items: Item[];
  entryMap: Record<string, { title: string; slug: string }>;
  status: "pending" | "approved" | "spam";
};

export function ModerationList({ items, entryMap, status }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === items.length ? new Set() : new Set(items.map((it) => it.id))));
  }

  function bulk(action: "approve" | "spam" | "unapprove" | "delete") {
    if (selected.size === 0) return;
    if (
      action === "delete" &&
      !confirm(`¿Eliminar ${selected.size} comentarios? Esto no se puede deshacer.`)
    )
      return;
    const ids = [...selected];
    startTransition(async () => {
      const r =
        action === "approve"
          ? await approveCommentsAction({ ids })
          : action === "spam"
            ? await spamCommentsAction({ ids })
            : action === "unapprove"
              ? await unapproveCommentsAction({ ids })
              : await deleteCommentsAction({ ids });
      if (r.ok) {
        toast.success(
          `${action === "approve" ? "Aprobados" : action === "spam" ? "Marcados como spam" : action === "unapprove" ? "Devueltos a pendientes" : "Eliminados"}: ${r.count}`,
        );
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center text-sm text-muted-foreground">
        Nada por aquí.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/30 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={selected.size > 0 && selected.size === items.length}
          onChange={toggleAll}
        />
        <span className="text-muted-foreground">
          {selected.size > 0 ? `${selected.size} seleccionados` : `${items.length} comentarios`}
        </span>
        {selected.size > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {status !== "approved" ? (
              <Button
                size="sm"
                variant="gradient"
                onClick={() => bulk("approve")}
                disabled={pending}
              >
                <Check className="size-3.5" /> Aprobar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulk("unapprove")}
                disabled={pending}
              >
                <Undo2 className="size-3.5" /> A pendiente
              </Button>
            )}
            {status !== "spam" ? (
              <Button size="sm" variant="outline" onClick={() => bulk("spam")} disabled={pending}>
                <ShieldAlert className="size-3.5" /> Spam
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => bulk("delete")}
              disabled={pending}
            >
              <Trash2 className="size-3.5" /> Eliminar
            </Button>
            {pending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
          </div>
        ) : null}
      </div>

      <ul className="space-y-3">
        {items.map((c) => {
          const entry = entryMap[c.entryId];
          const score = c.aiScore ?? 0;
          const tone = score >= 75 ? "destructive" : score >= 35 ? "warning" : "success";
          return (
            <li key={c.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1.5"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong className="text-sm">{c.authorName}</strong>
                    <span className="text-xs text-muted-foreground">{c.authorEmail}</span>
                    <span className="text-xs text-muted-foreground">
                      · {new Date(c.createdAt).toLocaleString("es-ES")}
                    </span>
                    {entry ? (
                      <a
                        href={`/blog/${entry.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        en {entry.title} <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        tone === "destructive"
                          ? "bg-destructive/15 text-destructive"
                          : tone === "warning"
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success"
                      }`}
                    >
                      Score IA {score}
                    </span>
                    {c.aiReason ? (
                      <span className="text-muted-foreground">{c.aiReason}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
