"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, ExternalLink, Server, Sparkles, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Modal "Conectar IA" — recibe el provider activo y muestra:
 *  - Tarjetas de los providers disponibles (Anthropic, OpenAI, Ollama, Vercel AI Gateway)
 *  - El estado actual del provider activo
 *  - CTA al panel completo de /admin/ajustes/ia
 *
 * Por qué no OAuth real para Anthropic/OpenAI: ninguno expone OAuth para
 * apps de terceros. Lo más cerca de "1-clic" es Vercel AI Gateway con Sign
 * in with Vercel (futuro F10g B3) — los demás siguen siendo "pega tu key
 * una vez" pero con flujo pulido.
 */

type ProviderInfo =
  | { kind: "anthropic"; source: "workspace" | "env"; model: string }
  | { kind: "ollama"; baseUrl: string; model: string }
  | { kind: "openai"; source: "workspace" | "env"; model: string }
  | { kind: "groq"; source: "env" }
  | { kind: "none" };

const PROVIDERS: Array<{
  id: "anthropic" | "openai" | "ollama" | "vercel";
  name: string;
  description: string;
  icon: typeof Sparkles;
  badge?: string;
  consoleUrl: string;
  consoleLabel: string;
  highlight?: boolean;
}> = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Sonnet 4.6 / Opus 4.7. La mejor calidad para contenido editorial.",
    icon: Sparkles,
    badge: "Recomendado",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    consoleLabel: "Crear API key",
    highlight: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o mini para builds rápidos, GPT-4o para calidad alta.",
    icon: Bot,
    consoleUrl: "https://platform.openai.com/api-keys",
    consoleLabel: "Crear API key",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    description: "Modelos en tu máquina. 100% privado, gratis. Llama 3.3 70B recomendado.",
    icon: Server,
    badge: "Privado · Gratis",
    consoleUrl: "https://ollama.com/download",
    consoleLabel: "Descargar Ollama",
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
    description: "Un solo OAuth con Vercel y acceso a Claude, GPT, Llama y más. Próximamente.",
    icon: Zap,
    badge: "Soon",
    consoleUrl: "https://vercel.com/ai-gateway",
    consoleLabel: "Más info",
  },
];

export function ConnectModal({
  currentProvider,
  onClose,
}: {
  currentProvider: ProviderInfo;
  onClose: () => void;
}) {
  // Cierra con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloquea scroll del body mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const activeKind = currentProvider.kind;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClose();
      }}
      aria-label="Conectar proveedor de IA"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header con gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-1)]/15 via-background to-[var(--brand-2)]/10 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Conectar IA</h2>
              <p className="text-xs text-muted-foreground">
                Elige tu proveedor preferido. El Builder funciona con todos.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const isActive = activeKind === p.id;
              const Icon = p.icon;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition",
                    p.highlight && !isActive && "border-[var(--brand-1)]/30",
                    isActive && "border-emerald-500/40 bg-emerald-500/5",
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        p.highlight ? "text-[var(--brand-1)]" : "text-foreground/70",
                      )}
                    />
                    {p.badge && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                          p.id === "vercel"
                            ? "bg-muted text-muted-foreground"
                            : "bg-[var(--brand-1)]/15 text-[var(--brand-1)]",
                        )}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mb-1 text-sm font-semibold">{p.name}</h3>
                  <p className="mb-3 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                  {isActive ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Conectado
                    </div>
                  ) : p.id === "vercel" ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                      Disponible próximamente
                    </div>
                  ) : (
                    <a
                      href={p.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 text-[11px] font-medium transition hover:border-[var(--brand-1)]/40 hover:bg-muted/40"
                    >
                      {p.consoleLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl border bg-muted/30 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              ¿Cómo funciona?
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/40">1.</span>
                Crea tu API key en la consola del proveedor (botón arriba) — un minuto.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/40">2.</span>
                Pégala una sola vez en{" "}
                <Link
                  href="/admin/ajustes/ia"
                  className="font-medium text-[var(--brand-1)] underline-offset-2 hover:underline"
                >
                  Ajustes → Inteligencia Artificial
                </Link>
                . Se cifra AES-256.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[10px] text-foreground/40">3.</span>
                Vuelve aquí y empieza a construir. La key persiste en tu workspace.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
          <p className="text-[11px] text-muted-foreground">
            Tus keys se cifran con AES-256-GCM y nunca salen del servidor.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              asChild
              className="bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white"
            >
              <Link href="/admin/ajustes/ia">Ir a ajustes</Link>
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
