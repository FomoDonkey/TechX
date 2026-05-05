"use client";

/**
 * Configuración de proveedores AI por workspace.
 *
 * 5 proveedores soportados:
 *  - Anthropic (Claude)
 *  - OpenAI (GPT-4/5)
 *  - xAI / Grok
 *  - OpenRouter (proxy unificado a 200+ modelos)
 *  - Ollama (modelos locales — auto-detección a localhost:11434)
 *
 * Storage: las API keys se guardan en `localStorage` del navegador del editor,
 * NO en BD. Razón: las keys son sensibles y guardarlas server-side requiere
 * encryption-at-rest correcta + admin role checks. Para producción real,
 * configurar las keys en `.env` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
 * `GROQ_API_KEY`, `OPENROUTER_API_KEY`) — esta UI sirve para guardar tus
 * propias keys de desarrollo / testing.
 *
 * El selector de provider activo SÍ se persiste en BD via server action
 * (campo `workspaces.aiProvider`).
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  deleteAiProviderKeyAction,
  listAiProviderConfigsAction,
  saveAiProviderKeyAction,
  setAiProviderAction,
} from "./_actions";
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

type ProviderId = "anthropic" | "openai" | "xai" | "openrouter" | "ollama";

type ProviderConfig = {
  id: ProviderId;
  name: string;
  description: string;
  apiKeyPlaceholder: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  signupUrl: string;
  modelOptions: { id: string; label: string; note?: string }[];
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude Opus, Sonnet, Haiku. La mejor calidad para escritura larga y análisis.",
    apiKeyPlaceholder: "sk-ant-api03-...",
    defaultModel: "claude-opus-4-7",
    signupUrl: "https://console.anthropic.com/",
    modelOptions: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", note: "máxima calidad" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "balance" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "rápido y barato" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    description: "GPT-5, GPT-4o, o3-mini. Bueno para tooling y razonamiento estructurado.",
    apiKeyPlaceholder: "sk-proj-...",
    defaultModel: "gpt-5",
    signupUrl: "https://platform.openai.com/api-keys",
    modelOptions: [
      { id: "gpt-5", label: "GPT-5", note: "frontier" },
      { id: "gpt-4o", label: "GPT-4o", note: "multimodal" },
      { id: "o3-mini", label: "o3-mini", note: "reasoning rápido" },
    ],
  },
  {
    id: "xai",
    name: "xAI Grok",
    description: "Grok-4. Acceso a contexto en tiempo real (X feed).",
    apiKeyPlaceholder: "xai-...",
    defaultModel: "grok-4",
    signupUrl: "https://console.x.ai/",
    modelOptions: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3", label: "Grok 3", note: "más barato" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Proxy unificado a 200+ modelos. Usa una sola key para Claude, GPT, Gemini, Llama…",
    apiKeyPlaceholder: "sk-or-v1-...",
    defaultModel: "anthropic/claude-opus-4-7",
    signupUrl: "https://openrouter.ai/keys",
    modelOptions: [
      { id: "anthropic/claude-opus-4-7", label: "Claude Opus 4.7" },
      { id: "openai/gpt-5", label: "GPT-5" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "meta-llama/llama-4-405b", label: "Llama 4 405B" },
      { id: "deepseek/deepseek-r2", label: "DeepSeek R2" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    description:
      "Modelos locales corriendo en tu máquina. Privacidad total, cero coste, sin internet.",
    apiKeyPlaceholder: "(no requiere API key)",
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://localhost:11434",
    signupUrl: "https://ollama.com/download",
    modelOptions: [{ id: "llama3.2", label: "Llama 3.2" }], // se sobrescribe con detección
  },
];

/**
 * Configs en memoria del cliente — el formulario muestra estos valores y
 * permite editarlos. Las keys reales NO se cargan al cliente: solo un mask
 * `sk-…XXXX` para indicar "ya hay una key guardada". Al editar la key, el
 * cliente envía la nueva al server para encryptar y guardar.
 */
