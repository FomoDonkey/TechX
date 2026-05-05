"use client";

import { cn } from "@/lib/utils";
import { Bell, Check, MessageCircle, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  "entry.assigned": "Te asignaron una entrada",
  "entry.unassigned": "Te quitaron de una asignación",
  "entry.mention": "Te mencionaron",
  "entry.status_changed": "Cambio de estado",
  "entry.sla_breach": "SLA vencido",
  "entry.due_soon": "SLA próximo a vencer",
  "editorial.comment.added": "Nuevo comentario",
  "editorial.comment.resolved": "Hilo resuelto",
};

function iconFor(type: string) {
  if (type === "entry.assigned" || type === "entry.unassigned")
    return <UserCheck className="size-3.5" />;
  if (type === "editorial.comment.added" || type === "entry.mention")
    return <MessageCircle className="size-3.5" />;
  if (type === "entry.sla_breach") return <X className="size-3.5" />;
  return <Check className="size-3.5" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications?limit=30");
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        setUnread(data.unread);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // SSE: live updates.
  useEffect(() => {
    let cancelled = false;
    function connect() {
      if (cancelled) return;
      const es = new EventSource("/api/admin/notifications/stream");
      esRef.current = es;
      es.addEventListener("notification", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setItems((prev) => [data, ...prev].slice(0, 30));
          setUnread((u) => u + 1);
        } catch {
          /* malformed event */
        }
      });
      es.onerror = () => {
        es.close();
        if (!cancelled) setTimeout(connect, 5000);
      };
    }
    connect();
    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, []);

  const markAll = async () => {
    await fetch("/api/admin/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
  };

  const markOne = async (id: string) => {
    await fetch("/api/admin/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        aria-label="Notificaciones"
        className="relative inline-flex size-8 items-center justify-center rounded-md hover:bg-muted/50"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-96 max-w-[calc(100vw-1rem)] rounded-xl border bg-popover shadow-2xl">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-sm font-semibold">Notificaciones</h3>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-[11px] text-primary hover:underline"
                >
                  Marcar todo leído
                </button>
              ) : null}
            </header>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">Cargando…</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Todo en orden ✦</p>
              ) : (
                <ul>
                  {items.map((n) => (
                    <NotifRow key={n.id} item={n} onRead={() => markOne(n.id)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotifRow({ item, onRead }: { item: NotificationItem; onRead: () => void }) {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const entryId = typeof payload.entryId === "string" ? payload.entryId : null;
  const title =
    (typeof payload.entryTitle === "string" && payload.entryTitle) ||
    TYPE_LABEL[item.type] ||
    item.type;
  const subtitle = subtitleFor(item.type, payload);
  const href = entryId ? `/admin/contenido/${entryId}` : "#";
  const date = new Date(item.createdAt);
  const ago = formatAgo(date);

  return (
    <li className={cn("border-b last:border-b-0", !item.readAt && "bg-primary/5")}>
      <Link
        href={href}
        onClick={onRead}
        className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40"
      >
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          {iconFor(item.type)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium">{title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{ago}</p>
        </div>
        {!item.readAt ? (
          <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
        ) : null}
      </Link>
    </li>
  );
}

function subtitleFor(type: string, payload: Record<string, unknown>): string {
  const actorName = typeof payload.actorName === "string" ? payload.actorName : "Alguien";
  const role = typeof payload.role === "string" ? payload.role : "";
  if (type === "entry.assigned") return `${actorName} te asignó como ${role || "colaborador"}`;
  if (type === "entry.unassigned") return `${actorName} te quitó la asignación`;
  if (type === "entry.mention")
    return typeof payload.messagePreview === "string"
      ? payload.messagePreview
      : `${actorName} te mencionó`;
  if (type === "entry.status_changed") {
    const from = typeof payload.fromStatus === "string" ? payload.fromStatus : "";
    const to = typeof payload.toStatus === "string" ? payload.toStatus : "";
    return `${actorName}: ${from} → ${to}`;
  }
  if (type === "entry.sla_breach") return `Deadline vencido (${role})`;
  if (type === "editorial.comment.added")
    return typeof payload.messagePreview === "string"
      ? payload.messagePreview
      : `${actorName} comentó`;
  return "";
}

function formatAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date);
}
