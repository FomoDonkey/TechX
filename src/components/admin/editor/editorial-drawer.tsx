"use client";

import {
  assignEntryAction,
  completeAssignmentAction,
  createThreadAction,
  removeAssignmentAction,
  reopenThreadAction,
  replyThreadAction,
  resolveThreadAction,
  transitionEntryAction,
  updateEntryMetaAction,
} from "@/app/admin/workflows/_actions";
import { type InitialReaction, ThreadReactions } from "@/components/admin/editor/thread-reactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type EntryPriority,
  type EntryStatus,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
} from "@/editorial/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  GitMerge,
  History,
  MessageCircle,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useState, useTransition } from "react";

export type EditorialDrawerInitial = {
  entryId: string;
  status: EntryStatus;
  priority: EntryPriority;
  scheduledAt: string | null;
  dueAt: string | null;
  assignees: Array<{
    assignmentId: string;
    role: "writer" | "reviewer" | "approver";
    user: { id: string; name: string; image: string | null };
    effectiveDueAt: string | null;
    slaState: "ok" | "warning" | "breach";
  }>;
  threads: Array<{
    id: string;
    blockId: string | null;
    status: "open" | "resolved";
    creator: { id: string; name: string; image: string | null } | null;
    createdAt: string;
    messages: Array<{
      id: string;
      authorId: string | null;
      author: { id: string; name: string; image: string | null } | null;
      body: string;
      mentions: string[] | null;
      createdAt: string;
    }>;
  }>;
  events: Array<{
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    actor: { id: string; name: string; image: string | null } | null;
    payload: Record<string, unknown> | null;
    createdAt: string;
  }>;
  members: Array<{ id: string; name: string; image: string | null }>;
  myUserId: string;
  /**
   * F10b — reactions iniciales agrupadas por messageId. El componente
   * `ThreadReactions` mantiene state local con merges desde el SSE de presence.
   */
  reactionsByMessage?: Record<string, InitialReaction[]>;
};

const PRIORITY_DOT: Record<EntryPriority, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-400",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const FORWARD: Record<EntryStatus, EntryStatus[]> = {
  draft: ["review", "scheduled", "published", "archived"],
  review: ["approved", "draft", "archived"],
  approved: ["scheduled", "published", "draft", "archived"],
  scheduled: ["published", "draft", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
};

const ROLE_LABEL: Record<string, string> = {
  writer: "Redactor",
  reviewer: "Revisor",
  approver: "Aprobador",
};

const SLA_TONE: Record<"ok" | "warning" | "breach", string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  breach: "text-red-600 dark:text-red-400",
};

