"use server";

/**
 * Server actions de IA: AI Inline (no-stream para conveniencia), excerpt, título,
 * estructura de voz, sugerencias de enlaces internos.
 *
 * El streaming de AI Inline va por `/api/admin/ai/inline` (route handler),
 * porque las server actions actuales no streamean.
 */

import { requireWorkspace } from "@/lib/workspace";
import { findLinkCandidates } from "@/search";
import { type AIAction, buildPrompt, smartLinkSystem, structureVoiceSystem } from "./prompts";
import { chat } from "./provider";

export type RunInlineInput = {
  action: AIAction;
  selection: string;
  context?: string;
  targetLang?: string;
};

export async function runInlineAction(
  input: RunInlineInput,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  await requireWorkspace("author");
  const sel = (input.selection ?? "").trim();
  if (
    !sel &&
    input.action !== "title" &&
    input.action !== "excerpt" &&
    input.action !== "outline"
  ) {
    return { ok: false, error: "Selecciona algo de texto primero" };
  }
  const { system, user, temperature } = buildPrompt({
    action: input.action,
    selection: sel,
    context: input.context,
    targetLang: input.targetLang,
  });
  try {
    const r = await chat({
      system,
      messages: [{ role: "user", content: user }],
      temperature,
      maxTokens: 1024,
    });
    return { ok: true, text: r.text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IA no disponible" };
  }
}

export async function generateExcerptAction(input: { id: string; bodyText: string }): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  await requireWorkspace("author");
  const text = (input.bodyText ?? "").trim().slice(0, 5000);
  if (!text) return { ok: false, error: "El cuerpo está vacío" };
  const { system, user, temperature } = buildPrompt({ action: "excerpt", selection: text });
  try {
    const r = await chat({
      system,
      messages: [{ role: "user", content: user }],
      temperature,
      maxTokens: 220,
    });
    return {
      ok: true,
      text: r.text
        .replace(/^["']|["']$/g, "")
        .trim()
        .slice(0, 280),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IA no disponible" };
  }
}

export async function suggestSeoTitleAction(input: { title: string; bodyText: string }): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  await requireWorkspace("author");
  const text = `${input.title}\n\n${(input.bodyText ?? "").slice(0, 3000)}`;
  const { system, user, temperature } = buildPrompt({ action: "title", selection: text });
  try {
    const r = await chat({
      system,
      messages: [{ role: "user", content: user }],
      temperature,
      maxTokens: 80,
    });
    const cleaned = r.text
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "")
      .trim()
      .slice(0, 80);
    return { ok: true, text: cleaned };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IA no disponible" };
  }
}

export type LinkSuggestion = {
  id: string;
  anchor: string;
  reason: string;
  title: string;
  slug: string;
  workspaceSlug?: string;
};

export async function suggestInternalLinksAction(input: {
  entryId: string;
  bodyText: string;
}): Promise<{ ok: true; suggestions: LinkSuggestion[] } | { ok: false; error: string }> {
  const ctx = await requireWorkspace("author");
  const text = (input.bodyText ?? "").trim();
  if (!text) return { ok: true, suggestions: [] };

  // 1) Recuperar candidatos publicados similares al texto.
  const candidates = await findLinkCandidates({
    workspaceId: ctx.workspace.id,
    query: text.slice(0, 1500),
    excludeId: input.entryId,
    limit: 8,
  });
  if (candidates.length === 0) return { ok: true, suggestions: [] };

  // 2) Pedir al LLM que sugiera anclas válidas.
  const candidatesPayload = candidates
    .map(
      (c) =>
        `id: ${c.id}\ntitle: ${c.title}\nslug: ${c.slug}\nexcerpt: ${(c.excerpt ?? c.bodyText ?? "").slice(0, 240)}`,
    )
    .join("\n---\n");
  const userPrompt = `Fragmento del artículo actual:\n${text.slice(0, 2000)}\n\nCandidatos a enlazar:\n${candidatesPayload}`;
  try {
    const r = await chat({
      system: smartLinkSystem(),
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
      maxTokens: 600,
    });
    const parsed = tryParseJson(r.text);
    const arr =
      parsed && Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : ([] as Array<{ id?: string; anchor?: string; reason?: string }>);

    const suggestions: LinkSuggestion[] = [];
    const lowerText = text.toLowerCase();
    for (const s of arr) {
      const c = candidates.find((c) => c.id === s?.id);
      if (!c) continue;
      const anchor = (s?.anchor ?? "").trim();
      // Validar que el ancla aparezca literal en el texto (evita alucinaciones)
      if (!anchor || !lowerText.includes(anchor.toLowerCase())) continue;
      suggestions.push({
        id: c.id,
        anchor,
        reason: typeof s?.reason === "string" ? s.reason.slice(0, 140) : "Coincidencia semántica",
        title: c.title,
        slug: c.slug,
        workspaceSlug: ctx.workspace.slug,
      });
      if (suggestions.length >= 5) break;
    }
    // Si el LLM falló, fallback heurístico: para cada candidato, busca su slug-tokens en el texto.
    if (suggestions.length === 0) {
      for (const c of candidates) {
        const titleLower = c.title.toLowerCase();
        if (text.toLowerCase().includes(titleLower)) {
          // recortar a la posición exacta
          const idx = text.toLowerCase().indexOf(titleLower);
          const anchor = text.slice(idx, idx + c.title.length);
          suggestions.push({
            id: c.id,
            anchor,
            reason: "Coincidencia exacta del título",
            title: c.title,
            slug: c.slug,
            workspaceSlug: ctx.workspace.slug,
          });
          if (suggestions.length >= 3) break;
        }
      }
    }
    return { ok: true, suggestions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IA no disponible" };
  }
}

export type StructuredDoc = {
  title: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
};

/** Estructura una transcripción de voz en un esqueleto Tiptap-like (title + headings + paragraphs). */
export async function structureVoiceAction(input: { transcript: string }): Promise<
  { ok: true; doc: StructuredDoc } | { ok: false; error: string }
> {
  await requireWorkspace("author");
  const transcript = (input.transcript ?? "").trim();
  if (!transcript) return { ok: false, error: "Transcripción vacía" };
  try {
    const r = await chat({
      system: structureVoiceSystem(),
      messages: [{ role: "user", content: transcript.slice(0, 6000) }],
      temperature: 0.3,
      maxTokens: 1500,
    });
    const parsed = tryParseJson(r.text);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Respuesta inválida" };
    }
    const obj = parsed as Partial<StructuredDoc>;
    if (!obj.sections || !Array.isArray(obj.sections) || obj.sections.length === 0) {
      return { ok: false, error: "No se pudo estructurar" };
    }
    const sanitized: StructuredDoc = {
      title: typeof obj.title === "string" ? obj.title.slice(0, 120) : "Notas dictadas",
      sections: obj.sections
        .filter(
          (s): s is { heading: string; paragraphs: string[] } =>
            !!s &&
            typeof (s as { heading?: unknown }).heading === "string" &&
            Array.isArray((s as { paragraphs?: unknown }).paragraphs),
        )
        .slice(0, 12)
        .map((s) => ({
          heading: s.heading.slice(0, 100),
          paragraphs: s.paragraphs
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.slice(0, 4000))
            .slice(0, 8),
        })),
    };
    return { ok: true, doc: sanitized };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IA no disponible" };
  }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const m = /\{[\s\S]*\}/.exec(cleaned);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
