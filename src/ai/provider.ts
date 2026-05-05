/**
 * AI provider adapter universal.
 * Soporta Groq (default), Anthropic, OpenAI, Mistral y Ollama.
 * Auto-detect según envvars; override por workspace via ws.aiProvider.
 *
 * Modelo común:
 *  - chat({ system, messages, temperature?, maxTokens? }) → { text }
 *  - chatStream(args) → AsyncIterable<string> de fragmentos
 *
 * Si no hay claves → mock determinista (mockChat).
 */

import { type AiProviderId, getAiProviderConfig } from "@/ai/keys";
import { env } from "@/env";

export type ChatProvider = "groq" | "anthropic" | "openai" | "mistral" | "ollama" | "mock";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatArgs = {
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Si se especifica, fuerza el provider; si no, auto-detect. */
  provider?: ChatProvider;
  /**
   * Override de credenciales por workspace. Si está, ignora env vars y
   * usa estas — permite que cada workspace use su propia key configurada
   * desde `/admin/ajustes/ia`. Resuelto vía `getAiProviderConfig()`.
   */
  workspaceConfig?: {
    apiKey: string;
    model?: string;
    baseUrl?: string | null;
  };
};

export type ChatResult = { text: string; provider: ChatProvider };

const OPENAI_COMPATIBLE_MODELS: Record<
  Exclude<ChatProvider, "anthropic" | "ollama" | "mock">,
  {
    base: string;
    model: string;
    envKey: keyof typeof env;
  }
> = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
  },
  openai: {
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
  },
  mistral: {
    base: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    envKey: "MISTRAL_API_KEY",
  },
};

export function detectChatProvider(): ChatProvider {
  if (env.GROQ_API_KEY) return "groq";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";
  if (env.MISTRAL_API_KEY) return "mistral";
  return "mock";
}

export const aiFeatures = {
  hasGroq: !!env.GROQ_API_KEY,
  hasAnthropic: !!env.ANTHROPIC_API_KEY,
  hasOpenai: !!env.OPENAI_API_KEY,
  hasMistral: !!env.MISTRAL_API_KEY,
  hasAny: !!(
    env.GROQ_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    env.OPENAI_API_KEY ||
    env.MISTRAL_API_KEY
  ),
};

/**
 * No-streaming chat (acumula y devuelve string).
 * Mantén `temperature` bajo (0.3) para tareas deterministas; alto (0.8) para creatividad.
 */
export async function chat(args: ChatArgs): Promise<ChatResult> {
  const provider = args.provider ?? detectChatProvider();
  if (provider === "mock") {
    return { text: mockChat(args), provider: "mock" };
  }
  const out: string[] = [];
  for await (const piece of chatStream({ ...args, provider })) {
    out.push(piece);
  }
  return { text: out.join(""), provider };
}

/**
 * Streaming chat. Yielda fragmentos de texto a medida que llegan.
 * Cae a mock determinista si no hay clave o falla la red.
 */
export async function* chatStream(args: ChatArgs): AsyncGenerator<string, void, undefined> {
  const provider = args.provider ?? detectChatProvider();
  // Workspace config tiene PRIORIDAD sobre env. Si el user configuró su key
  // en /admin/ajustes/ia, esa se usa; si no, fallback a env.
  const wsKey = args.workspaceConfig?.apiKey;
  const wsModel = args.workspaceConfig?.model;
  const wsBaseUrl = args.workspaceConfig?.baseUrl;

  if (provider === "anthropic") {
    const key = wsKey || env.ANTHROPIC_API_KEY;
    if (key) {
      yield* anthropicStream(args, key, wsModel);
      return;
    }
  }
  if (provider === "ollama") {
    yield* ollamaStream(args, wsBaseUrl ?? undefined, wsModel);
    return;
  }
  if (provider === "groq" || provider === "openai" || provider === "mistral") {
    const cfg = OPENAI_COMPATIBLE_MODELS[provider];
    const key = wsKey || env[cfg.envKey];
    if (typeof key === "string" && key.length > 0) {
      yield* openaiCompatStream(args, cfg.base, wsModel || cfg.model, key);
      return;
    }
  }
  // Fallback determinista
  const mock = mockChat(args);
  // Stream char-a-char para que la UI vea "tipeo" incluso en mock
  for (const ch of chunkString(mock, 8)) yield ch;
}

