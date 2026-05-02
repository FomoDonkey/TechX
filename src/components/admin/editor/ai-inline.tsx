"use client";

/**
 * AI Inline (⌘J) — popover anclado al editor.
 * - Lista de 12 acciones agrupadas + input de prompt libre.
 * - Streamea desde /api/admin/ai/inline.
 * - Preview con accept/reject.
 *
 * Activación:
 *   window.dispatchEvent(new CustomEvent("csm:ai-inline:open"))
 *
 * Recibe el editor por prop. Lee la selección actual al abrirse.
 */

import { type AIAction, AI_ACTIONS, SUPPORTED_LANGS } from "@/ai/prompts";
import { Button } from "@/components/ui/button";
import type { Editor } from "@tiptap/react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Languages,
  Loader2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = { editor: Editor | null };

type Mode = "list" | "running" | "result";

export function AIInlinePopover({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(
    null,
  );
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [result, setResult] = useState("");
  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [translateLang, setTranslateLang] = useState<string>("en");
  const abortRef = useRef<AbortController | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = AI_ACTIONS.filter(
      (a) => !f || a.label.toLowerCase().includes(f) || a.description.toLowerCase().includes(f),
    );
    const order = ["Generar", "Refinar", "Tono", "Traducir", "SEO"];
    const map = new Map<string, typeof AI_ACTIONS>();
    for (const a of filtered) {
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return order
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filter]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const computePosition = useCallback(() => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    const view = editor.view;
    try {
      const start = view.coordsAtPos(from);
      const end = from === to ? start : view.coordsAtPos(to);
      // Coords son viewport-relative (de getBoundingClientRect). Usamos position: fixed.
      const POPOVER_W = 420;
      const POPOVER_H_EST = 380;
      const GAP = 8;
      let top = Math.max(start.bottom, end.bottom) + GAP;
      // Si se sale por abajo, mostramos arriba de la selección
      if (top + POPOVER_H_EST > window.innerHeight - 16) {
        top = Math.min(start.top, end.top) - POPOVER_H_EST - GAP;
        if (top < 16) top = 16; // siempre dentro
      }
      let left = Math.min(start.left, end.left);
      left = Math.min(left, window.innerWidth - POPOVER_W - 8);
      left = Math.max(8, left);
      return { top, left };
    } catch {
      return null;
    }
  }, [editor]);

  const openPopover = useCallback(() => {
    if (!editor) return;
    // Si había un stream en curso de una sesión previa, abortarlo
    abortRef.current?.abort();
    abortRef.current = null;
    const { from, to, empty } = editor.state.selection;
    let selText = "";
    if (!empty) {
      selText = editor.state.doc.textBetween(from, to, "\n").trim();
    }
    // Si no hay selección, usamos el bloque actual completo como contexto.
    setSelection({ from, to, text: selText });
    const p = computePosition();
    setPos(p);
    setMode("list");
    setResult("");
    setActiveAction(null);
    setFilter("");
    setHighlight(0);
    setOpen(true);
  }, [editor, computePosition]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setMode("list");
    setResult("");
    setActiveAction(null);
    if (editor) editor.commands.focus();
  }, [editor]);

  useEffect(() => {
    function onOpen() {
      openPopover();
    }
    window.addEventListener("csm:ai-inline:open", onOpen);
    return () => window.removeEventListener("csm:ai-inline:open", onOpen);
  }, [openPopover]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Reposicionar en scroll/resize para mantener anclaje a la selección
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const p = computePosition();
      if (p) setPos(p);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, computePosition]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        close();
      }
    }
    // Pequeño delay para no auto-cerrarse en el click que abre
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  async function runAction(action: AIAction) {
    if (!editor || !selection) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setActiveAction(action);
    setMode("running");
    setResult("");
    let body: {
      action: AIAction;
      selection: string;
      context: string;
      targetLang?: string;
    } = {
      action,
      selection: selection.text,
      context: getDocContext(editor),
    };
    if (action === "translate") body = { ...body, targetLang: translateLang };

    try {
      const res = await fetch("/api/admin/ai/inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          let evtName: string | null = null;
          let dataLine: string | null = null;
          for (const l of lines) {
            if (l.startsWith("event:")) evtName = l.slice(6).trim();
            else if (l.startsWith("data:")) dataLine = l.slice(5).trim();
          }
          if (evtName === "done") break;
          if (evtName === "error") {
            throw new Error(dataLine ?? "stream error");
          }
          if (dataLine) {
            const piece = dataLine.replace(/\\n/g, "\n");
            setResult((r) => r + piece);
          }
        }
      }
      // Lee el resultado funcional (no la closure stale) usando el setter
      let finalResult = "";
      setResult((r) => {
        finalResult = r;
        return r;
      });
      if (!finalResult.trim()) {
        setMode("list");
        toast.error("La IA devolvió una respuesta vacía. Reintenta.");
        return;
      }
      setMode("result");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMode("list");
      toast.error(err instanceof Error ? err.message : "Error de IA");
    }
  }

  function accept() {
    if (!editor || !selection || !result) return;
    if (selection.text.length > 0) {
      // Reemplazar selección
      editor
        .chain()
        .focus()
        .insertContentAt({ from: selection.from, to: selection.to }, result)
        .run();
    } else {
      // Insertar al cursor (o append si nada)
      editor.chain().focus().insertContentAt(selection.from, result).run();
    }
    close();
    toast.success("Aplicado");
  }

  function insertBelow() {
    if (!editor || !selection || !result) return;
    const insertAt = Math.max(selection.to, selection.from);
    editor.chain().focus().insertContentAt(insertAt, `\n\n${result}`).run();
    close();
    toast.success("Insertado");
  }

  if (!open || !pos) return null;

  return (
    <div
      ref={popRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 60 }}
      className="w-[420px] rounded-xl border border-border/70 bg-popover/95 shadow-2xl backdrop-blur"
      // biome-ignore lint/a11y/useSemanticElements: popover anclado a la selección de Tiptap; <dialog> nativo no encaja con posicionamiento custom
      role="dialog"
      aria-label="AI Inline"
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Sparkles className="size-4 text-primary" />
        <span className="text-xs font-medium">AI Inline</span>
        {selection?.text ? (
          <span className="ml-1 truncate text-xs text-muted-foreground">
            · sobre {selection.text.length} car.
          </span>
        ) : (
          <span className="ml-1 text-xs text-muted-foreground">· sin selección</span>
        )}
        <button
          type="button"
          onClick={close}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {mode === "list" ? (
        <ListMode
          grouped={grouped}
          flat={flat}
          highlight={highlight}
          setHighlight={setHighlight}
          filter={filter}
          setFilter={setFilter}
          onPick={runAction}
          translateLang={translateLang}
          setTranslateLang={setTranslateLang}
        />
      ) : null}

      {mode === "running" ? <RunningMode partial={result} /> : null}

      {mode === "result" ? (
        <ResultMode
          result={result}
          onAccept={accept}
          onInsertBelow={insertBelow}
          onRetry={() => {
            if (activeAction) void runAction(activeAction);
          }}
          onDiscard={close}
        />
      ) : null}
    </div>
  );
}

