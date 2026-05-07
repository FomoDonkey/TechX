import { getAiProviderConfig } from "@/ai/keys";
import { type ChatProvider, chat } from "@/ai/provider";
import { db } from "@/db/client";
import { entries, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { POSTS_SLUG, createEntry, getOrCreateBuiltinCollection } from "@/lib/entries";
import { markdownToTiptapDoc } from "@/mcp/tools";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Blueprint, BlueprintSchema, type PostPlan, extractJsonObject } from "./blueprint";

/**
 * Lovable Mode pipeline: prompt natural → blueprint → materialización.
 *
 * Provider-agnostic: usa `src/ai/provider.ts#chat()` que ya tiene 5 backends
 * (anthropic, openai, xai-via-openrouter, ollama, mock). Nada provider-specific
 * aquí.
 *
 * El modelo se invoca dos veces por sitio:
 *  1. Plan call: 1 llamada → blueprint JSON estructurado.
 *  2. Materialize: N llamadas paralelas → markdown completo de cada post.
 *
 * El stream emite eventos discretos al cliente (SSE / NDJSON-friendly) para que
 * la UI pinte progreso en vivo.
 */

export type BuilderEvent =
  | {
      type: "step";
      id: string;
      status: "running" | "done" | "error";
      label: string;
      details?: unknown;
    }
  | { type: "preview-refresh"; path?: string }
  | { type: "blueprint"; blueprint: Blueprint }
  | { type: "chat-reply"; text: string }
  | { type: "done"; summary: { brand: string; postsCreated: number; ms: number } }
  | { type: "error"; message: string };

const PLAN_SYSTEM = `Eres el cerebro creativo de un constructor de sitios espectacular.
Tu tarea: dado el prompt de un usuario que describe el sitio que quiere, producir un blueprint JSON ESTRICTO.

REGLAS:
1. Devuelve SOLO el objeto JSON. NADA de prosa, NADA de fences markdown.
2. Idioma de los textos: el mismo del prompt del usuario (default español).
3. Paleta: 5 colores en formato OKLCH "oklch(L C H)" donde L 0.0-1.0, C 0.0-0.4, H 0-360. Diseño dark elegante: background oklch(0.13 ±0.02 H), foreground oklch(0.97 ±0.01 H). Primary y accent vibrantes (C ~0.18-0.25), success contrastante. Coherente con la temática (cocina vegana → verdes; tecnología → azul/cian; moda → rosa/morado…).
4. Genera 3 a 5 posts. Cada post con title evocador, excerpt de 1-2 frases, una category corta, y un "angle" que es la idea central que se desarrollará en la fase de generación de cuerpo.
5. Voice: tono editorial en una frase (ej: "cercano, divulgativo, con humor sutil").

ESQUEMA EXACTO:
{
  "brand": {
    "name": "string",
    "tagline": "string",
    "emoji": "string (1 emoji)",
    "voice": "string",
    "palette": {
      "primary": "oklch(...)",
      "accent": "oklch(...)",
      "success": "oklch(...)",
      "background": "oklch(...)",
      "foreground": "oklch(...)"
    },
    "font": "geist" | "lora" | "jetbrains"
  },
  "posts": [
    { "title": "string", "excerpt": "string", "category": "string", "angle": "string" }
  ]
}

Devuelve únicamente el JSON. Sin texto adicional.`;

const POST_SYSTEM = (
  brand: Blueprint["brand"],
): string => `Eres redactor editorial del proyecto "${brand.name}".
Voice: ${brand.voice}.
Tagline: ${brand.tagline}.

Tu tarea: escribir un post de blog completo en Markdown a partir del título y "angle" que recibirás.

REGLAS:
1. Salida: SOLO Markdown. Sin frontmatter, sin prosa fuera del post.
2. Estructura: introducción enganchadora (sin H1, el título ya está fuera), 3-5 secciones con ## H2, bullet lists o numbered lists donde aporten, párrafos cortos y rítmicos.
3. Longitud: 350-700 palabras.
4. Tono: el del voice. Específico, con datos o ejemplos concretos. Nada genérico.
5. NO uses emojis salvo que el contexto los pida. NO inventes URLs externas. NO incluyas "Conclusión:" ni "Introducción:" como literales — escríbelo natural.

Devuelve únicamente el Markdown del cuerpo.`;

