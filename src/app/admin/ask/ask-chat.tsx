"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Ref = { n: number; id: string; title: string; slug: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  refs?: Ref[];
};

const SUGGESTED = [
  "¿Qué temas he tratado más?",
  "Resume mis últimos 3 posts",
  "¿Sobre qué hablé la semana pasada?",
  "Hazme un esquema para un nuevo artículo basado en mi contenido",
];

export function AskChat({ workspaceSlug }: { workspaceSlug: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  async function ask(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const r = await fetch("/api/admin/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text.trim(),
          history: [...messages, userMsg]
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
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
          if (evtName === "refs" && dataLine) {
            const refs = JSON.parse(dataLine) as Ref[];
            setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, refs } : x)));
            continue;
          }
          if (dataLine) {
            const piece = dataLine.replace(/\\n/g, "\n");
            setMessages((m) =>
              m.map((x) => (x.id === assistantId ? { ...x, content: x.content + piece } : x)),
            );
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Error de IA");
      }
    } finally {
      setStreaming(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card/30">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mt-8 space-y-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pregunta cualquier cosa sobre tu contenido</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recupero los 5 fragmentos más relevantes y sintetizo una respuesta con citas.
              </p>
            </div>
            <div className="mx-auto grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}
            >
              <CitedText text={m.content} refs={m.refs ?? []} workspaceSlug={workspaceSlug} />
              {m.refs && m.refs.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-border/40 pt-2 text-[11px]">
                  {m.refs.map((r) => (
                    <li key={r.id}>
                      <a
                        href={`/blog/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        [{r.n}] {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-center gap-2 border-t border-border/60 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? "Generando…" : "Pregunta sobre tus posts publicados…"}
          className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
          disabled={streaming}
        />
        {streaming ? (
          <Button type="button" size="sm" variant="outline" onClick={stop}>
            Parar
          </Button>
        ) : (
          <Button type="submit" size="sm" variant="gradient" disabled={!input.trim()}>
            <Send className="size-3.5" /> Enviar
          </Button>
        )}
        {streaming ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </form>
    </div>
  );
}

/** Convierte [1], [2]... en links a las refs. */
function CitedText({ text, refs }: { text: string; refs: Ref[]; workspaceSlug: string }) {
  if (!text) return <span className="opacity-60">…</span>;
  const parts = text.split(/(\[\d+\])/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p);
        const partKey = `${i}-${p}`;
        if (m?.[1]) {
          const n = Number(m[1]);
          const ref = refs.find((r) => r.n === n);
          if (ref) {
            return (
              <a
                key={partKey}
                href={`/blog/${ref.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-0.5 inline-flex items-center justify-center rounded-md bg-primary/15 px-1.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
                title={ref.title}
              >
                {n}
              </a>
            );
          }
        }
        return <span key={partKey}>{p}</span>;
      })}
    </span>
  );
}