async function* openaiCompatStream(
  args: ChatArgs,
  base: string,
  model: string,
  apiKey: string,
): AsyncGenerator<string, void, undefined> {
  const body = {
    model,
    stream: true,
    temperature: args.temperature ?? 0.6,
    max_tokens: args.maxTokens ?? 1024,
    messages: [
      ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
      ...args.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    yield mockChat(args);
    return;
  }
  if (!res.ok || !res.body) {
    yield mockChat(args);
    return;
  }
  for await (const line of readSse(res.body)) {
    if (line === "[DONE]") return;
    try {
      const j = JSON.parse(line) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const piece = j.choices?.[0]?.delta?.content;
      if (typeof piece === "string" && piece.length > 0) yield piece;
    } catch {
      // skip malformed
    }
  }
}

async function* anthropicStream(
  args: ChatArgs,
  apiKey: string,
  modelOverride?: string,
): AsyncGenerator<string, void, undefined> {
  const body = {
    model: modelOverride || "claude-haiku-4-5-20251001",
    stream: true,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.6,
    system: args.system,
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    yield mockChat(args);
    return;
  }
  if (!res.ok || !res.body) {
    yield mockChat(args);
    return;
  }
  for await (const line of readSse(res.body)) {
    try {
      const j = JSON.parse(line) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
        if (typeof j.delta.text === "string" && j.delta.text.length > 0) yield j.delta.text;
      }
    } catch {
      // skip
    }
  }
}

async function* ollamaStream(
  args: ChatArgs,
  baseUrlOverride?: string,
  modelOverride?: string,
): AsyncGenerator<string, void, undefined> {
  const url = baseUrlOverride || process.env.OLLAMA_URL || "http://localhost:11434";
  const model = modelOverride || process.env.OLLAMA_MODEL || "llama3.2";
  const body = {
    model,
    stream: true,
    options: { temperature: args.temperature ?? 0.6 },
    messages: [
      ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
      ...args.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };
  let res: Response;
  try {
    res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    yield mockChat(args);
    return;
  }
  if (!res.ok || !res.body) {
    yield mockChat(args);
    return;
  }
  // Ollama envía NDJSON (línea-por-línea)
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (j.message?.content) yield j.message.content;
        if (j.done) return;
      } catch {
        // skip
      }
    }
  }
}

async function* readSse(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const evt of events) {
      // SSE: cada bloque tiene varias líneas; nos interesan las que empiezan por "data:"
      const dataLines = evt
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      for (const d of dataLines) if (d.length > 0) yield d;
    }
  }
}

function chunkString(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/**
 * Mock determinista: devuelve respuestas razonables y consistentes basadas en el prompt.
 * Detecta intent común (continuar/mejorar/acortar/expandir/traducir/excerpt/título/etc).
 */
function mockChat(args: ChatArgs): string {
  const lastUser = [...args.messages].reverse().find((m) => m.role === "user");
  const system = (args.system ?? "").toLowerCase();
  const prompt = (lastUser?.content ?? "").trim();
  const promptLow = prompt.toLowerCase();

  const intent = detectIntent(system, promptLow);
  const seed = simpleHash(`${system}\n${prompt}`);

  const SAMPLE_LANGS: Record<string, string> = {
    en: "English",
    fr: "français",
    de: "Deutsch",
    it: "italiano",
    pt: "português",
    es: "español",
  };

  switch (intent) {
    case "continue":
      return continueText(prompt, seed);
    case "improve":
      return improveText(prompt);
    case "shorten":
      return shortenText(prompt);
    case "expand":
      return expandText(prompt, seed);
    case "translate": {
      const lang = guessLang(system) ?? "en";
      return `[${SAMPLE_LANGS[lang] ?? lang}] ${prompt.slice(0, 280)} —`;
    }
    case "excerpt":
      return `${shortenText(prompt)
        .slice(0, 180)
        .replace(/\s+\S*$/, "")}…`;
    case "title":
      return makeTitle(prompt, seed);
    case "alt":
      return "Imagen ilustrativa que acompaña al contenido principal";
    case "fix":
      return prompt
        .replace(/\bporque?\b/gi, "porque")
        .replace(/\bhabia\b/gi, "había")
        .replace(/\b\s+,/g, ",");
    case "outline":
      return makeOutline(prompt);
    case "json": {
      // Para tareas que esperan JSON estructurado, devolvemos shape mínimo válido.
      if (system.includes("estructur") || system.includes("structure"))
        return JSON.stringify(structureFallback(prompt));
      if (system.includes("link")) return JSON.stringify({ suggestions: [] });
      if (system.includes("modera") || system.includes("spam"))
        return JSON.stringify({ score: 10, reason: "ok" });
      return JSON.stringify({ ok: true });
    }
    default:
      return makeReply(prompt, seed);
  }
}

function detectIntent(system: string, prompt: string): string {
  const s = `${system} ${prompt}`;
  if (/json/i.test(system)) return "json";
  if (/contin/i.test(s)) return "continue";
  if (/mejora|improve|reescr/i.test(s)) return "improve";
  if (/acort|shorten|conciso|compact/i.test(s)) return "shorten";
  if (/expand|amplía|amplia|extend/i.test(s)) return "expand";
  if (/traduc|translate/i.test(s)) return "translate";
  if (/excerpt|resumen|sinopsis/i.test(s)) return "excerpt";
  if (/título|titulo|title/i.test(s)) return "title";
  if (/alt[\s-]?text|texto alternativo/i.test(s)) return "alt";
  if (/gramática|gramatica|fix|ortograf/i.test(s)) return "fix";
  if (/esquema|outline|índice|indice/i.test(s)) return "outline";
  return "default";
}

function continueText(prompt: string, seed: number): string {
  const last =
    prompt
      .split(/[.!?\n]/)
      .filter(Boolean)
      .slice(-1)[0]
      ?.trim() ?? "";
  const ideas = [
    "Esta idea conecta con un patrón más amplio que ya hemos visto en otros contextos.",
    "Lo importante aquí es entender el porqué antes que el cómo.",
    "Hay tres factores que conviene tener en cuenta para evaluar esto.",
    "Vale la pena detenerse un momento y mirar el efecto a largo plazo.",
    "El siguiente paso natural es preguntarse cuál es el coste real.",
  ];
  return ` ${ideas[seed % ideas.length]} ${last ? `Volviendo a "${last.slice(0, 40)}",` : ""} podemos ir más allá.`;
}

function improveText(prompt: string): string {
  return prompt
    .replace(/\b(muy|super|bastante)\s+/gi, "")
    .replace(/\bcosa\b/gi, "elemento")
    .replace(/\bhacer\b/gi, "construir")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenText(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, Math.max(1, Math.floor(sentences.length / 2))).join(" ");
}

function expandText(prompt: string, seed: number): string {
  const fillers = [
    "Esto sucede porque varios factores convergen al mismo tiempo.",
    "Conviene contextualizar la idea con un ejemplo concreto.",
    "Existe una conexión directa con conceptos que veremos a continuación.",
  ];
  return `${prompt} ${fillers[seed % fillers.length]}`;
}

function makeTitle(prompt: string, seed: number): string {
  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
  const hooks = [
    "Cómo",
    "Por qué",
    "La guía completa de",
    "5 claves de",
    "Lo que nadie te dice de",
  ];
  const hook = hooks[seed % hooks.length];
  const subject = tokens.join(" ") || "este tema";
  return `${hook} ${subject}`.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);
}

