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
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RotateCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  getCalendarTokenAction,
  rescheduleEntryAction,
  rotateCalendarTokenAction,
} from "../workflows/_actions";

type ItemSer = {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  priority: EntryPriority;
  collectionId: string;
  collectionName: string;
  collectionIcon: string | null;
  branchId: string | null;
  date: string;
  dateKind: "scheduled" | "due" | "published";
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  assigneeIds: string[];
  threadCount: number;
};

type Props = {
  view: "month" | "week";
  anchorDate: string;
  rangeFrom: string;
  rangeTo: string;
  items: ItemSer[];
  heatmap: Array<{ day: string; count: number }>;
  collections: Array<{ id: string; name: string; slug: string; icon: string | null }>;
  members: Array<{ id: string; name: string; image: string | null; workload: number }>;
  filters: {
    collectionIds: string[];
    authorIds: string[];
    assigneeIds: string[];
    statuses: EntryStatus[];
    priorities: EntryPriority[];
    includeDue: boolean;
  };
  role: string;
};

const STATUS_TONE: Record<EntryStatus, string> = {
  draft: "bg-muted-foreground/20 text-muted-foreground",
  review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  scheduled: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground line-through",
};

const PRIORITY_DOT: Record<EntryPriority, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-400",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

function ymd(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function buildDayCells(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  while (cur < to) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function shiftAnchor(anchor: Date, view: "month" | "week", dir: -1 | 1) {
  const r = new Date(anchor);
  if (view === "week") {
    r.setUTCDate(r.getUTCDate() + 7 * dir);
  } else {
    r.setUTCMonth(r.getUTCMonth() + dir);
  }
  return r;
}

export function CalendarClient(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const anchor = useMemo(() => new Date(props.anchorDate), [props.anchorDate]);
  const from = useMemo(() => new Date(props.rangeFrom), [props.rangeFrom]);
  const to = useMemo(() => new Date(props.rangeTo), [props.rangeTo]);
  const days = useMemo(() => buildDayCells(from, to), [from, to]);

  const heatmapMap = useMemo(
    () => new Map(props.heatmap.map((h) => [h.day, h.count])),
    [props.heatmap],
  );
  const heatmapMax = useMemo(
    () => Math.max(1, ...props.heatmap.map((h) => h.count)),
    [props.heatmap],
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ItemSer[]>();
    for (const it of props.items) {
      const d = ymd(new Date(it.date));
      const arr = map.get(d) ?? [];
      arr.push(it);
      map.set(d, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [props.items]);

  const updateParam = useCallback(
    (key: string, value: string | string[] | null) => {
      const params = new URLSearchParams(search.toString());
      if (value === null || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.delete(key);
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, search],
  );

  const navigateAnchor = useCallback(
    (dir: -1 | 1 | "today") => {
      const next = dir === "today" ? new Date() : shiftAnchor(anchor, props.view, dir);
      updateParam("date", ymd(next));
    },
    [anchor, props.view, updateParam],
  );

  const setView = useCallback((v: "month" | "week") => updateParam("view", v), [updateParam]);

  const toggleArr = useCallback(
    (key: string, current: string[], val: string) => {
      const next = current.includes(val) ? current.filter((c) => c !== val) : [...current, val];
      updateParam(key, next);
    },
    [updateParam],
  );

  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map());

  const onDrop = useCallback(
    (entryId: string, day: Date, currentItem: ItemSer) => {
      const next = new Date(day);
      next.setUTCHours(9, 0, 0, 0); // default 9:00 UTC al cambiar día
      const cur = new Date(currentItem.date);
      if (ymd(cur) === ymd(next)) return;
      // optimistic
      setOptimistic((prev) => {
        const m = new Map(prev);
        m.set(entryId, next.toISOString());
        return m;
      });
      startTransition(async () => {
        const res = await rescheduleEntryAction({
          entryId,
          scheduledAt: next.toISOString(),
        });
        if (!res.ok) {
          // rollback
          setOptimistic((prev) => {
            const m = new Map(prev);
            m.delete(entryId);
            return m;
          });
          alert(res.error);
        } else {
          router.refresh();
        }
      });
    },
    [router],
  );

  const headerLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
    if (props.view === "week") {
      const last = new Date(from);
      last.setUTCDate(last.getUTCDate() + 6);
      const fromFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(
        from,
      );
      const toFmt = new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(last);
      return `${fromFmt} – ${toFmt}`;
    }
    return fmt.format(anchor);
  }, [anchor, from, props.view]);

  const activeFilters =
    props.filters.collectionIds.length +
    props.filters.authorIds.length +
    props.filters.assigneeIds.length +
    props.filters.statuses.length +
    props.filters.priorities.length +
    (props.filters.includeDue ? 1 : 0);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [icalOpen, setIcalOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            Calendario editorial
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight capitalize">
            {headerLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => navigateAnchor(-1)}
              className="px-2.5 py-1.5 text-sm hover:bg-muted/50"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => navigateAnchor("today")}
              className="border-x px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => navigateAnchor(1)}
              className="px-2.5 py-1.5 text-sm hover:bg-muted/50"
              aria-label="Siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-1.5 text-sm",
                props.view === "week" ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={cn(
                "px-3 py-1.5 text-sm border-l",
                props.view === "month" ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
              )}
            >
              Mes
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((o) => !o)}>
            <Filter className="mr-1.5 size-4" />
            Filtros
            {activeFilters > 0 ? (
              <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {activeFilters}
              </Badge>
            ) : null}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIcalOpen(true)}>
            <Sparkles className="mr-1.5 size-4" />
            Suscribir iCal
          </Button>
          <Link href="/admin/contenido?new=1">
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Nueva entrada
            </Button>
          </Link>
        </div>
      </header>

      {filtersOpen ? (
        <FiltersBar
          props={props}
          updateParam={updateParam}
          toggleArr={toggleArr}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card/40 shadow-sm">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y">
          {days.map((day) => {
            const key = ymd(day);
            const items = (itemsByDay.get(key) ?? []).filter(
              (it) => !optimistic.has(it.id) || optimistic.get(it.id) === it.date,
            );
            // optimistic items dropped here
            const optimisticHere = props.items.filter((it) => {
              const next = optimistic.get(it.id);
              if (!next) return false;
              return ymd(new Date(next)) === key && ymd(new Date(it.date)) !== key;
            });
            const heatCount = heatmapMap.get(key) ?? 0;
            const heatIntensity = heatCount === 0 ? 0 : Math.min(1, heatCount / heatmapMax);
            const isToday = key === ymd(new Date());
            const inAnchorMonth =
              props.view === "week" || day.getUTCMonth() === anchor.getUTCMonth();

            return (
              <DayCell
                key={key}
                day={day}
                items={[...items, ...optimisticHere]}
                heatIntensity={heatIntensity}
                isToday={isToday}
                inAnchorMonth={inAnchorMonth}
                onDrop={onDrop}
                pending={pending}
                view={props.view}
              />
            );
          })}
        </div>
      </div>

      <Footer items={props.items} members={props.members} />

      {icalOpen ? <IcalModal onClose={() => setIcalOpen(false)} /> : null}
    </div>
  );
}

function DayCell({
  day,
  items,
  heatIntensity,
  isToday,
  inAnchorMonth,
  onDrop,
  pending,
  view,
}: {
  day: Date;
  items: ItemSer[];
  heatIntensity: number;
  isToday: boolean;
  inAnchorMonth: boolean;
  onDrop: (entryId: string, day: Date, item: ItemSer) => void;
  pending: boolean;
  view: "month" | "week";
}) {
  const [hover, setHover] = useState(false);
  const itemRef = useRef<Map<string, ItemSer>>(new Map());
  for (const it of items) itemRef.current.set(it.id, it);

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
        const entryId = e.dataTransfer.getData("text/csm-entry-id");
        if (!entryId) return;
        const item = itemRef.current.get(entryId) ?? items.find((i) => i.id === entryId);
        if (!item) return;
        onDrop(entryId, day, item);
      }}
      className={cn(
        "relative min-h-28 p-1.5 transition-colors",
        view === "month" ? "min-h-32" : "min-h-[420px]",
        !inAnchorMonth && "bg-muted/20 text-muted-foreground/70",
        hover && "ring-2 ring-primary/40 ring-inset",
        pending && "opacity-90",
      )}
    >
      {heatIntensity > 0 ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklch, var(--primary) ${heatIntensity * 18}%, transparent), transparent 70%)`,
          }}
        />
      ) : null}
      <div className="relative flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {day.getUTCDate()}
        </span>
      </div>
      <div className="relative mt-1 space-y-1">
        {items.map((it) => (
          <CalendarCard key={`${it.id}-${it.dateKind}`} item={it} />
        ))}
      </div>
    </div>
  );
}

function CalendarCard({ item }: { item: ItemSer }) {
  return (
    <Link
      href={`/admin/contenido/${item.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/csm-entry-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group block cursor-grab rounded-md border bg-card/80 px-2 py-1 text-xs shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:cursor-grabbing",
        item.dateKind === "due" && "border-dashed",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[item.priority])} />
        <span className="line-clamp-1 flex-1 font-medium leading-tight">{item.title}</span>
        <PresenceStack mode={{ kind: "entry", entryId: item.id }} size={14} max={2} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            "rounded px-1 py-0 text-[9px] uppercase tracking-wider",
            STATUS_TONE[item.status],
          )}
        >
          {STATUS_LABELS_ES[item.status].slice(0, 4)}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {item.threadCount > 0 ? <span>💬{item.threadCount}</span> : null}
          {item.assigneeIds.length > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Users className="size-2.5" />
              {item.assigneeIds.length}
            </span>
          ) : null}
        </div>
      </div>
      {item.dateKind === "due" ? (
        <div className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-2.5" /> SLA
        </div>
      ) : null}
    </Link>
  );
}