export type RunBuilderArgs = {
  prompt: string;
  workspaceId: string;
  userId: string;
  /** Si está, override del provider; si no, usa el del workspace. */
  forceProvider?: ChatProvider;
  signal?: AbortSignal;
};

export async function* runBuilder(
  args: RunBuilderArgs,
): AsyncGenerator<BuilderEvent, void, undefined> {
  const t0 = Date.now();

  // ───────── Resolve workspace AI config (mismo patrón que /admin/agente) ─────────
  yield { type: "step", id: "plan", status: "running", label: "Analizando tu idea…" };

  const { provider, workspaceConfig } = await resolveBuilderProvider(
    args.workspaceId,
    args.forceProvider,
  );

  // ───────── Fase 1: Plan ─────────
  let blueprint: Blueprint;
  try {
    const planRaw = await chat({
      provider,
      workspaceConfig,
      system: PLAN_SYSTEM,
      messages: [{ role: "user", content: args.prompt }],
      temperature: 0.7,
      maxTokens: 1400,
    });
    const json = extractJsonObject(planRaw.text);
    blueprint = BlueprintSchema.parse(json);
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? `Blueprint inválido: ${e.issues
            .map((i) => i.path.join("."))
            .slice(0, 3)
            .join(", ")}`
        : e instanceof Error
          ? e.message
          : "plan_failed";
    yield { type: "step", id: "plan", status: "error", label: "Plan falló", details: msg };
    yield { type: "error", message: msg };
    return;
  }

  yield {
    type: "step",
    id: "plan",
    status: "done",
    label: `Plan listo · ${blueprint.brand.name}`,
    details: { brandName: blueprint.brand.name, postCount: blueprint.posts.length },
  };
  yield { type: "blueprint", blueprint };

  // ───────── Fase 2: Aplicar brand al workspace ─────────
  yield { type: "step", id: "brand", status: "running", label: "Aplicando paleta y branding…" };
  try {
    await applyBrand({
      workspaceId: args.workspaceId,
      userId: args.userId,
      brand: blueprint.brand,
    });
    yield {
      type: "step",
      id: "brand",
      status: "done",
      label: `Branding aplicado · ${blueprint.brand.tagline}`,
    };
    yield { type: "preview-refresh" };
  } catch (e) {
    yield {
      type: "step",
      id: "brand",
      status: "error",
      label: "Branding falló",
      details: e instanceof Error ? e.message : "brand_failed",
    };
  }

  // ───────── Fase 3: Generar y crear cada post (paralelo) ─────────
  let postsCreated = 0;
  const collection = await getOrCreateBuiltinCollection(args.workspaceId, POSTS_SLUG);

  const postTasks = blueprint.posts.map((post, idx) =>
    materializePost({
      idx,
      post,
      brand: blueprint.brand,
      workspaceId: args.workspaceId,
      userId: args.userId,
      collectionId: collection.id,
      provider,
      workspaceConfig,
      signal: args.signal,
    }),
  );

  // Anuncia los posts en running
  for (let i = 0; i < blueprint.posts.length; i++) {
    yield {
      type: "step",
      id: `post-${i}`,
      status: "running",
      label: `Escribiendo: ${blueprint.posts[i]?.title ?? ""}`,
    };
  }

  // Procesa en orden de finalización
  const results = await Promise.allSettled(postTasks);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const planEntry = blueprint.posts[i];
    if (r?.status === "fulfilled" && planEntry) {
      postsCreated++;
      yield {
        type: "step",
        id: `post-${i}`,
        status: "done",
        label: `Publicado: ${planEntry.title}`,
        details: { entryId: r.value.entryId, slug: r.value.slug },
      };
    } else if (r?.status === "rejected" && planEntry) {
      yield {
        type: "step",
        id: `post-${i}`,
        status: "error",
        label: `Fallo en: ${planEntry.title}`,
        details: r.reason instanceof Error ? r.reason.message : "post_failed",
      };
    }
  }

  yield { type: "preview-refresh" };

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.userId,
    action: "builder.run",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: {
      prompt: args.prompt.slice(0, 200),
      brand: blueprint.brand.name,
      postsCreated,
      provider,
    },
  });

  yield {
    type: "done",
    summary: {
      brand: blueprint.brand.name,
      postsCreated,
      ms: Date.now() - t0,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resuelve el provider activo + workspace config (apiKey, model, baseUrl) en
 * una sola llamada. Lo exponemos para que `refine.ts` y otros consumidores
 * usen la misma lógica.
 */
export async function resolveBuilderProvider(
  workspaceId: string,
  forced?: ChatProvider,
): Promise<{
  provider: ChatProvider;
  workspaceConfig:
    | { apiKey: string; model: string | undefined; baseUrl: string | null }
    | undefined;
}> {
  const provider = await resolveProvider(workspaceId, forced);
  let workspaceConfig:
    | { apiKey: string; model: string | undefined; baseUrl: string | null }
    | undefined;
  if (provider !== "mock" && provider !== "groq") {
    const cfg = await getAiProviderConfig(workspaceId, providerToConfigKey(provider));
    if (cfg?.enabled && (cfg.apiKey || provider === "ollama")) {
      workspaceConfig = {
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        baseUrl: cfg.baseUrl,
      };
    }
  }
  return { provider, workspaceConfig };
}

async function resolveProvider(workspaceId: string, forced?: ChatProvider): Promise<ChatProvider> {
  if (forced) return forced;
  if (!db) return "mock";
  const ws = await db
    .select({ aiProvider: workspaces.aiProvider })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const active = ws[0]?.aiProvider;
  if (active === "anthropic" || active === "openai" || active === "ollama" || active === "groq") {
    return active;
  }
  // openrouter / xai → openai-compatible — falta en provider.ts adapter, lo
  // tratamos como mock por ahora si llega ese valor, futuro F10g B2.
  return "mock";
}

function providerToConfigKey(
  p: ChatProvider,
): "anthropic" | "openai" | "ollama" | "openrouter" | "xai" {
  if (p === "anthropic") return "anthropic";
  if (p === "openai") return "openai";
  if (p === "ollama") return "ollama";
  return "openai"; // fallback razonable; resolveProvider ya filtra valores no soportados
}

async function applyBrand(args: {
  workspaceId: string;
  userId: string;
  brand: Blueprint["brand"];
}): Promise<void> {
  if (!db) throw new Error("DB not configured");
  const branding = {
    logo: args.brand.emoji,
    colors: { primary: args.brand.palette.primary, accent: args.brand.palette.accent },
    font: args.brand.font,
    voice: args.brand.voice,
  } as const;
  await db
    .update(workspaces)
    .set({
      branding,
      name: args.brand.name,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, args.workspaceId));

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.userId,
    action: "workspace.brand_set",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { source: "builder", brand: args.brand.name },
  });
}

