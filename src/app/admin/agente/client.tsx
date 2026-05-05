"use client";

import { Button } from "@/components/ui/button";
import { Bot, ChevronDown, ChevronRight, Send, Sparkles, User, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Cliente del agente editorial. Conversación turn-by-turn con stream NDJSON
 * desde `/api/admin/ai/agent`. Renderiza:
 *  - Mensajes user/assistant en burbujas.
 *  - Tool calls como cards plegables con input + output JSON.
 *  - Indicador "pensando" / "ejecutando tool" mientras stream-ea.
 */

type ContentPart =
  | { type: "text"; id: string; text: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      isError?: boolean;
    };

type UIMessage =
  | { role: "user"; id: string; text: string }
  | { role: "assistant"; id: string; parts: ContentPart[] };

type WireMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
    }
  | {
      role: "user";
      content: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }>;
    };

export function AgentChat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null);
    const turnId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMsg: UIMessage = { role: "user", id: `${turnId}-u`, text };
    const assistantMsg: UIMessage = { role: "assistant", id: `${turnId}-a`, parts: [] };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setBusy(true);

    // Construye el payload "wire" desde el historial UI.
    const wire = toWireMessages([...messages, userMsg]);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/admin/ai/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: wire }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl = buf.indexOf("\n");
        while (nl !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            try {
              const evt = JSON.parse(line) as
                | { type: "text"; delta: string }
                | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
                | { type: "tool_result"; id: string; output: string; isError?: boolean }
                | { type: "done"; reason: string }
                | { type: "error"; message: string };
              applyEvent(setMessages, evt);
              if (evt.type === "error") setError(evt.message);
            } catch {
              // skip malformed
            }
          }
          nl = buf.indexOf("\n");
        }
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "error inesperado");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <Empty suggestions={suggestions} onPick={(s) => send(s)} />
          ) : (
            messages.map((m) => <MessageView key={m.id} m={m} />)
          )}
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="border-t bg-background/60 px-6 py-4 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div className="flex flex-1 items-end rounded-2xl border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Pídele algo al agente… (Enter para enviar, Shift+Enter línea nueva)"
              className="max-h-40 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {busy ? (
            <Button type="button" variant="outline" onClick={stop}>
              Parar
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              <Send className="size-4" />
            </Button>
          )}
          {messages.length > 0 && !busy ? (
            <Button type="button" variant="ghost" onClick={clear}>
              Limpiar
            </Button>
          ) : null}
        </form>
      </footer>
    </div>
  );
}

function Empty({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white shadow-lg">
        <Sparkles className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">¿Qué publicamos hoy?</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Pídele que busque, cree, edite o publique. Tiene los mismos tools que el MCP server, así que
        puede gestionar tu contenido conversando.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => onPick(s)}
            className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-card/80"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({ m }: { m: UIMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="whitespace-pre-wrap text-sm">{m.text}</p>
        </div>
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
          <User className="size-4 text-muted-foreground" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {m.parts.length === 0 ? (
          <ThinkingDots />
        ) : (
          m.parts.map((p) =>
            p.type === "text" ? (
              <p key={p.id} className="whitespace-pre-wrap text-sm leading-relaxed">
                {p.text || <ThinkingDots />}
              </p>
            ) : (
              <ToolCallCard key={p.id} call={p} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}

function ToolCallCard({
  call,
}: {
  call: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output?: string;
    isError?: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const ChevronIcon = open ? ChevronDown : ChevronRight;
  const status = call.output === undefined ? "running" : call.isError ? "error" : "ok";
  return (
    <div
      className={`rounded-lg border bg-muted/30 text-xs ${
        status === "error" ? "border-destructive/30" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <code className="font-mono">{call.name}</code>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          {status === "running" ? (
            <span className="text-amber-600 dark:text-amber-400">ejecutando…</span>
          ) : status === "error" ? (
            <span className="text-destructive">error</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">ok</span>
          )}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t p-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Input</p>
            <pre className="overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px]">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.output ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Output
              </p>
              <pre className="max-h-64 overflow-auto rounded-md bg-background p-2 font-mono text-[11px]">
                {call.output}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// State helpers
// ============================================================

function applyEvent(
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>,
  evt:
    | { type: "text"; delta: string }
    | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; id: string; output: string; isError?: boolean }
    | { type: "done"; reason: string }
    | { type: "error"; message: string },
) {
  if (evt.type === "done" || evt.type === "error") return;

  setMessages((prev) => {
    if (prev.length === 0) return prev;
    const lastIdx = prev.length - 1;
    const last = prev[lastIdx];
    if (!last || last.role !== "assistant") return prev;

    const parts = [...last.parts];

    if (evt.type === "text") {
      // Append al último text part o crea uno nuevo (con id estable para React keys).
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.type === "text") {
        parts[parts.length - 1] = {
          type: "text",
          id: lastPart.id,
          text: lastPart.text + evt.delta,
        };
      } else {
        parts.push({
          type: "text",
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: evt.delta,
        });
      }
    } else if (evt.type === "tool_call") {
      parts.push({ type: "tool_call", id: evt.id, name: evt.name, input: evt.input });
    } else if (evt.type === "tool_result") {
      const idx = parts.findIndex((p) => p.type === "tool_call" && p.id === evt.id);
      if (idx >= 0) {
        const tc = parts[idx];
        if (tc && tc.type === "tool_call") {
          parts[idx] = { ...tc, output: evt.output, isError: evt.isError };
        }
      }
    }

    const updated: UIMessage = { role: "assistant", id: last.id, parts };
    return [...prev.slice(0, lastIdx), updated];
  });
}

function toWireMessages(ui: UIMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  for (const m of ui) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else {
      // Assistant: text parts → text blocks; tool_call parts → tool_use; resultados → user tool_result.
      const blocks: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      > = [];
      const results: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];
      for (const p of m.parts) {
        if (p.type === "text" && p.text) {
          blocks.push({ type: "text", text: p.text });
        } else if (p.type === "tool_call") {
          blocks.push({ type: "tool_use", id: p.id, name: p.name, input: p.input });
          if (p.output !== undefined) {
            results.push({
              type: "tool_result",
              tool_use_id: p.id,
              content: p.output,
              is_error: p.isError,
            });
          }
        }
      }
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
      if (results.length > 0) out.push({ role: "user", content: results });
    }
  }
  return out;
}
