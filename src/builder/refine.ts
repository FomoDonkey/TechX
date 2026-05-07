import { type ChatProvider, chat } from "@/ai/provider";
import { db } from "@/db/client";
import { collections, entries, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { POSTS_SLUG, createEntry } from "@/lib/entries";
import { markdownToTiptapDoc } from "@/mcp/tools";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Brand } from "./blueprint";
import { extractJsonObject } from "./blueprint";

/**
 * Modo Refinamiento — el chat del Builder sigue vivo después del primer build.
 *
 * Diseño: en lugar de un agent loop tool-use (caro, provider-specific), usamos
 * un **intent classifier** de 1 sola llamada LLM. La salida es un JSON con la
 * intención + parámetros. Luego un pipeline determinista aplica el cambio.
 *
 * Beneficios:
 *  - 1 llamada LLM para clasificar (rápido, barato).
 *  - N llamadas opcionales para generar contenido (sólo si la intent lo necesita).
 *  - Funciona en TODOS los providers (no exige tool-use).
 *  - Cada intent es código auditable, no ruleta del modelo.
 */

import type { BuilderEvent } from "./lovable";

// ─────────────────────────────────────────────────────────────
// Intent schema
// ─────────────────────────────────────────────────────────────

const AddPostsIntent = z.object({
  kind: z.literal("add_posts"),
  count: z.number().int().min(1).max(5),
  topics: z.array(z.string().min(3).max(140)).min(1).max(5),
});

const EditBrandIntent = z.object({
  kind: z.literal("edit_brand"),
  changes: z
    .object({
      name: z.string().min(2).max(80).optional(),
      tagline: z.string().min(2).max(140).optional(),
      voice: z.string().min(2).max(160).optional(),
      emoji: z.string().min(1).max(4).optional(),
      palette: z
        .object({
          primary: z
            .string()
            .regex(/^oklch\(/i)
            .optional(),
          accent: z
            .string()
            .regex(/^oklch\(/i)
            .optional(),
          success: z
            .string()
            .regex(/^oklch\(/i)
            .optional(),
          background: z
            .string()
            .regex(/^oklch\(/i)
            .optional(),
          foreground: z
            .string()
            .regex(/^oklch\(/i)
            .optional(),
        })
        .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "changes empty" }),
});

const RegeneratePostIntent = z.object({
  kind: z.literal("regenerate_post"),
  /** Resolución por título exacto o sustring. La resolvemos con fuzzy match. */
  match: z.string().min(2).max(120),
  newAngle: z.string().min(8).max(280),
});

const DeletePostIntent = z.object({
  kind: z.literal("delete_post"),
  match: z.string().min(2).max(120),
});

const ChatIntent = z.object({
  kind: z.literal("chat"),
  reply: z.string().min(2).max(500),
});

const IntentSchema = z.union([
  AddPostsIntent,
  EditBrandIntent,
  RegeneratePostIntent,
  DeletePostIntent,
  ChatIntent,
]);

type Intent = z.infer<typeof IntentSchema>;

// ─────────────────────────────────────────────────────────────
// Snapshot del estado del workspace que pasamos al modelo
// ─────────────────────────────────────────────────────────────

export type BuilderState = {
  brand: {
    name: string;
    tagline?: string;
    voice?: string;
    emoji?: string;
    palette?: Brand["palette"];
  };
  posts: Array<{ id: string; title: string; status: string; excerpt: string | null }>;
};

export async function loadBuilderState(workspaceId: string): Promise<BuilderState> {
  if (!db) {
    return { brand: { name: "Workspace" }, posts: [] };
  }
  const [ws] = await db
    .select({ name: workspaces.name, branding: workspaces.branding })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // Posts más recientes (últimos 20, branchId NULL = main)
  const collection = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.slug, POSTS_SLUG)))
    .limit(1);

  const collectionId = collection[0]?.id;
  const posts = collectionId
    ? await db
        .select({
          id: entries.id,
          title: entries.title,
          status: entries.status,
          excerpt: entries.excerpt,
        })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceId, workspaceId),
            eq(entries.collectionId, collectionId),
            isNull(entries.branchId),
          ),
        )
        .orderBy(desc(entries.updatedAt))
        .limit(20)
    : [];

  const branding = (ws?.branding ?? {}) as {
    voice?: string;
    logo?: string;
    colors?: { primary?: string; accent?: string };
  };

  return {
    brand: {
      name: ws?.name ?? "Workspace",
      voice: branding.voice,
      emoji: branding.logo,
      palette: branding.colors
        ? {
            primary: branding.colors.primary ?? "",
            accent: branding.colors.accent ?? "",
            success: "",
            background: "",
            foreground: "",
          }
        : undefined,
    },
    posts: posts.map((p) => ({ id: p.id, title: p.title, status: p.status, excerpt: p.excerpt })),
  };
}

