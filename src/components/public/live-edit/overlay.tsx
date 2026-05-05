"use client";

import { type BlockSpec, type PropSpec, getBlockSpec } from "@/blocks/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, LogOut, Pencil, Save, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Selected = {
  blockId: string;
  kind: string;
  /** snapshot inicial leído del DOM/llamada al server. */
  initialProps: Record<string, unknown>;
};

export function LiveEditOverlay({
  pageId,
  pagePath,
  pageTitle,
  /** Layout serializado de la página actual (server-passed). El cliente lo
   * usa para encontrar el nodo + props inicial al hacer click en un bloque,
   * sin necesidad de hacer un round-trip. */
  layout,
}: {
  pageId: string;
  pagePath: string;
  pageTitle: string;
  layout: unknown;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  // Index de blockId → node para lookup rápido
  const indexRef = useRef<Map<string, { kind: string; props: Record<string, unknown> }>>(new Map());
  useEffect(() => {
    const map = indexRef.current;
    map.clear();
    function walk(nodes: unknown) {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n || typeof n !== "object") continue;
        const obj = n as { id?: unknown; kind?: unknown; props?: unknown; children?: unknown };
        if (typeof obj.id === "string" && typeof obj.kind === "string") {
          map.set(obj.id, {
            kind: obj.kind,
            props:
              obj.props && typeof obj.props === "object"
                ? (obj.props as Record<string, unknown>)
                : {},
          });
        }
        if (Array.isArray(obj.children)) walk(obj.children);
      }
    }
    walk(layout);
  }, [layout]);

  // Click handler global: detecta clicks en [data-csm-block-id]
  useEffect(() => {
    function handler(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      let el: HTMLElement | null = target;
      while (el && el !== document.body) {
        if (el.dataset?.csmBlockId) {
          const id = el.dataset.csmBlockId;
          const node = indexRef.current.get(id);
          if (!node) return;
          // Sólo abrimos editor si el bloque tiene PROPS editables (texto/url/longtext)
          const spec = getBlockSpec(node.kind);
          if (!spec) return;
          if (!hasEditableProps(spec)) return;
          ev.preventDefault();
          ev.stopPropagation();
          setSelected({ blockId: id, kind: node.kind, initialProps: node.props });
          setDraft({ ...node.props });
          setError(null);
          return;
        }
        el = el.parentElement;
      }
    }
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, []);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/live-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pageId,
          blockId: selected.blockId,
          props: draft,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && (data as { error?: string }).error) || `error_${res.status}`);
        return;
      }
      setSelected(null);
      // Soft refresh: recarga la página para ver el cambio
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally {
      setSaving(false);
    }
  }

  function exitEdit() {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    window.location.href = url.toString();
  }

  return (
    <>
      {/* Toolbar fija */}
      <div className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-violet-400/40 bg-background/95 px-3 py-2 shadow-2xl shadow-violet-500/20 backdrop-blur-md">
        <Sparkles className="size-4 text-violet-300" />
        <span className="text-xs font-medium">
          Modo edición · <span className="text-muted-foreground">{pageTitle}</span>
        </span>
        <Link
          href="/admin/paginas"
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-[11px] hover:bg-muted/60"
        >
          <ExternalLink className="size-3" />
          Ir al editor
        </Link>
        <button
          type="button"
          onClick={exitEdit}
          className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-[11px] hover:bg-muted/60"
        >
          <LogOut className="size-3" />
          Salir
        </button>
      </div>

      {/* Hint banner al cargar */}
      <div className="fixed top-4 right-4 z-[200] max-w-xs rounded-2xl border bg-card/95 p-3 text-xs shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 font-medium">
          <Pencil className="size-3.5 text-violet-300" />
          Click en cualquier bloque para editarlo
        </div>
        <p className="mt-1 text-muted-foreground">
          Los cambios se publican al instante.{" "}
          <code className="rounded bg-muted px-1">{pagePath}</code>
        </p>
      </div>

      {/* Editor sheet */}
      <Dialog.Root
        open={selected !== null}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[230] bg-background/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed right-0 top-0 z-[240] flex h-screen w-full max-w-md flex-col border-l bg-popover shadow-2xl data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
            {selected ? (
              <BlockEditor
                selected={selected}
                draft={draft}
                onChange={setDraft}
                onCancel={() => setSelected(null)}
                onSave={handleSave}
                saving={saving}
                error={error}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function BlockEditor({
  selected,
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  selected: Selected;
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const spec = getBlockSpec(selected.kind);
  if (!spec) return null;
  const editable = spec.propsSpec.filter(isEditableProp);

  function patch(key: string, value: unknown) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <Dialog.Title className="font-display text-lg font-semibold">
            Editar {spec.label}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground">
            {selected.kind} · #{selected.blockId.slice(0, 8)}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </Dialog.Close>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {editable.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Este bloque no tiene campos editables inline. Usa el editor completo desde{" "}
            <Link href="/admin/paginas" className="underline">
              /admin/paginas
            </Link>
            .
          </div>
        ) : (
          editable.map((p) => (
            <FieldEditor
              key={p.key}
              spec={p}
              value={draft[p.key]}
              onChange={(v) => patch(p.key, v)}
            />
          ))
        )}
        {error ? (
          <p className="rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Error: {error}
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t bg-card/40 px-5 py-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving} className="gap-1.5">
          <Save className="size-3.5" />
          {saving ? "Guardando…" : "Guardar y publicar"}
        </Button>
      </footer>
    </div>
  );
}

function isEditableProp(p: PropSpec): boolean {
  // v1: sólo campos simples. Rich text / image / items requieren el editor admin.
  return p.kind === "text" || p.kind === "longtext" || p.kind === "url" || p.kind === "select";
}

function hasEditableProps(spec: BlockSpec): boolean {
  return spec.propsSpec.some(isEditableProp);
}

function FieldEditor({
  spec,
  value,
  onChange,
}: {
  spec: PropSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const v = typeof value === "string" ? value : "";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`le-${spec.key}`}>{spec.label}</Label>
      {spec.kind === "longtext" ? (
        <Textarea
          id={`le-${spec.key}`}
          rows={4}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : spec.kind === "select" && spec.options ? (
        <select
          id={`le-${spec.key}`}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full rounded-md border bg-background px-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-violet-400/60",
          )}
        >
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={`le-${spec.key}`}
          type={spec.kind === "url" ? "url" : "text"}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {spec.description ? (
        <p className="text-[11px] text-muted-foreground">{spec.description}</p>
      ) : null}
    </div>
  );
}