async function materializePost(args: {
  idx: number;
  post: PostPlan;
  brand: Blueprint["brand"];
  workspaceId: string;
  userId: string;
  collectionId: string;
  provider: ChatProvider;
  workspaceConfig:
    | { apiKey: string; model: string | undefined; baseUrl: string | null }
    | undefined;
  signal?: AbortSignal;
}): Promise<{ entryId: string; slug: string }> {
  // 1. Genera el cuerpo en markdown vía LLM
  const userMsg = `Título: ${args.post.title}\nExcerpt: ${args.post.excerpt}\nÁngulo / idea central: ${args.post.angle}\nCategoría: ${args.post.category}`;
  const result = await chat({
    provider: args.provider,
    workspaceConfig: args.workspaceConfig,
    system: POST_SYSTEM(args.brand),
    messages: [{ role: "user", content: userMsg }],
    temperature: 0.75,
    maxTokens: 1500,
  });
  const md = result.text.trim();
  const tiptapDoc = markdownToTiptapDoc(md);
  const bodyText = stripMarkdown(md).slice(0, 8000);

  // 2. Crea el entry
  const entry = await createEntry({
    workspaceId: args.workspaceId,
    collectionId: args.collectionId,
    authorId: args.userId,
    title: args.post.title,
    locale: "es",
  });

  // 3. Update con cuerpo + excerpt + publish
  if (!db) throw new Error("DB not configured");
  await db
    .update(entries)
    .set({
      body: tiptapDoc as unknown as Record<string, unknown>,
      bodyText,
      excerpt: args.post.excerpt,
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      updatedById: args.userId,
    })
    .where(and(eq(entries.id, entry.id), eq(entries.workspaceId, args.workspaceId)));

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.userId,
    action: "entry.published",
    targetType: "entry",
    targetId: entry.id,
    meta: { source: "builder", title: args.post.title },
  });

  return { entryId: entry.id, slug: entry.slug };
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
