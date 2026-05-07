"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircle,
  Monitor,
  Plug,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectModal } from "./connect-modal";

/**
 * /admin/builder — Lovable Mode (B2: conversacional + iterativo).
 *
 * Layout split:
 *   ├─ Chat (izq, 420px) — turnos user ↔ assistant. Primer turno = build inicial,
 *   │   resto = refinamientos (add posts, edit brand, regenerate, delete…).
 *   └─ Preview (der, flex-1) — iframe del sitio público con breakpoint toggles.
 *
 * Cada turno se persiste en memoria del componente. Se refresca el iframe
 * cuando llega `preview-refresh` o `done`.
 */

type Step = { id: string; status: "running" | "done" | "error"; label: string; details?: unknown };

type Turn = {
  id: string;
  userText: string;
  steps: Step[];
  chatReply: string | null;
  status: "running" | "done" | "error";
  errorMessage: string | null;
};

type ProviderInfo =
  | { kind: "anthropic"; source: "workspace" | "env"; model: string }
  | { kind: "ollama"; baseUrl: string; model: string }
  | { kind: "openai"; source: "workspace" | "env"; model: string }
  | { kind: "groq"; source: "env" }
  | { kind: "none" };

type Breakpoint = "mobile" | "tablet" | "desktop";

const BREAKPOINTS: Record<Breakpoint, { width: number; label: string; icon: typeof Smartphone }> = {
  mobile: { width: 390, label: "iPhone", icon: Smartphone },
  tablet: { width: 768, label: "Tablet", icon: Tablet },
  desktop: { width: 1280, label: "Desktop", icon: Monitor },
};