type LocalConfig = {
  hasKey: boolean;
  keyMasked: string;
  /** Lo que el user está editando ahora (puede diferir del masked guardado). */
  apiKeyInput: string;
  /** True si el user ha tocado el input — solo entonces se manda al server. */
  apiKeyTouched: boolean;
  model: string;
  baseUrl: string;
  /** Estado UI por provider */
  saving: boolean;
};

type Props = {
  initialActiveProvider: ProviderId;
};

const EMPTY_CONFIG: LocalConfig = {
  hasKey: false,
  keyMasked: "",
  apiKeyInput: "",
  apiKeyTouched: false,
  model: "",
  baseUrl: "",
  saving: false,
};

export function AiProvidersForm({ initialActiveProvider }: Props) {
  const [active, setActive] = useState<ProviderId>(initialActiveProvider);
  const [configs, setConfigs] = useState<Partial<Record<ProviderId, LocalConfig>>>({});
  const [tab, setTab] = useState<ProviderId>(initialActiveProvider);
  const [savingActive, setSavingActive] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Carga configs guardadas del workspace (desde BD via server action).
  useEffect(() => {
    let cancelled = false;
    listAiProviderConfigsAction().then((res) => {
      if (cancelled || !res.ok) return;
      const next: Partial<Record<ProviderId, LocalConfig>> = {};
      for (const c of res.configs) {
        next[c.provider] = {
          ...EMPTY_CONFIG,
          hasKey: c.hasKey,
          keyMasked: c.keyMasked,
          model: c.model,
          baseUrl: c.baseUrl ?? "",
        };
      }
      setConfigs(next);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function patchConfig(provider: ProviderId, patch: Partial<LocalConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] ?? EMPTY_CONFIG), ...patch },
    }));
  }

  async function saveProvider(provider: ProviderId) {
    const c = configs[provider] ?? EMPTY_CONFIG;
    patchConfig(provider, { saving: true });
    const payload: {
      provider: ProviderId;
      apiKey?: string;
      model?: string;
      baseUrl?: string | null;
    } = { provider, model: c.model };
    if (c.apiKeyTouched) payload.apiKey = c.apiKeyInput;
    if (provider === "ollama") payload.baseUrl = c.baseUrl || null;
    const res = await saveAiProviderKeyAction(payload);
    if (!res.ok) {
      alert(`Error: ${res.error ?? "no se pudo guardar"}`);
      patchConfig(provider, { saving: false });
      return;
    }
    // Re-hidratar este provider con el nuevo estado guardado.
    const reload = await listAiProviderConfigsAction();
    if (reload.ok) {
      const updated = reload.configs.find((rc) => rc.provider === provider);
      if (updated) {
        patchConfig(provider, {
          hasKey: updated.hasKey,
          keyMasked: updated.keyMasked,
          apiKeyInput: "",
          apiKeyTouched: false,
          model: updated.model,
          baseUrl: updated.baseUrl ?? "",
          saving: false,
        });
      } else {
        patchConfig(provider, { saving: false });
      }
    } else {
      patchConfig(provider, { saving: false });
    }
    setSavedHint(`saved-${provider}`);
    window.setTimeout(() => setSavedHint(null), 2000);
  }

  async function deleteProvider(provider: ProviderId) {
    if (!confirm(`¿Borrar la configuración de ${PROVIDERS.find((p) => p.id === provider)?.name}?`))
      return;
    patchConfig(provider, { saving: true });
    const res = await deleteAiProviderKeyAction({ provider });
    if (!res.ok) {
      alert(`Error: ${res.error ?? "no se pudo borrar"}`);
      patchConfig(provider, { saving: false });
      return;
    }
    patchConfig(provider, { ...EMPTY_CONFIG });
  }

  async function handleSetActive(provider: ProviderId) {
    setSavingActive(true);
    const res = await setAiProviderAction({ provider });
    setSavingActive(false);
    if (res.ok) {
      setActive(provider);
      setSavedHint(`active-${provider}`);
      window.setTimeout(() => setSavedHint(null), 2000);
    } else {
      alert(`Error: ${res.error ?? "no se pudo guardar"}`);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Proveedores de IA
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Configura tu provider preferido para Inline AI, Ask CSM, Agente y embeddings.
              Las keys se guardan en tu navegador (localStorage). Para producción usa{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code>.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
            <Sparkles className="size-3" />
            Activo: <strong>{PROVIDERS.find((p) => p.id === active)?.name}</strong>
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b bg-background px-3 py-2">
        {PROVIDERS.map((p) => {
          const cfg = configs[p.id];
          const isConfigured = Boolean(cfg?.hasKey || p.id === "ollama");
          const isActive = tab === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {p.name}
              {p.id === active ? (
                <span className="ml-0.5 size-1.5 rounded-full bg-emerald-500" aria-label="activo" />
              ) : null}
              {isConfigured ? (
                <CheckCircle2
                  className={cn(
                    "size-3",
                    isActive ? "text-primary" : "text-emerald-500/70",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {PROVIDERS.filter((p) => p.id === tab).map((p) => (
          <ProviderTab
            key={p.id}
            provider={p}
            cfg={configs[p.id] ?? EMPTY_CONFIG}
            isActive={p.id === active}
            isSavingActive={savingActive}
            onUpdate={(patch) => patchConfig(p.id, patch)}
            onSave={() => saveProvider(p.id)}
            onDelete={() => deleteProvider(p.id)}
            onSetActive={() => handleSetActive(p.id)}
            justSaved={savedHint === `saved-${p.id}`}
            justActivated={savedHint === `active-${p.id}`}
            hydrated={hydrated}
          />
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Tab content for one provider
// ============================================================
function ProviderTab({
  provider,
  cfg,
  isActive,
  isSavingActive,
  onUpdate,
  onSave,
  onDelete,
  onSetActive,
  justSaved,
  justActivated,
  hydrated,
}: {
  provider: ProviderConfig;
  cfg: LocalConfig;
  isActive: boolean;
  isSavingActive: boolean;
  onUpdate: (patch: Partial<LocalConfig>) => void;
  onSave: () => void;
  onDelete: () => void;
  onSetActive: () => void;
  justSaved: boolean;
  justActivated: boolean;
  hydrated: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const modelValue = cfg.model || provider.defaultModel;
  const placeholder = cfg.hasKey
    ? `Guardada · ${cfg.keyMasked} — escribe para cambiarla`
    : provider.apiKeyPlaceholder;

  return (
    <div className="space-y-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight">{provider.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{provider.description}</p>
      </header>

      {provider.id === "ollama" ? (
        <OllamaSection
          baseUrl={cfg.baseUrl || provider.defaultBaseUrl || ""}
          selectedModel={modelValue}
          onChange={(patch) => {
            onUpdate({
              ...(patch.model !== undefined ? { model: patch.model } : {}),
              ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
            });
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`apikey-${provider.id}`}>API key</Label>
            <div className="relative">
              <Input
                id={`apikey-${provider.id}`}
                type={showKey ? "text" : "password"}
                placeholder={placeholder}
                value={cfg.apiKeyInput}
                onChange={(e) =>
                  onUpdate({ apiKeyInput: e.target.value, apiKeyTouched: true })
                }
                className="pr-10 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showKey ? "Ocultar" : "Mostrar"}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {cfg.hasKey ? (
                <>
                  Guardada y encriptada en BD.{" "}
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-rose-500 hover:underline"
                  >
                    Borrar
                  </button>
                  {" · "}
                </>
              ) : null}
              ¿No tienes una?{" "}
              <a
                href={provider.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Crear cuenta en {provider.name}
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`model-${provider.id}`}>Modelo</Label>
            <select
              id={`model-${provider.id}`}
              value={modelValue}
              onChange={(e) => onUpdate({ model: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {provider.modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} {m.note ? `· ${m.note}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button size="sm" variant="outline" onClick={onSave} disabled={cfg.saving || !hydrated}>
          {cfg.saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {cfg.hasKey || cfg.apiKeyTouched ? "Guardar cambios" : "Guardar"}
        </Button>
        {isActive ? (
          <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-500">
            <CheckCircle2 className="size-3" />
            Proveedor activo
          </Badge>
        ) : (
          <Button size="sm" onClick={onSetActive} disabled={isSavingActive}>
            {isSavingActive ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            Usar este proveedor
          </Button>
        )}
        {justSaved ? (
          <span className="text-[11px] text-emerald-500">✓ Guardado y encriptado en BD</span>
        ) : null}
        {justActivated ? (
          <span className="text-[11px] text-emerald-500">✓ Activo en este workspace</span>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Ollama section — auto-detect models on localhost:11434
// ============================================================
function OllamaSection({
  baseUrl,
  selectedModel,
  onChange,
}: {
  baseUrl: string;
  selectedModel: string;
  onChange: (patch: { model?: string; baseUrl?: string }) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [models, setModels] = useState<string[]>([]);
  const url = baseUrl || "http://localhost:11434";

  async function detect() {
    setStatus("loading");
    setModels([]);
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        setStatus("not-found");
        return;
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const names = (data.models ?? []).map((m) => m.name);
      setModels(names);
      setStatus("found");
      // Si el modelo seleccionado no está en la lista, selecciona el primero
      if (names.length > 0 && !names.includes(selectedModel)) {
        onChange({ model: names[0] });
      }
    } catch {
      setStatus("not-found");
    }
  }

  // Auto-detect al cargar
  useEffect(() => {
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              status === "found" && "bg-emerald-500/15 text-emerald-500",
              status === "not-found" && "bg-amber-500/15 text-amber-500",
              (status === "idle" || status === "loading") && "bg-primary/15 text-primary",
            )}
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : status === "found" ? (
              <CheckCircle2 className="size-4" />
            ) : status === "not-found" ? (
              <XCircle className="size-4" />
            ) : (
              <Bot className="size-4" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {status === "found"
                ? `Ollama detectado · ${models.length} modelo${models.length === 1 ? "" : "s"}`
                : status === "not-found"
                  ? "Ollama no encontrado"
                  : status === "loading"
                    ? "Buscando Ollama…"
                    : "Detector de modelos locales"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {status === "not-found" ? (
                <>
                  Asegúrate de tener{" "}
                  <a
                    href="https://ollama.com/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ollama instalado
                  </a>{" "}
                  y ejecutándose en{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{url}</code>. En la terminal:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">ollama serve</code>.
                </>
              ) : (
                <>
                  Endpoint:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{url}</code>
                </>
              )}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={detect} disabled={status === "loading"}>
            <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} />
            Reescanear
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ollama-baseurl">Endpoint Ollama</Label>
        <Input
          id="ollama-baseurl"
          placeholder="http://localhost:11434"
          value={baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ollama-model">
          Modelo {status === "found" ? `(${models.length} disponibles)` : ""}
        </Label>
        {status === "found" && models.length > 0 ? (
          <select
            id="ollama-model"
            value={selectedModel}
            onChange={(e) => onChange({ model: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="ollama-model"
            placeholder="llama3.2 / qwen2.5:14b / mistral, etc."
            value={selectedModel}
            onChange={(e) => onChange({ model: e.target.value })}
            className="font-mono text-xs"
          />
        )}
        {status === "found" && models.length === 0 ? (
          <p className="text-[11px] text-amber-500">
            Ollama corre pero no tiene modelos descargados. Ejecuta{" "}
            <code className="rounded bg-muted px-1 py-0.5">ollama pull llama3.2</code> en la
            terminal.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const SUPPORTED_PROVIDERS = PROVIDERS.map((p) => p.id);
export type { ProviderId };