function ListMode({
  grouped,
  flat,
  highlight,
  setHighlight,
  filter,
  setFilter,
  onPick,
  translateLang,
  setTranslateLang,
}: {
  grouped: Array<{ group: string; items: typeof AI_ACTIONS }>;
  flat: typeof AI_ACTIONS;
  highlight: number;
  setHighlight: (i: number) => void;
  filter: string;
  setFilter: (v: string) => void;
  onPick: (a: AIAction) => void;
  translateLang: string;
  setTranslateLang: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(Math.min(flat.length - 1, highlight + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(Math.max(0, highlight - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = flat[highlight];
      if (pick) onPick(pick.id);
    }
  }

  return (
    <div className="flex max-h-[60vh] flex-col">
      <div className="border-b border-border/50 px-3 py-2">
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onInputKey}
          placeholder="Pide algo o filtra acciones…"
          className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="overflow-y-auto px-1 py-1">
        {grouped.map(({ group, items }) => (
          <div key={group} className="mb-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            {items.map((a) => {
              const idx = flat.findIndex((x) => x.id === a.id);
              const active = idx === highlight;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a.id)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <div>
                    <div className="font-medium leading-tight">{a.label}</div>
                    <div className="text-[11px] leading-tight text-muted-foreground">
                      {a.description}
                    </div>
                  </div>
                  {a.id === "translate" ? (
                    <select
                      value={translateLang}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTranslateLang(e.target.value)}
                      className="rounded-md border border-border/60 bg-background px-1.5 py-1 text-xs"
                    >
                      {SUPPORTED_LANGS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <ArrowRight className="size-3.5 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>↑↓ navegar</span>
        <span>↵ ejecutar</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Languages className="size-3" />
          {translateLang.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function RunningMode({ partial }: { partial: string }) {
  return (
    <div className="px-4 py-4">
      <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Generando…
      </div>
      <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
        {partial || <span className="opacity-60">Pensando…</span>}
      </div>
    </div>
  );
}

function ResultMode({
  result,
  onAccept,
  onInsertBelow,
  onRetry,
  onDiscard,
}: {
  result: string;
  onAccept: () => void;
  onInsertBelow: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="px-3 py-3">
      <div className="mb-2 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
        {result}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="gradient" onClick={onAccept}>
          <Check className="size-3.5" /> Reemplazar
        </Button>
        <Button size="sm" variant="outline" onClick={onInsertBelow}>
          <ArrowDown className="size-3.5" /> Insertar debajo
        </Button>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Reintentar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} className="ml-auto">
          Descartar
        </Button>
      </div>
    </div>
  );
}

/**
 * Devuelve hasta ~3000 caracteres alrededor del cursor para dar contexto al modelo.
 */
function getDocContext(editor: Editor): string {
  const { from } = editor.state.selection;
  const max = 3000;
  const start = Math.max(0, from - max / 2);
  const end = Math.min(editor.state.doc.content.size, from + max / 2);
  return editor.state.doc.textBetween(start, end, "\n");
}
