import { getAiProviderConfig } from "@/ai/keys";
import { aiFeatures } from "@/ai/provider";
import { Badge } from "@/components/ui/badge";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import Link from "next/link";
import { AgentChat } from "./client";

export const metadata: Metadata = { title: "Agente · CSM" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "¿Cómo está la salud de mi contenido?",
  "Lista mis 5 últimos drafts",
  "Busca posts sobre lanzamiento",
  "Crea un draft titulado 'Notas de la semana'",
  "¿Qué tengo en review esperando aprobación?",
  "Dime los 3 posts con peor score de salud y por qué",
];

type Status =
  | { kind: "ollama"; model: string; baseUrl: string }
  | { kind: "anthropic"; source: "workspace" | "env"; model: string }
  | { kind: "mock"; reason: string };

async function resolveAgentStatus(workspaceId: string, activeProvider: string): Promise<Status> {
  if (activeProvider === "ollama") {
    const cfg = await getAiProviderConfig(workspaceId, "ollama");
    return {
      kind: "ollama",
      model: cfg?.model || "llama3.2",
      baseUrl: cfg?.baseUrl || "http://localhost:11434",
    };
  }
  // Default a Anthropic. Workspace key tiene prioridad sobre env.
  const cfg = await getAiProviderConfig(workspaceId, "anthropic");
  if (cfg?.enabled && cfg.apiKey) {
    return { kind: "anthropic", source: "workspace", model: cfg.model || "claude-haiku-4-5" };
  }
  if (aiFeatures.hasAnthropic) {
    return { kind: "anthropic", source: "env", model: "claude-haiku-4-5" };
  }
  return {
    kind: "mock",
    reason: "Sin proveedor configurado · ve a Ajustes → Inteligencia Artificial",
  };
}

export default async function AgentePage() {
  const ctx = await requireWorkspace("editor");
  const activeProvider = ctx.workspace.aiProvider ?? "anthropic";
  const status = await resolveAgentStatus(ctx.workspace.id, activeProvider);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="border-b bg-background/60 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Agente Editorial</h1>
              <Badge className="border-transparent bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] text-white">
                Beta
              </Badge>
              {status.kind === "ollama" ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Ollama · {status.model}
                </span>
              ) : status.kind === "anthropic" ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Anthropic · {status.model}
                  {status.source === "env" ? " (env)" : ""}
                </span>
              ) : (
                <Link
                  href="/admin/ajustes/ia"
                  className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
                >
                  Mock · {status.reason}
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tu copiloto. Usa los mismos tools del MCP server, pero en este admin.
            </p>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            <p>{ctx.workspace.name}</p>
            <p className="font-mono text-[10px]">{ctx.workspace.slug}</p>
          </div>
        </div>
      </header>
      <AgentChat suggestions={SUGGESTIONS} />
    </div>
  );
}