// ─────────────────────────────────────────────────────────────
// Classifier prompt
// ─────────────────────────────────────────────────────────────

function classifierSystem(state: BuilderState): string {
  const postList = state.posts
    .slice(0, 12)
    .map((p, i) => `${i + 1}. "${p.title}" [${p.status}]`)
    .join("\n");

  return `Eres el clasificador de intents del Builder de CSM. El usuario está refinando un sitio ya creado y te dice qué quiere cambiar.

ESTADO ACTUAL:
- Marca: "${state.brand.name}"${state.brand.voice ? ` · voz: "${state.brand.voice}"` : ""}
- Posts actuales (${state.posts.length}):
${postList || "  (ninguno)"}

Tu tarea: clasificar el mensaje en UNA de estas intents y devolver SOLO el JSON correspondiente:

1. **add_posts** — el usuario quiere añadir nuevos posts.
   {"kind":"add_posts","count":<1-5>,"topics":["título o tema 1","tema 2"...]}
   Cada topic será expandido en un post completo. Si no especifica cuántos, infiere de "uno" / "tres" / "varios" (default 2).

2. **edit_brand** — cambiar nombre, tagline, voz, emoji o paleta.
   {"kind":"edit_brand","changes":{"tagline":"...","palette":{"primary":"oklch(...)","accent":"oklch(...)"}}}
   Sólo incluye los campos que cambian. Si pide "más cálida" la paleta → ajusta H hacia 30-60 (naranja-amarillo). "Más fría" → 200-260 (azul-violeta).

3. **regenerate_post** — reescribir un post existente.
   {"kind":"regenerate_post","match":"<sustring del título>","newAngle":"qué cambia"}

4. **delete_post** — borrar un post.
   {"kind":"delete_post","match":"<sustring del título>"}

5. **chat** — el usuario sólo charla, pregunta o pide aclaración. NO mutar nada.
   {"kind":"chat","reply":"respuesta corta en español"}

REGLAS:
- Devuelve SOLO el JSON, sin prosa, sin fences markdown.
- Si dudas entre add_posts y chat, prefiere chat.
- Para colores, usa formato OKLCH "oklch(L C H)".`;
}

// ─────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────

export type RefineArgs = {
  prompt: string;
  workspaceId: string;
  userId: string;
  provider: ChatProvider;
  workspaceConfig:
    | { apiKey: string; model: string | undefined; baseUrl: string | null }
    | undefined;
  signal?: AbortSignal;
};