export function BuilderClient(props: {
  suggestions: string[];
  provider: ProviderInfo;
  workspaceName: string;
  workspaceSlug: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [previewPath, setPreviewPath] = useState<"/" | "/blog">("/");
  const [showConnect, setShowConnect] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);

  const providerNeedsConfig = props.provider.kind === "none";
  const providerLabel = useMemo(() => {
    switch (props.provider.kind) {
      case "anthropic":
        return `Anthropic · ${props.provider.model}`;
      case "ollama":
        return `Ollama · ${props.provider.model}`;
      case "openai":
        return `OpenAI · ${props.provider.model}`;
      case "groq":
        return "Groq · Llama 3.3 70B";
      case "none":
        return "Sin proveedor";
    }
  }, [props.provider]);

  // Mantén el ref sincronizado para el handler async
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Auto-scroll al fondo cuando cambian los turnos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: turnsSig dispara en cada step.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, turns[turns.length - 1]?.steps.length]);

  const refreshPreview = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  function patchTurn(turnId: string, patch: (t: Turn) => Turn) {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? patch(t) : t)));
  }

  async function runTurn(text: string) {
    if (!text.trim() || running) return;
    if (providerNeedsConfig) {
      setShowConnect(true);
      return;
    }

    const turnId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mode: "first" | "refine" = turnsRef.current.length === 0 ? "first" : "refine";
    const newTurn: Turn = {
      id: turnId,
      userText: text,
      steps: [],
      chatReply: null,
      status: "running",
      errorMessage: null,
    };
    setTurns((prev) => [...prev, newTurn]);
    setRunning(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/admin/builder/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text, mode }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
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
          nl = buf.indexOf("\n");
          if (!line) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          handleEvent(turnId, evt as never);
        }
      }
      patchTurn(turnId, (t) => ({ ...t, status: t.status === "running" ? "done" : t.status }));
    } catch (e) {
      if (ac.signal.aborted) return;
      const msg = e instanceof Error ? e.message : "unknown";
      patchTurn(turnId, (t) => ({ ...t, status: "error", errorMessage: msg }));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function handleEvent(
    turnId: string,
    evt: {
      type: string;
      id?: string;
      status?: Step["status"];
      label?: string;
      details?: unknown;
      message?: string;
      text?: string;
    },
  ) {
    if (evt.type === "step" && evt.id && evt.status && evt.label) {
      const next: Step = { id: evt.id, status: evt.status, label: evt.label, details: evt.details };
      patchTurn(turnId, (t) => {
        const i = t.steps.findIndex((s) => s.id === next.id);
        if (i === -1) return { ...t, steps: [...t.steps, next] };
        const copy = [...t.steps];
        copy[i] = next;
        return { ...t, steps: copy };
      });
    } else if (evt.type === "chat-reply" && typeof evt.text === "string") {
      patchTurn(turnId, (t) => ({ ...t, chatReply: evt.text ?? null }));
    } else if (evt.type === "preview-refresh") {
      refreshPreview();
    } else if (evt.type === "error") {
      patchTurn(turnId, (t) => ({
        ...t,
        status: "error",
        errorMessage: evt.message ?? "Error desconocido",
      }));
    } else if (evt.type === "done") {
      patchTurn(turnId, (t) => ({ ...t, status: "done" }));
      refreshPreview();
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
    if (turnsRef.current.length > 0) {
      const last = turnsRef.current[turnsRef.current.length - 1];
      if (last && last.status === "running") {
        patchTurn(last.id, (t) => ({ ...t, status: "error", errorMessage: "Detenido" }));
      }
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    runTurn(prompt);
    setPrompt("");
  }

  function useSuggestion(s: string) {
    setPrompt(s);
  }

  const isFirstBuild = turns.length === 0;
  const placeholder = isFirstBuild
    ? "Blog de cocina vegana con suscripción mensual…"
    : "Hazlo más cálido · añade un post sobre veganismo deportivo · cambia el hero…";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* ─────────── PANEL IZQUIERDO: CHAT ─────────── */}
      <aside className="flex w-[420px] flex-shrink-0 flex-col border-r bg-gradient-to-b from-[oklch(0.13_0.02_290/0.4)] to-background backdrop-blur">
        {/* Header */}
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white shadow-lg shadow-[var(--brand-1)]/20">
              <Wand2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-tight">Builder</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {isFirstBuild
                  ? "Describe tu sitio y la IA lo construye"
                  : "Sigue pidiendo cambios — el chat está vivo"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConnect(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
                providerNeedsConfig
                  ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400",
              )}
            >
              <Plug className="h-3 w-3" />
              {providerNeedsConfig ? "Conectar" : providerLabel}
            </button>
          </div>
        </div>

        {/* Body: turnos */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <Empty
              suggestions={props.suggestions}
              onPick={useSuggestion}
              providerNeedsConfig={providerNeedsConfig}
              onConnect={() => setShowConnect(true)}
            />
          )}

          <div className="space-y-4">
            {turns.map((turn, idx) => (
              <TurnCard key={turn.id} turn={turn} isFirst={idx === 0} />
            ))}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="flex-shrink-0 border-t bg-background/50 p-3 backdrop-blur"
        >
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  submit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={placeholder}
              disabled={running}
              rows={3}
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 pr-12 text-sm placeholder:text-muted-foreground/60 focus:border-[var(--brand-1)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-1)]"
            />
            <button
              type={running ? "button" : "submit"}
              onClick={running ? stop : undefined}
              disabled={!running && !prompt.trim()}
              className={cn(
                "absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-lg transition disabled:opacity-40 disabled:shadow-none",
                running
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white shadow-[var(--brand-1)]/30 hover:scale-105",
              )}
              aria-label={running ? "Detener" : "Enviar"}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            ⌘↵ para enviar · {providerLabel}
          </p>
        </form>
      </aside>

      {/* ─────────── PANEL DERECHO: PREVIEW ─────────── */}
      <main className="flex flex-1 flex-col bg-gradient-to-br from-muted/30 to-background">
        {/* Toolbar preview */}
        <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b bg-background/60 px-5 backdrop-blur">
          <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
            {(Object.keys(BREAKPOINTS) as Breakpoint[]).map((bp) => {
              const { icon: Icon, label } = BREAKPOINTS[bp];
              return (
                <button
                  key={bp}
                  type="button"
                  onClick={() => setBreakpoint(bp)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition",
                    breakpoint === bp
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
            {(["/", "/blog"] as const).map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setPreviewPath(path)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs transition",
                  previewPath === path
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {path === "/" ? "Inicio" : "Blog"}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{props.workspaceName}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={refreshPreview}
            className="h-7 gap-1 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refrescar
          </Button>
        </div>

        {/* Iframe area */}
        <div className="flex flex-1 items-start justify-center overflow-auto p-6">
          <div
            className="overflow-hidden rounded-2xl border bg-background shadow-2xl shadow-black/20 transition-[width] duration-300"
            style={{
              width: BREAKPOINTS[breakpoint].width,
              height: "calc(100vh - 8.5rem)",
              maxWidth: "100%",
            }}
          >
            <iframe
              key={iframeKey}
              src={`${previewPath}?_builder=1&_t=${iframeKey}`}
              title="Preview del sitio"
              className="h-full w-full border-0 bg-background"
              loading="eager"
            />
          </div>
        </div>
      </main>

      {showConnect && (
        <ConnectModal currentProvider={props.provider} onClose={() => setShowConnect(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function TurnCard({ turn, isFirst }: { turn: Turn; isFirst: boolean }) {
  const accent =
    turn.status === "error"
      ? "border-destructive/30"
      : turn.status === "running"
        ? "border-[var(--brand-1)]/30 bg-[var(--brand-1)]/3"
        : "border-border";

  return (
    <div className={cn("rounded-xl border", accent)}>
      {/* User bubble */}
      <div className="border-b border-border/50 px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
            Tú
          </span>
          <p className="flex-1 text-xs leading-relaxed text-foreground/90">{turn.userText}</p>
          {!isFirst && (
            <span className="mt-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Refinar
            </span>
          )}
        </div>
      </div>

      {/* Assistant body: steps + chat reply */}
      <div className="space-y-1.5 px-3 py-2.5">
        {turn.chatReply && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--brand-1)]/5 px-2.5 py-2">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--brand-1)]" />
            <p className="text-xs leading-relaxed text-foreground/85">{turn.chatReply}</p>
          </div>
        )}
        {turn.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
        {turn.status === "error" && turn.errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span className="leading-relaxed">{turn.errorMessage}</span>
          </div>
        )}
        {turn.status === "running" && turn.steps.length === 0 && !turn.chatReply && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Procesando…
          </div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition",
        step.status === "running" && "bg-[var(--brand-1)]/5",
        step.status === "done" && "bg-emerald-500/5",
        step.status === "error" && "bg-destructive/10",
      )}
    >
      <StepIcon status={step.status} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[11px] font-medium leading-snug",
            step.status === "running" && "text-foreground",
            step.status === "done" && "text-foreground/80",
            step.status === "error" && "text-destructive",
          )}
        >
          {step.label}
        </p>
        {Boolean(step.details) && step.status !== "running" && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
            {formatDetails(step.details)}
          </p>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: Step["status"] }) {
  const cls = "h-3 w-3 flex-shrink-0";
  if (status === "running")
    return <Loader2 className={cn(cls, "animate-spin text-[var(--brand-1)]")} />;
  if (status === "done") return <CheckCircle2 className={cn(cls, "text-emerald-600")} />;
  return <AlertCircle className={cn(cls, "text-destructive")} />;
}

function formatDetails(d: unknown): string {
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    const obj = d as Record<string, unknown>;
    if (typeof obj.slug === "string") return `/${obj.slug}`;
    if (typeof obj.brandName === "string") return `${obj.brandName} · ${obj.postCount ?? 0} posts`;
    return JSON.stringify(obj).slice(0, 80);
  }
  return "";
}

function Empty({
  suggestions,
  onPick,
  providerNeedsConfig,
  onConnect,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
  providerNeedsConfig: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-4 py-2">
      <div className="rounded-2xl border bg-gradient-to-br from-[var(--brand-1)]/8 via-transparent to-[var(--brand-2)]/8 p-4">
        <Sparkles className="mb-2 h-5 w-5 text-[var(--brand-1)]" />
        <h2 className="mb-1 text-sm font-semibold tracking-tight">¿Qué construimos hoy?</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Describe tu sitio en lenguaje natural. Después podrás seguir pidiendo cambios — el chat se
          queda vivo.
        </p>
      </div>

      {providerNeedsConfig && (
        <button
          type="button"
          onClick={onConnect}
          className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-amber-500/15"
        >
          <Plug className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Conecta tu proveedor de IA
            </p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70">
              Anthropic, OpenAI, Ollama local — un clic
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-amber-600 transition group-hover:translate-x-0.5 dark:text-amber-400" />
        </button>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Pruebas rápidas
        </p>
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="group flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs transition hover:border-[var(--brand-1)]/40 hover:bg-muted/40"
            >
              <span className="truncate text-foreground/80 group-hover:text-foreground">{s}</span>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
