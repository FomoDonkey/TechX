"use client";

import { PresenceStack } from "@/components/admin/presence-stack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type EntryPriority,
  type EntryStatus,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
} from "@/editorial/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCheck, Clock, GripVertical, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { assignEntryAction, transitionEntryAction } from "./_actions";
import type { WorkflowCard } from "./page";

type Props = {
  cards: WorkflowCard[];
  columns: EntryStatus[];
  counts: Partial<Record<EntryStatus, number>>;
  members: Array<{ id: string; name: string; image: string | null }>;
  role: string;
};

const COLUMN_TONE: Record<EntryStatus, string> = {
  draft: "border-muted-foreground/30 from-muted/40",
  review: "border-amber-500/40 from-amber-500/10",
  approved: "border-blue-500/40 from-blue-500/10",
  scheduled: "border-violet-500/40 from-violet-500/10",
  published: "border-emerald-500/40 from-emerald-500/10",
  archived: "border-muted from-muted/20",
};

const PRIORITY_DOT: Record<EntryPriority, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-400",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const SLA_TONE: Record<"ok" | "warning" | "breach", string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  breach: "text-red-600 dark:text-red-400",
};

export function WorkflowKanban(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const cardsByStatus = new Map<EntryStatus, WorkflowCard[]>();
  for (const c of props.cards) {
    const arr = cardsByStatus.get(c.status) ?? [];
    arr.push(c);
    cardsByStatus.set(c.status, arr);
  }

  const onDropToColumn = useCallback(
    (entryId: string, target: EntryStatus) => {
      const card = props.cards.find((c) => c.id === entryId);
      if (!card) return;
      if (card.status === target) return;
      setError(null);
      startTransition(async () => {
        const res = await transitionEntryAction({
          entryId,
          to: target,
          // si target=scheduled, dejar el server validar (pedirá scheduledAt si no existe)
          scheduledAt: card.scheduledAt ?? undefined,
        });
        if (!res.ok) {
          setError(res.error);
        } else {
          router.refresh();
        }
      });
    },
    [props.cards, router],
  );

  const onBulkTransition = useCallback(
    (target: EntryStatus) => {
      if (selected.size === 0) return;
      setError(null);
      startTransition(async () => {
        for (const id of selected) {
          const card = props.cards.find((c) => c.id === id);
          if (!card) continue;
          if (card.status === target) continue;
          const res = await transitionEntryAction({
            entryId: id,
            to: target,
            scheduledAt: card.scheduledAt ?? undefined,
          });
          if (!res.ok) {
            setError(`${card.title}: ${res.error}`);
            return;
          }
        }
        setSelected(new Set());
        router.refresh();
      });
    },
    [selected, props.cards, router],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Workflow className="size-3.5" />
            Flujos editoriales
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Workflows</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Mueve entradas entre estados arrastrándolas. Asigna revisores y aprobadores. Las
            transiciones validan reglas (revisor requerido, aprobación bloqueada, fecha futura).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs">
              <span className="font-medium">{selected.size} seleccionadas</span>
              <Button size="sm" variant="outline" onClick={() => onBulkTransition("review")}>
                → Revisión
              </Button>
              <Button size="sm" variant="outline" onClick={() => onBulkTransition("archived")}>
                Archivar
              </Button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          ) : null}
          <Link href="/admin/contenido">
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 size-4" />
              Nueva entrada
            </Button>
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-5">
        {props.columns.map((col) => (
          <Column
            key={col}
            status={col}
            count={props.counts[col] ?? 0}
            cards={cardsByStatus.get(col) ?? []}
            onDrop={onDropToColumn}
            pending={pending}
            selected={selected}
            onToggleSelect={toggleSelect}
            members={props.members}
            onAssign={(entryId, assigneeId, role) => {
              startTransition(async () => {
                const res = await assignEntryAction({ entryId, assigneeId, role });
                if (!res.ok) setError(res.error);
                else router.refresh();
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  status,
  count,
  cards,
  onDrop,
  pending,
  selected,
  onToggleSelect,
  members,
  onAssign,
}: {
  status: EntryStatus;
  count: number;
  cards: WorkflowCard[];
  onDrop: (entryId: string, target: EntryStatus) => void;
  pending: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  members: Array<{ id: string; name: string; image: string | null }>;
  onAssign: (entryId: string, assigneeId: string, role: "writer" | "reviewer" | "approver") => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const id = e.dataTransfer.getData("text/csm-entry-id");
        if (!id) return;
        onDrop(id, status);
      }}
      className={cn(
        "flex flex-col rounded-2xl border-t-2 bg-gradient-to-b to-transparent p-3 transition-all",
        COLUMN_TONE[status],
        hover && "ring-2 ring-primary/40",
        pending && "opacity-90",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{STATUS_LABELS_ES[status]}</h2>
        <Badge variant="outline" className="rounded-full bg-card text-[10px]">
          {count}
        </Badge>
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/30 p-4 text-center text-xs text-muted-foreground">
            Vacío
          </div>
        ) : (
          cards.map((c) => (
            <KanbanCard
              key={c.id}
              card={c}
              selected={selected.has(c.id)}
              onSelect={() => onToggleSelect(c.id)}
              members={members}
              onAssign={onAssign}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  selected,
  onSelect,
  members,
  onAssign,
}: {
  card: WorkflowCard;
  selected: boolean;
  onSelect: () => void;
  members: Array<{ id: string; name: string; image: string | null }>;
  onAssign: (entryId: string, assigneeId: string, role: "writer" | "reviewer" | "approver") => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const worstSla = card.assignees.reduce<"ok" | "warning" | "breach">((acc, a) => {
    if (a.slaState === "breach") return "breach";
    if (a.slaState === "warning" && acc !== "breach") return "warning";
    return acc;
  }, "ok");

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/csm-entry-id", card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group relative cursor-grab rounded-xl border bg-card/95 p-2.5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:cursor-grabbing",
        selected && "ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          aria-label={selected ? "Deseleccionar" : "Seleccionar"}
          onClick={onSelect}
          className="mt-0.5"
        >
          <span
            className={cn(
              "block size-3.5 rounded-sm border transition-colors",
              selected ? "border-primary bg-primary" : "border-border hover:border-foreground",
            )}
          />
        </button>
        <span
          className={cn("mt-1 size-1.5 shrink-0 rounded-full", PRIORITY_DOT[card.priority])}
          title={PRIORITY_LABELS_ES[card.priority]}
        />
        <Link href={`/admin/contenido/${card.id}`} className="flex-1 min-w-0">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{card.title}</h3>
        </Link>
        <PresenceStack mode={{ kind: "entry", entryId: card.id }} size={18} max={2} />
        <GripVertical className="size-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-5 text-[11px] text-muted-foreground">
        {card.collection.icon ? <span>{card.collection.icon}</span> : null}
        <span className="truncate">{card.collection.name}</span>
        {card.scheduledAt ? (
          <span className="ml-auto inline-flex items-center gap-0.5">
            <Clock className="size-3" />
            {new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(
              new Date(card.scheduledAt),
            )}
          </span>
        ) : null}
      </div>
      {card.assignees.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 pl-5">
          {card.assignees.slice(0, 4).map((a) => (
            <span
              key={a.assignmentId}
              title={`${a.user.name} · ${a.role}`}
              className="grid size-5 place-items-center rounded-full border bg-muted text-[10px] font-medium"
            >
              {a.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.user.image}
                  alt={a.user.name}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                a.user.name.slice(0, 1).toUpperCase()
              )}
            </span>
          ))}
          {worstSla !== "ok" ? (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 text-[10px]",
                SLA_TONE[worstSla],
              )}
            >
              {worstSla === "breach" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              {worstSla === "breach" ? "SLA superado" : "SLA pronto"}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAssignOpen((o) => !o)}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
            >
              Asignar
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center pl-5">
          <button
            type="button"
            onClick={() => setAssignOpen((o) => !o)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="mr-1 inline size-3" />
            Asignar revisor
          </button>
        </div>
      )}
      {assignOpen ? (
        <AssignPopover
          card={card}
          members={members}
          onClose={() => setAssignOpen(false)}
          onAssign={onAssign}
        />
      ) : null}
    </article>
  );
}

function AssignPopover({
  card,
  members,
  onAssign,
  onClose,
}: {
  card: WorkflowCard;
  members: Array<{ id: string; name: string; image: string | null }>;
  onAssign: (entryId: string, assigneeId: string, role: "writer" | "reviewer" | "approver") => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<"writer" | "reviewer" | "approver">("reviewer");
  return (
    <div className="absolute inset-x-2 top-full z-20 mt-1 rounded-xl border bg-popover p-2 shadow-xl">
      <div className="flex gap-1 border-b pb-1.5 text-[10px] uppercase tracking-wider">
        {(["writer", "reviewer", "approver"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn(
              "flex-1 rounded px-2 py-1",
              role === r
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {r === "writer" ? "Redactor" : r === "reviewer" ? "Revisor" : "Aprobador"}
          </button>
        ))}
      </div>
      <ul className="mt-1 max-h-44 overflow-y-auto">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => {
                onAssign(card.id, m.id, role);
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60"
            >
              <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px]">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              {m.name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full text-[10px] text-muted-foreground hover:text-foreground"
      >
        Cerrar
      </button>
    </div>
  );
}
