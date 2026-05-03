"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Subscriber } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  Upload,
  UserMinus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createSubscriberAction,
  deleteSubscribersAction,
  importSubscribersAction,
  tagSubscribersAction,
  unsubscribeBulkAction,
} from "./_actions";

type Props = {
  rows: Subscriber[];
  total: number;
  page: number;
  pageSize: number;
  currentStatus?: "active" | "unsubscribed" | "bounced";
  currentQuery: string;
  currentTag: string;
};

export function SubscribersClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(props.currentQuery);

  function toggleAll() {
    if (selected.size === props.rows.length) setSelected(new Set());
    else setSelected(new Set(props.rows.map((r) => r.id)));
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function filterUrl(patch: Partial<{ status: string; q: string; tag: string; page: number }>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    if (patch.q !== undefined || patch.status !== undefined || patch.tag !== undefined) {
      params.delete("page");
    }
    return `/admin/suscriptores?${params.toString()}`;
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(filterUrl({ q: search }));
  }

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={applySearch} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email o nombre…"
            className="w-64 pl-10"
          />
        </form>
        <FilterPill label="Todos" active={!props.currentStatus} href={filterUrl({ status: "" })} />
        <FilterPill
          label="Activos"
          active={props.currentStatus === "active"}
          href={filterUrl({ status: "active" })}
        />
        <FilterPill
          label="Bajas"
          active={props.currentStatus === "unsubscribed"}
          href={filterUrl({ status: "unsubscribed" })}
        />
        <FilterPill
          label="Bounced"
          active={props.currentStatus === "bounced"}
          href={filterUrl({ status: "bounced" })}
        />

        <span className="ml-auto" />

        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="mr-1.5 size-4" />
          Importar CSV
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/api/subscribers/export" download="suscriptores.csv">
            <Download className="mr-1.5 size-4" />
            Exportar
          </a>
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 size-4" />
          Añadir
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--th-brand,#9b5cff)]/40 bg-[color:var(--th-brand,#9b5cff)]/10 p-3 text-sm">
          <span className="font-medium">{selected.size}</span>
          <span className="text-muted-foreground">seleccionados</span>
          <span className="ml-auto" />
          <Button size="sm" variant="ghost" onClick={() => setShowTag(true)}>
            <TagIcon className="mr-1.5 size-4" />
            Etiquetar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!confirm(`¿Dar de baja a ${selected.size} suscriptores?`)) return;
              start(async () => {
                await unsubscribeBulkAction({ ids: [...selected] });
                setSelected(new Set());
                router.refresh();
              });
            }}
          >
            <UserMinus className="mr-1.5 size-4" />
            Dar de baja
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-500"
            onClick={() => {
              if (!confirm(`Eliminar ${selected.size} suscriptores DEFINITIVAMENTE?`)) return;
              start(async () => {
                await deleteSubscribersAction({ ids: [...selected] });
                setSelected(new Set());
                router.refresh();
              });
            }}
          >
            <Trash2 className="mr-1.5 size-4" />
            Borrar
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card/30">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === props.rows.length}
                  onChange={toggleAll}
                  className="size-4"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Email</th>
              <th className="px-3 py-2.5 text-left font-medium">Nombre</th>
              <th className="px-3 py-2.5 text-left font-medium">Estado</th>
              <th className="px-3 py-2.5 text-left font-medium">Tags</th>
              <th className="px-3 py-2.5 text-left font-medium">Origen</th>
              <th className="px-3 py-2.5 text-left font-medium">Alta</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                  Sin suscriptores. Pulsa <strong>Añadir</strong> o importa un CSV.
                </td>
              </tr>
            ) : (
              props.rows.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="size-4"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{s.email}</span>
                      {s.confirmedAt ? null : (
                        <Badge variant="outline" className="text-[10px]">
                          Sin confirmar
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(s.tags ?? []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                      {(s.tags ?? []).length > 3 ? (
                        <span className="text-[11px] text-muted-foreground">
                          +{(s.tags ?? []).length - 3}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {s.createdAt instanceof Date
                      ? s.createdAt.toISOString().slice(0, 10)
                      : (s.createdAt ?? "")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {props.total} suscriptor{props.total === 1 ? "" : "es"} en total
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page <= 1}
            onClick={() => router.push(filterUrl({ page: props.page - 1 }))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            {props.page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={props.page >= totalPages}
            onClick={() => router.push(filterUrl({ page: props.page + 1 }))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {showCreate ? <CreateModal onClose={() => setShowCreate(false)} /> : null}
      {showImport ? <ImportModal onClose={() => setShowImport(false)} /> : null}
      {showTag ? (
        <TagModal
          ids={[...selected]}
          onClose={() => setShowTag(false)}
          onApplied={() => {
            setShowTag(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      {pending ? (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs text-background shadow-lg">
          <Loader2 className="size-3.5 animate-spin" />
          Procesando…
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
      )}
    >
      {label}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
        Activo
      </Badge>
    );
  if (status === "unsubscribed")
    return (
      <Badge variant="outline" className="opacity-70">
        Baja
      </Badge>
    );
  if (status === "bounced")
    return (
      <Badge variant="outline" className="border-rose-500/40 text-rose-600">
        Bounced
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const result = await createSubscriberAction({
        email,
        name: name || undefined,
        tags: tags
          ? tags
              .split(/[,;]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        preConfirmed: true,
      });
      if (!result.ok) {
        setErr(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal title="Añadir suscriptor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="newsub-email">
            Email *
          </label>
          <Input
            id="newsub-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="newsub-name">
            Nombre
          </label>
          <Input id="newsub-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="newsub-tags">
            Etiquetas (separadas por coma)
          </label>
          <Input
            id="newsub-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vip, español"
          />
        </div>
        {err ? <p className="text-xs text-rose-500">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Añadir
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [csv, setCsv] = useState("");
  const [preConfirmed, setPreConfirmed] = useState(true);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    total: number;
    created: number;
    reactivated: number;
    skipped: number;
  } | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (csv.trim().length < 5) return;
    start(async () => {
      const r = await importSubscribersAction({
        csv,
        source: "csv_import",
        preConfirmed,
      });
      if (r.ok) {
        setResult(r.result);
      }
    });
  }

  return (
    <Modal title="Importar CSV" onClose={onClose}>
      {result ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="font-medium">Importación completada</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>{result.created} creados</li>
              <li>{result.reactivated} reactivados</li>
              <li>{result.skipped} con errores</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                onClose();
                router.refresh();
              }}
            >
              <Check className="mr-1.5 size-4" /> Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Pega un CSV con al menos la columna <code>email</code>. Opcional: <code>name</code>,{" "}
            <code>tags</code> (separados por <code>|</code>).
          </p>
          <textarea
            rows={10}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="email,name,tags
ana@example.com,Ana,vip|premium
luis@example.com,Luis,"
            className="w-full rounded-md border bg-background p-3 font-mono text-xs"
            required
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={preConfirmed}
              onChange={(e) => setPreConfirmed(e.target.checked)}
              className="size-4"
            />
            <span>
              Marcar como pre-confirmados (saltarse doble opt-in — sólo si tenés consentimiento
              previo)
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || csv.trim().length < 5}>
              {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Importar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function TagModal({
  ids,
  onClose,
  onApplied,
}: {
  ids: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const addArr = add
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const removeArr = remove
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (addArr.length === 0 && removeArr.length === 0) {
        onClose();
        return;
      }
      await tagSubscribersAction({ ids, add: addArr, remove: removeArr });
      onApplied();
    });
  }

  return (
    <Modal
      title={`Etiquetar ${ids.length} suscriptor${ids.length === 1 ? "" : "es"}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3 text-sm">
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="tag-add">
            Añadir etiquetas
          </label>
          <Input
            id="tag-add"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            placeholder="vip, español"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="tag-rm">
            Quitar etiquetas
          </label>
          <Input
            id="tag-rm"
            value={remove}
            onChange={(e) => setRemove(e.target.value)}
            placeholder="prueba"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Aplicar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <dialog> requiere openModal imperativo; mantenemos div+role para uso simple
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
