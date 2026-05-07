import { getAiProviderConfig } from "@/ai/keys";
import { aiFeatures } from "@/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { BuilderClient } from "./client";

export const metadata: Metadata = {
  title: "Builder · techx",
  description: "Construye tu sitio entero con un prompt. Como Lovable, pero para CMS.",
};
export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Blog de cocina vegana con suscripción mensual",
  "Portfolio de fotógrafa de bodas con galería editorial",
  "Documentación técnica de mi librería open-source",
  "Newsletter sobre IA generativa con tono cercano",
  "Revista digital de música independiente con reseñas",
];

type ResolvedProvider =
  | { kind: "anthropic"; source: "workspace" | "env"; model: string }
  | { kind: "ollama"; baseUrl: string; model: string }
  | { kind: "openai"; source: "workspace" | "env"; model: string }
  | { kind: "groq"; source: "env" }
  | { kind: "none" };

async function resolveProvider(workspaceId: string, active: string): Promise<ResolvedProvider> {
  if (active === "ollama") {
    const cfg = await getAiProviderConfig(workspaceId, "ollama");
    return {
      kind: "ollama",
      baseUrl: cfg?.baseUrl || "http://localhost:11434",
      model: cfg?.model || "llama3.2",
    };
  }
  if (active === "openai") {
    const cfg = await getAiProviderConfig(workspaceId, "openai");
    if (cfg?.enabled && cfg.apiKey) {
      return { kind: "openai", source: "workspace", model: cfg.model || "gpt-4o-mini" };
    }
    if (aiFeatures.hasOpenai) return { kind: "openai", source: "env", model: "gpt-4o-mini" };
  }
  // Default: Anthropic
  const cfg = await getAiProviderConfig(workspaceId, "anthropic");
  if (cfg?.enabled && cfg.apiKey) {
    return { kind: "anthropic", source: "workspace", model: cfg.model || "claude-haiku-4-5" };
  }
  if (aiFeatures.hasAnthropic) {
    return { kind: "anthropic", source: "env", model: "claude-haiku-4-5" };
  }
  if (aiFeatures.hasGroq) return { kind: "groq", source: "env" };
  return { kind: "none" };
}

export default async function BuilderPage() {
  const ctx = await requireWorkspace("editor");
  const active = ctx.workspace.aiProvider ?? "anthropic";
  const provider = await resolveProvider(ctx.workspace.id, active);

  return (
    <BuilderClient
      suggestions={SUGGESTIONS}
      provider={provider}
      workspaceName={ctx.workspace.name}
      workspaceSlug={ctx.workspace.slug}
    />
  );
}