export function EditorialDrawer({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: EditorialDrawerInitial;
}) {
  const [tab, setTab] = useState<"workflow" | "comments" | "timeline">("workflow");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-background/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="font-display text-base font-semibold">Editorial</h3>
            <p className="text-xs text-muted-foreground">Workflow · Asignaciones · Comentarios</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </header>
        <nav className="grid grid-cols-3 border-b text-sm">
          <TabBtn active={tab === "workflow"} onClick={() => setTab("workflow")}>
            <Flag className="mr-1.5 size-3.5" /> Flujo
          </TabBtn>
          <TabBtn active={tab === "comments"} onClick={() => setTab("comments")}>
            <MessageCircle className="mr-1.5 size-3.5" />
            Comentarios
            {initial.threads.filter((t) => t.status === "open").length > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px]">
                {initial.threads.filter((t) => t.status === "open").length}
              </span>
            ) : null}
          </TabBtn>
          <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")}>
            <History className="mr-1.5 size-3.5" /> Historial
          </TabBtn>
        </nav>
        {error ? (
          <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto">
          {tab === "workflow" ? (
            <WorkflowTab initial={initial} setError={setError} />
          ) : tab === "comments" ? (
            <CommentsTab initial={initial} setError={setError} />
          ) : (
            <TimelineTab events={initial.events} />
          )}
        </div>
      </aside>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center px-3 py-2 text-xs font-medium",
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function WorkflowTab({
  initial,
  setError,
}: {
  initial: EditorialDrawerInitial;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState<string>(
    initial.scheduledAt ? initial.scheduledAt.slice(0, 16) : "",
  );
  const [dueAt, setDueAt] = useState<string>(initial.dueAt ? initial.dueAt.slice(0, 16) : "");
  const [priority, setPriority] = useState<EntryPriority>(initial.priority);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ date: string; rationale: string }>>([]);

  const next = FORWARD[initial.status];

  const transition = (to: EntryStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await transitionEntryAction({
        entryId: initial.entryId,
        to,
        scheduledAt:
          to === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      if (!res.ok) setError(res.error);
      else if (typeof window !== "undefined") window.location.reload();
    });
  };

  const saveMeta = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateEntryMetaAction({
        entryId: initial.entryId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        priority,
      });
      if (!res.ok) setError(res.error);
    });
  };

  const fetchSuggest = async () => {
    setShowSuggest(true);
    try {
      const res = await fetch("/api/admin/ai/suggest-slot?count=3");
      const json = await res.json();
      if (json.ok) setSuggestions(json.slots);
    } catch {
      setError("No se pudo cargar sugerencias IA");
    }
  };

  return (
    <div className="space-y-5 p-4">
      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Estado actual
        </h4>
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">{STATUS_LABELS_ES[initial.status]}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {next.map((to) => (
              <Button
                key={to}
                size="sm"
                variant="outline"
                onClick={() => transition(to)}
                disabled={pending}
              >
                <ArrowRight className="mr-1 size-3.5" />
                {STATUS_LABELS_ES[to]}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Asignaciones
        </h4>
        <AssignList initial={initial} setError={setError} />
      </section>

      <section>
        <h4 className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Programación
          <button
            type="button"
            onClick={fetchSuggest}
            className="inline-flex items-center gap-1 normal-case tracking-normal text-primary hover:underline"
          >
            <Sparkles className="size-3" /> Sugerir IA
          </button>
        </h4>
        <div className="space-y-2">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            placeholder="Deadline (SLA)"
          />
          {showSuggest && suggestions.length > 0 ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Sugerencias IA
              </p>
              <ul className="space-y-1">
                {suggestions.map((s) => (
                  <li key={s.date}>
                    <button
                      type="button"
                      onClick={() => setScheduledAt(s.date.slice(0, 16))}
                      className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-card"
                    >
                      <span className="font-medium">
                        {new Intl.DateTimeFormat("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(s.date))}
                      </span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{s.rationale}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Prioridad</span>
            <div className="flex gap-1">
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                    priority === p
                      ? "border-primary/60 bg-primary/10"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[p])} />
                  {PRIORITY_LABELS_ES[p]}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={saveMeta} disabled={pending}>
            Guardar
          </Button>
        </div>
      </section>
    </div>
  );
}

function AssignList({
  initial,
  setError,
}: {
  initial: EditorialDrawerInitial;
  setError: (e: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [openRole, setOpenRole] = useState<"writer" | "reviewer" | "approver" | null>(null);

  const roles = ["writer", "reviewer", "approver"] as const;

  return (
    <div className="space-y-2">
      {roles.map((role) => {
        const active = initial.assignees.find((a) => a.role === role);
        return (
          <div key={role} className="rounded-lg border bg-background p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {ROLE_LABEL[role]}
              </span>
              <div className="ml-auto">
                {active ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const res = await removeAssignmentAction({
                          assignmentId: active.assignmentId,
                        });
                        if (!res.ok) setError(res.error);
                        else if (typeof window !== "undefined") window.location.reload();
                      });
                    }}
                    disabled={pending}
                    className="text-[10px] text-muted-foreground hover:text-red-500"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>
            {active ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-muted text-[11px] font-medium">
                  {active.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={active.user.image}
                      alt={active.user.name}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    active.user.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="flex-1 text-sm">
                  <p>{active.user.name}</p>
                  {active.effectiveDueAt ? (
                    <p
                      className={cn(
                        "flex items-center gap-1 text-[11px]",
                        SLA_TONE[active.slaState],
                      )}
                    >
                      {active.slaState === "breach" ? (
                        <AlertCircle className="size-3" />
                      ) : (
                        <Clock className="size-3" />
                      )}
                      {new Intl.DateTimeFormat("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(active.effectiveDueAt))}
                    </p>
                  ) : null}
                </div>
                {active.user.id === initial.myUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const res = await completeAssignmentAction({
                          assignmentId: active.assignmentId,
                          completionKind: "completed",
                        });
                        if (!res.ok) setError(res.error);
                        else if (typeof window !== "undefined") window.location.reload();
                      });
                    }}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    <CheckCircle2 className="mr-0.5 inline size-3" />
                    Completar
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenRole(openRole === role ? null : role)}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <UserPlus className="size-3.5" />
                {openRole === role
                  ? "Cerrar"
                  : `Asignar ${(ROLE_LABEL[role] ?? role).toLowerCase()}`}
              </button>
            )}
            {openRole === role ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-card">
                {initial.members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const res = await assignEntryAction({
                          entryId: initial.entryId,
                          assigneeId: m.id,
                          role,
                        });
                        if (!res.ok) setError(res.error);
                        else if (typeof window !== "undefined") window.location.reload();
                      });
                    }}
                    disabled={pending}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                  >
                    <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px]">
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    {m.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CommentsTab({
  initial,
  setError,
}: {
  initial: EditorialDrawerInitial;
  setError: (e: string | null) => void;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [showMentions, setShowMentions] = useState(false);

  const create = () => {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createThreadAction({
        entryId: initial.entryId,
        blockId: null,
        body,
      });
      if (!res.ok) setError(res.error);
      else {
        setBody("");
        if (typeof window !== "undefined") window.location.reload();
      }
    });
  };

  const open = initial.threads.filter((t) => t.status === "open");
  const resolved = initial.threads.filter((t) => t.status === "resolved");

  const insertMention = (m: { id: string; name: string }) => {
    setBody((b) => `${b}@[${m.name}](${m.id}) `);
    setShowMentions(false);
  };

  return (
    <div className="space-y-4 p-4">
      <section>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Comentario… usa @ para mencionar a alguien"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="sm" onClick={create} disabled={pending || !body.trim()}>
            Publicar
          </Button>
          <button
            type="button"
            onClick={() => setShowMentions((s) => !s)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Users className="mr-0.5 inline size-3" />
            Mencionar
          </button>
        </div>
        {showMentions ? (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-card">
            {initial.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/60"
              >
                <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px]">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                {m.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Abiertos · {open.length}
        </h4>
        <div className="space-y-2">
          {open.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay hilos abiertos.</p>
          ) : (
            open.map((t) => (
              <Thread
                key={t.id}
                thread={t}
                setError={setError}
                myUserId={initial.myUserId}
                reactionsByMessage={initial.reactionsByMessage ?? {}}
              />
            ))
          )}
        </div>
      </section>

      {resolved.length > 0 ? (
        <section>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Resueltos · {resolved.length}
          </h4>
          <div className="space-y-2 opacity-70">
            {resolved.map((t) => (
              <Thread
                key={t.id}
                thread={t}
                setError={setError}
                myUserId={initial.myUserId}
                reactionsByMessage={initial.reactionsByMessage ?? {}}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Thread({
  thread,
  setError,
  myUserId,
  reactionsByMessage,
}: {
  thread: EditorialDrawerInitial["threads"][number];
  setError: (e: string | null) => void;
  myUserId: string;
  reactionsByMessage: Record<string, InitialReaction[]>;
}) {
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (!reply.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await replyThreadAction({ threadId: thread.id, body: reply });
      if (!res.ok) setError(res.error);
      else {
        setReply("");
        if (typeof window !== "undefined") window.location.reload();
      }
    });
  };

  const toggleStatus = () => {
    setError(null);
    startTransition(async () => {
      const res =
        thread.status === "open"
          ? await resolveThreadAction({ threadId: thread.id })
          : await reopenThreadAction({ threadId: thread.id });
      if (!res.ok) setError(res.error);
      else if (typeof window !== "undefined") window.location.reload();
    });
  };

  return (
    <article className="rounded-lg border bg-background p-3">
      {thread.blockId ? (
        <p className="mb-2 inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <GitMerge className="size-3" /> bloque {thread.blockId.slice(0, 8)}
        </p>
      ) : null}
      <ul className="space-y-2">
        {thread.messages.map((m) => (
          <li key={m.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-medium">
                {m.author?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.author.image}
                    alt={m.author.name}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  (m.author?.name ?? "?").slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="text-xs font-medium">{m.author?.name ?? "Usuario"}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Intl.DateTimeFormat("es-ES", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(m.createdAt))}
              </span>
            </div>
            <p className="ml-7 whitespace-pre-wrap text-sm leading-snug">
              {renderMentions(m.body)}
            </p>
            <div className="ml-7">
              <ThreadReactions
                threadId={thread.id}
                messageId={m.id}
                myUserId={myUserId}
                initial={reactionsByMessage[m.id] ?? []}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-end gap-1.5">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={1}
          placeholder="Responder…"
          className="min-h-9"
        />
        <Button size="sm" variant="outline" onClick={send} disabled={pending || !reply.trim()}>
          Enviar
        </Button>
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={toggleStatus}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          {thread.status === "open" ? "Resolver" : "Reabrir"}
        </button>
      </div>
    </article>
  );
}

function renderMentions(text: string) {
  const parts: Array<string | { name: string }> = [];
  const re = /@\[([^\]]{1,64})\]\(([0-9a-f-]{8,64})\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ name: m[1] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: stable text segments
      <span key={i}>{p}</span>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: stable text segments
      <span key={i} className="rounded bg-primary/15 px-1 text-primary">
        @{p.name}
      </span>
    ),
  );
}

function TimelineTab({
  events,
}: {
  events: EditorialDrawerInitial["events"];
}) {
  if (events.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Sin eventos todavía.</p>;
  }
  return (
    <ol className="space-y-3 p-4">
      {events.map((ev) => (
        <li key={ev.id} className="flex gap-3 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium">
            {ev.actor?.name?.slice(0, 1).toUpperCase() ?? "·"}
          </span>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="text-sm">
              <span className="font-medium">{ev.actor?.name ?? "Sistema"}</span>{" "}
              <span className="text-muted-foreground">{eventLabel(ev)}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {new Intl.DateTimeFormat("es-ES", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(ev.createdAt))}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function eventLabel(ev: EditorialDrawerInitial["events"][number]): string {
  const _ = ev;
  switch (ev.type) {
    case "status.changed":
      return `cambió ${ev.fromStatus ?? "?"} → ${ev.toStatus}`;
    case "assignment.added":
      return "añadió una asignación";
    case "assignment.removed":
      return "quitó una asignación";
    case "assignment.completed":
      return "completó su asignación";
    case "comment.added":
      return "comentó";
    case "comment.resolved":
      return "resolvió un hilo";
    case "sla.breach":
      return "incumplió el SLA";
    default:
      return ev.type;
  }
}