function makeOutline(prompt: string): string {
  return [
    "1. Contexto y motivación",
    "2. Los conceptos clave",
    "3. Cómo aplicarlo paso a paso",
    "4. Errores comunes a evitar",
    "5. Conclusión y siguientes pasos",
  ].join("\n");
}

function makeReply(prompt: string, seed: number): string {
  const replies = [
    "Aquí tienes una respuesta concisa basada en lo que me cuentas.",
    "He analizado tu petición y este es el resultado más útil.",
    "Esta es una propuesta inicial que puedes pulir desde el editor.",
  ];
  return `${replies[seed % replies.length]} ${prompt.slice(0, 160)}`;
}

function structureFallback(transcript: string): {
  title: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
} {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const chunks: string[][] = [[]];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    if (last && last.length >= 3) chunks.push([s]);
    else last?.push(s);
  }
  const sections = chunks.map((sents, i) => ({
    heading: i === 0 ? "Introducción" : `Sección ${i + 1}`,
    paragraphs: [sents.join(" ")],
  }));
  const title = (sentences[0] ?? "Notas dictadas").slice(0, 80);
  return { title, sections };
}

function guessLang(s: string): string | null {
  const m = /\b(en|es|fr|de|it|pt)\b/i.exec(s);
  return m?.[1]?.toLowerCase() ?? null;
}

function simpleHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ============================================================
// Workspace-aware helpers
// ============================================================
const WS_TO_CHAT_PROVIDER: Record<AiProviderId, ChatProvider> = {
  anthropic: "anthropic",
  openai: "openai",
  xai: "openai", // xAI/Grok usa API compatible OpenAI
  openrouter: "openai", // OpenRouter usa API compatible OpenAI
  ollama: "ollama",
};

/**
 * Carga la config AI del workspace activo (provider + key encriptada en BD)
 * y la convierte en `{ provider, workspaceConfig }` para pasar a `chat()`.
 *
 * Devuelve null si el workspace no tiene config (caller usa env fallback).
 *
 * Uso:
 *   const cfg = await resolveWorkspaceAiConfig(workspaceId, workspace.aiProvider);
 *   const result = await chat({ ...args, ...cfg });
 */
export async function resolveWorkspaceAiConfig(
  workspaceId: string,
  preferredProvider: string | null | undefined,
): Promise<Pick<ChatArgs, "provider" | "workspaceConfig"> | null> {
  if (!preferredProvider) return null;
  const provider = preferredProvider as AiProviderId;
  if (!(provider in WS_TO_CHAT_PROVIDER)) return null;
  const config = await getAiProviderConfig(workspaceId, provider);
  if (!config) return null;
  // Si está deshabilitado, ignoramos.
  if (!config.enabled) return null;
  // Para providers que requieren key (no-ollama), si no hay key, devolver null
  // → el caller cae a env vars o mock.
  if (provider !== "ollama" && !config.apiKey) return null;
  return {
    provider: WS_TO_CHAT_PROVIDER[provider],
    workspaceConfig: {
      apiKey: config.apiKey,
      model: config.model || undefined,
      baseUrl: config.baseUrl,
    },
  };
}