export async function* runRefinement(
  args: RefineArgs,
): AsyncGenerator<BuilderEvent, void, undefined> {
  const t0 = Date.now();

  // 1. Carga state + clasifica
  yield { type: "step", id: "classify", status: "running", label: "Entendiendo tu petición…" };
  const state = await loadBuilderState(args.workspaceId);

  let intent: Intent;
  try {
    const raw = await chat({
      provider: args.provider,
      workspaceConfig: args.workspaceConfig,
      system: classifierSystem(state),
      messages: [{ role: "user", content: args.prompt }],
      temperature: 0.3,
      maxTokens: 600,
    });
    const json = extractJsonObject(raw.text);
    intent = IntentSchema.parse(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "classify_failed";
    yield {
      type: "step",
      id: "classify",
      status: "error",
      label: "No entendí del todo",
      details: msg,
    };
    yield { type: "error", message: msg };
    return;
  }

  yield {
    type: "step",
    id: "classify",
    status: "done",
    label: intentLabel(intent),
    details: { kind: intent.kind },
  };

  // 2. Despacha por intent
  switch (intent.kind) {
    case "chat":
      yield { type: "chat-reply", text: intent.reply };
      yield {
        type: "done",
        summary: { brand: state.brand.name, postsCreated: 0, ms: Date.now() - t0 },
      };
      return;

    case "edit_brand":
      yield* applyBrandEdits(args, intent, state);
      break;

    case "add_posts":
      yield* addPosts(args, intent, state);
      break;

    case "regenerate_post":
      yield* regeneratePost(args, intent, state);
      break;

    case "delete_post":
      yield* deletePost(args, intent, state);
      break;
  }

  yield { type: "preview-refresh" };
  yield {
    type: "done",
    summary: {
      brand: state.brand.name,
      postsCreated: 0,
      ms: Date.now() - t0,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Intent handlers
// ─────────────────────────────────────────────────────────────

async function* applyBrandEdits(
  args: RefineArgs,
  intent: z.infer<typeof EditBrandIntent>,
  state: BuilderState,
): AsyncGenerator<BuilderEvent, void, undefined> {
  yield { type: "step", id: "brand", status: "running", label: "Aplicando cambios de marca…" };
  if (!db) {
    yield { type: "step", id: "brand", status: "error", label: "DB no configurada" };
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (intent.changes.name) updates.name = intent.changes.name;

  const branding = await loadCurrentBranding(args.workspaceId);
  const newBranding = { ...branding };
  if (intent.changes.voice) newBranding.voice = intent.changes.voice;
  if (intent.changes.emoji) newBranding.logo = intent.changes.emoji;
  if (intent.changes.palette) {
    newBranding.colors = {
      ...(newBranding.colors ?? {}),
      ...(intent.changes.palette.primary ? { primary: intent.changes.palette.primary } : {}),
      ...(intent.changes.palette.accent ? { accent: intent.changes.palette.accent } : {}),
    };
  }
  if (intent.changes.tagline) {
    // tagline no es campo top-level — lo guardamos en branding.voice si no hay voice nuevo,
    // o en una clave aux. Para simplicidad MVP lo mostramos en logs y lo persistimos como
    // parte del voice si falta uno.
    if (!newBranding.voice) newBranding.voice = intent.changes.tagline;
  }
  updates.branding = newBranding;

  await db.update(workspaces).set(updates).where(eq(workspaces.id, args.workspaceId));

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.userId,
    action: "workspace.brand_edit",
    targetType: "workspace",
    targetId: args.workspaceId,
    meta: { source: "builder.refine", changes: intent.changes },
  });

  yield {
    type: "step",
    id: "brand",
    status: "done",
    label: brandChangeLabel(intent.changes),
  };
  yield { type: "preview-refresh" };
  // No emitimos done aquí — el caller lo hace.
}

async function* addPosts(
  args: RefineArgs,
  intent: z.infer<typeof AddPostsIntent>,
  state: BuilderState,
): AsyncGenerator<BuilderEvent, void, undefined> {
  if (!db) {
    yield { type: "step", id: "add", status: "error", label: "DB no configurada" };
    return;
  }

  // Resolve collection
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.workspaceId, args.workspaceId), eq(collections.slug, POSTS_SLUG)))
    .limit(1);
  if (!collection) {
    yield { type: "step", id: "add", status: "error", label: "Colección posts no existe" };
    return;
  }

  for (let i = 0; i < intent.topics.length; i++) {
    const topic = intent.topics[i] ?? "";
    const stepId = `add-${Date.now()}-${i}`;
    yield { type: "step", id: stepId, status: "running", label: `Escribiendo: ${topic}` };

    try {
      // Genera title + body en una llamada
      const composeSystem = `Eres redactor editorial de "${state.brand.name}".
${state.brand.voice ? `Voz: ${state.brand.voice}.\n` : ""}
Tu tarea: dado el tema/título recibido, devolver JSON con un post completo:
{"title":"<título evocador>","excerpt":"<resumen 1-2 frases>","body":"<markdown 350-700 palabras con ## H2 y bullets donde aporten>"}

Devuelve SOLO el JSON. Sin fences markdown.`;
      const raw = await chat({
        provider: args.provider,
        workspaceConfig: args.workspaceConfig,
        system: composeSystem,
        messages: [{ role: "user", content: topic }],
        temperature: 0.7,
        maxTokens: 1500,
      });

      const json = extractJsonObject(raw.text) as {
        title?: unknown;
        excerpt?: unknown;
        body?: unknown;
      };
      const title = typeof json.title === "string" ? json.title : topic;
      const excerpt = typeof json.excerpt === "string" ? json.excerpt : "";
      const body = typeof json.body === "string" ? json.body : "";

      const tiptapDoc = markdownToTiptapDoc(body);
      const entry = await createEntry({
        workspaceId: args.workspaceId,
        collectionId: collection.id,
        authorId: args.userId,
        title,
        locale: "es",
      });

      await db
        .update(entries)
        .set({
          body: tiptapDoc as unknown as Record<string, unknown>,
          bodyText: body.replace(/[#*_`>]/g, "").slice(0, 8000),
          excerpt,
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
        meta: { source: "builder.refine", title },
      });

      yield {
        type: "step",
        id: stepId,
        status: "done",
        label: `Publicado: ${title}`,
        details: { entryId: entry.id, slug: entry.slug },
      };
    } catch (e) {
      yield {
        type: "step",
        id: stepId,
        status: "error",
        label: `Fallo en: ${topic}`,
        details: e instanceof Error ? e.message : "post_failed",
      };
    }
  }
}

async function* regeneratePost(
  args: RefineArgs,
  intent: z.infer<typeof RegeneratePostIntent>,
  state: BuilderState,
): AsyncGenerator<BuilderEvent, void, undefined> {
  if (!db) {
    yield { type: "step", id: "regen", status: "error", label: "DB no configurada" };
    return;
  }
  const found = fuzzyFindPost(state.posts, intent.match);
  if (!found) {
    yield {
      type: "step",
      id: "regen",
      status: "error",
      label: `No encontré ningún post que coincida con "${intent.match}"`,
    };
    return;
  }
  yield {
    type: "step",
    id: "regen",
    status: "running",
    label: `Reescribiendo: ${found.title}`,
  };

  try {
    const composeSystem = `Eres redactor editorial de "${state.brand.name}".
${state.brand.voice ? `Voz: ${state.brand.voice}.\n` : ""}
Reescribe el post desde cero según el nuevo ángulo. Devuelve JSON:
{"excerpt":"<1-2 frases>","body":"<markdown 350-700 palabras con ## H2>"}

Devuelve SOLO JSON.`;
    const raw = await chat({
      provider: args.provider,
      workspaceConfig: args.workspaceConfig,
      system: composeSystem,
      messages: [
        {
          role: "user",
          content: `Título existente: ${found.title}\nNuevo ángulo: ${intent.newAngle}`,
        },
      ],
      temperature: 0.75,
      maxTokens: 1500,
    });
    const json = extractJsonObject(raw.text) as { excerpt?: unknown; body?: unknown };
    const excerpt = typeof json.excerpt === "string" ? json.excerpt : (found.excerpt ?? "");
    const body = typeof json.body === "string" ? json.body : "";

    const tiptapDoc = markdownToTiptapDoc(body);
    await db
      .update(entries)
      .set({
        body: tiptapDoc as unknown as Record<string, unknown>,
        bodyText: body.replace(/[#*_`>]/g, "").slice(0, 8000),
        excerpt,
        updatedAt: new Date(),
        updatedById: args.userId,
      })
      .where(and(eq(entries.id, found.id), eq(entries.workspaceId, args.workspaceId)));

    await logActivity({
      workspaceId: args.workspaceId,
      actorId: args.userId,
      action: "entry.regenerated",
      targetType: "entry",
      targetId: found.id,
      meta: { source: "builder.refine", angle: intent.newAngle },
    });

    yield {
      type: "step",
      id: "regen",
      status: "done",
      label: `Reescrito: ${found.title}`,
      details: { entryId: found.id },
    };
  } catch (e) {
    yield {
      type: "step",
      id: "regen",
      status: "error",
      label: "Reescritura falló",
      details: e instanceof Error ? e.message : "regen_failed",
    };
  }
}

async function* deletePost(
  args: RefineArgs,
  intent: z.infer<typeof DeletePostIntent>,
  state: BuilderState,
): AsyncGenerator<BuilderEvent, void, undefined> {
  if (!db) {
    yield { type: "step", id: "del", status: "error", label: "DB no configurada" };
    return;
  }
  const found = fuzzyFindPost(state.posts, intent.match);
  if (!found) {
    yield {
      type: "step",
      id: "del",
      status: "error",
      label: `No encontré "${intent.match}"`,
    };
    return;
  }
  yield { type: "step", id: "del", status: "running", label: `Borrando: ${found.title}` };

  await db
    .update(entries)
    .set({ status: "archived", updatedAt: new Date(), updatedById: args.userId })
    .where(and(eq(entries.id, found.id), eq(entries.workspaceId, args.workspaceId)));

  await logActivity({
    workspaceId: args.workspaceId,
    actorId: args.userId,
    action: "entry.archived",
    targetType: "entry",
    targetId: found.id,
    meta: { source: "builder.refine" },
  });

  yield {
    type: "step",
    id: "del",
    status: "done",
    label: `Archivado: ${found.title}`,
    details: { entryId: found.id },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function loadCurrentBranding(workspaceId: string): Promise<{
  voice?: string;
  logo?: string;
  colors?: { primary?: string; accent?: string };
  font?: string;
}> {
  if (!db) return {};
  const [ws] = await db
    .select({ branding: workspaces.branding })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return (ws?.branding ?? {}) as {
    voice?: string;
    logo?: string;
    colors?: { primary?: string; accent?: string };
    font?: string;
  };
}

function fuzzyFindPost(
  posts: BuilderState["posts"],
  match: string,
): BuilderState["posts"][number] | null {
  const m = match.toLowerCase().trim();
  // Match exacto > prefijo > sustring
  const exact = posts.find((p) => p.title.toLowerCase() === m);
  if (exact) return exact;
  const prefix = posts.find((p) => p.title.toLowerCase().startsWith(m));
  if (prefix) return prefix;
  const substr = posts.find((p) => p.title.toLowerCase().includes(m));
  return substr ?? null;
}

function intentLabel(intent: Intent): string {
  switch (intent.kind) {
    case "add_posts":
      return `Voy a escribir ${intent.count} post${intent.count === 1 ? "" : "s"}`;
    case "edit_brand":
      return "Voy a actualizar la marca";
    case "regenerate_post":
      return `Voy a reescribir "${intent.match}"`;
    case "delete_post":
      return `Voy a archivar "${intent.match}"`;
    case "chat":
      return "Conversación";
  }
}

function brandChangeLabel(changes: z.infer<typeof EditBrandIntent>["changes"]): string {
  const parts: string[] = [];
  if (changes.name) parts.push("nombre");
  if (changes.tagline) parts.push("tagline");
  if (changes.voice) parts.push("voz");
  if (changes.emoji) parts.push("logo");
  if (changes.palette) parts.push("paleta");
  return `Marca actualizada · ${parts.join(", ")}`;
}