function FiltersBar({
  props,
  updateParam,
  toggleArr,
  onClose,
}: {
  props: Props;
  updateParam: (key: string, value: string | string[] | null) => void;
  toggleArr: (key: string, current: string[], val: string) => void;
  onClose: () => void;
}) {
  const statuses: EntryStatus[] = ["draft", "review", "approved", "scheduled", "published"];
  const priorities: EntryPriority[] = ["low", "normal", "high", "urgent"];
  return (
    <div className="rounded-2xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Filtros</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar filtros">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FilterGroup label="Colección">
          {props.collections.map((c) => (
            <FilterChip
              key={c.id}
              active={props.filters.collectionIds.includes(c.id)}
              onClick={() => toggleArr("collection", props.filters.collectionIds, c.id)}
            >
              {c.icon ? <span className="mr-1">{c.icon}</span> : null}
              {c.name}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Estado">
          {statuses.map((s) => (
            <FilterChip
              key={s}
              active={props.filters.statuses.includes(s)}
              onClick={() => toggleArr("status", props.filters.statuses, s)}
            >
              {STATUS_LABELS_ES[s]}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Prioridad">
          {priorities.map((p) => (
            <FilterChip
              key={p}
              active={props.filters.priorities.includes(p)}
              onClick={() => toggleArr("priority", props.filters.priorities, p)}
            >
              <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", PRIORITY_DOT[p])} />
              {PRIORITY_LABELS_ES[p]}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Asignado a">
          {props.members.map((m) => (
            <FilterChip
              key={m.id}
              active={props.filters.assigneeIds.includes(m.id)}
              onClick={() => toggleArr("assignee", props.filters.assigneeIds, m.id)}
            >
              {m.name}
              {m.workload > 0 ? (
                <span className="ml-1.5 text-[10px] text-muted-foreground">·{m.workload}</span>
              ) : null}
            </FilterChip>
          ))}
        </FilterGroup>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t pt-3 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={props.filters.includeDue}
            onChange={(e) => updateParam("includeDue", e.target.checked ? "1" : null)}
          />
          Mostrar deadlines (SLA)
        </label>
        <button
          type="button"
          onClick={() => {
            updateParam("collection", null);
            updateParam("status", null);
            updateParam("priority", null);
            updateParam("assignee", null);
            updateParam("includeDue", null);
          }}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Footer({
  items,
  members,
}: {
  items: ItemSer[];
  members: Array<{ id: string; name: string; image: string | null; workload: number }>;
}) {
  const breakdown = useMemo(() => {
    const total = items.length;
    const byStatus = new Map<EntryStatus, number>();
    for (const it of items) byStatus.set(it.status, (byStatus.get(it.status) ?? 0) + 1);
    return { total, byStatus };
  }, [items]);

  const topWorkload = [...members].sort((a, b) => b.workload - a.workload).slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card/40 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          En el rango
        </p>
        <p className="mt-2 font-display text-3xl font-semibold">{breakdown.total}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from(breakdown.byStatus.entries()).map(([s, n]) => (
            <span key={s} className={cn("rounded px-2 py-0.5 text-xs", STATUS_TONE[s])}>
              {STATUS_LABELS_ES[s]} · {n}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border bg-card/40 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Carga del equipo
        </p>
        <ul className="mt-2 space-y-1.5">
          {topWorkload.length === 0 ? (
            <li className="text-sm text-muted-foreground">Sin asignaciones activas</li>
          ) : (
            topWorkload.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{m.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{m.workload}</span>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="rounded-2xl border bg-card/40 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Atajos
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>Arrastra una entrada a otro día para reprogramarla</li>
          <li>Usa filtros para focalizar una colección o miembro</li>
          <li>Suscribe el feed iCal a Google/Apple Calendar</li>
        </ul>
      </div>
    </div>
  );
}

function IcalModal({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<string>("");
  const [rotated, setRotated] = useState(false);
  const handle = useCallback(async () => {
    setLoading(true);
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
    const res = await getCalendarTokenAction();
    if (res.ok) setToken(res.token);
    setLoading(false);
  }, []);
  // initial fetch (one shot)
  useMemo(() => {
    handle();
  }, [handle]);

  const url = token ? `${origin}/api/admin/calendar.ics?token=${token}` : "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold">Suscribir calendario iCal</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pega esta URL en Google Calendar, Apple Calendar o Outlook para sincronizar tus
              eventos editoriales.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <>
              <code className="block break-all rounded-md border bg-muted/40 p-3 text-xs">
                {url}
              </code>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof navigator !== "undefined") navigator.clipboard.writeText(url);
                  }}
                >
                  Copiar URL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await rotateCalendarTokenAction();
                    if (r.ok) {
                      setToken(r.token);
                      setRotated(true);
                    }
                  }}
                >
                  <RotateCw className="mr-1.5 size-3.5" />
                  Rotar token
                </Button>
              </div>
              {rotated ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Token rotado — reemplaza la URL en tu cliente.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
