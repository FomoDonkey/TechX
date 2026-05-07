/**
 * Moderación de comentarios — score 0..100 (0 limpio, 100 spam).
 * - Heurística siempre se aplica (rápida, gratis).
 * - Si hay LLM, la heurística marca el rango y el LLM confirma; el score final = max(heur, llm/2).
 */

import { db } from "@/db/client";
import { upsert } from "@/db/dialect";
import { settings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { moderationSystem } from "./prompts";
import { chat } from "./provider";

export type ModerationResult = {
  score: number;
  reason: string;
  source: "heuristic" | "llm";
};

const SPAM_KEYWORDS = [
  "viagra",
  "casino",
  "loan",
  "bitcoin",
  "crypto invest",
  "click here",
  "free money",
  "buy now",
  "earn $",
  "free trial",
  "cheap meds",
  "porn",
  "xxx",
  "sex cam",
  "best price",
  "discount code",
];

export function heuristicScore(input: { body: string; authorName?: string }): ModerationResult {
  const body = (input.body ?? "").trim();
  if (!body) return { score: 100, reason: "Comentario vacío", source: "heuristic" };
  let score = 0;
  const reasons: string[] = [];

  // Demasiados enlaces
  const linkCount = (body.match(/https?:\/\//g) ?? []).length;
  if (linkCount >= 3) {
    score += 50;
    reasons.push(`${linkCount} enlaces`);
  } else if (linkCount === 2) {
    score += 20;
    reasons.push("2 enlaces");
  }

  // Mayúsculas excesivas
  const upper = (body.match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length;
  const letters = (body.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) ?? []).length;
  if (letters > 20 && upper / letters > 0.6) {
    score += 25;
    reasons.push("mayúsculas excesivas");
  }

  // Repeticiones de caracter
  if (/(.)\1{6,}/.test(body)) {
    score += 15;
    reasons.push("caracteres repetidos");
  }

  // Demasiado corto + enlace = sospechoso
  if (body.length < 30 && linkCount >= 1) {
    score += 25;
    reasons.push("comentario muy corto con enlace");
  }

  // Keywords spam
  const lower = body.toLowerCase();
  for (const k of SPAM_KEYWORDS) {
    if (lower.includes(k)) {
      score += 30;
      reasons.push(`keyword "${k}"`);
      break;
    }
  }

  // Demasiado largo (> 3000 chars suele ser bot)
  if (body.length > 3000) {
    score += 20;
    reasons.push("longitud excesiva");
  }

  // Nombre con números aleatorios
  if (input.authorName && /[a-z]+\d{4,}/i.test(input.authorName)) {
    score += 15;
    reasons.push("nombre con dígitos sospechosos");
  }

  score = Math.min(100, score);
  return {
    score,
    reason: reasons.length > 0 ? reasons.slice(0, 3).join(", ") : "limpio",
    source: "heuristic",
  };
}

/**
 * Score final = combina heurística + LLM si hay clave.
 * El LLM puede subir el score (más seguro), nunca bajarlo por debajo del mínimo heurístico/2.
 */
export async function scoreComment(input: {
  body: string;
  authorName?: string;
}): Promise<ModerationResult> {
  const heur = heuristicScore(input);
  // Si la heurística ya lo marca claro, no consumimos LLM
  if (heur.score >= 70) return heur;

  try {
    const r = await chat({
      system: moderationSystem(),
      messages: [
        {
          role: "user",
          content: `Autor: ${input.authorName ?? "anónimo"}\n\nComentario:\n${input.body.slice(0, 1500)}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 80,
    });
    const parsed = tryParseJson(r.text);
    if (parsed && typeof parsed.score === "number") {
      const llmScore = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const finalScore = Math.max(heur.score, llmScore);
      return {
        score: finalScore,
        reason: typeof parsed.reason === "string" ? parsed.reason : heur.reason,
        source: "llm",
      };
    }
  } catch {
    // fall through
  }
  return heur;
}

function tryParseJson(text: string): { score?: number; reason?: string } | null {
  // El LLM a veces envuelve en markdown ```json...```
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  // Primer { ... }
  const m = /\{[\s\S]*\}/.exec(cleaned);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as { score?: number; reason?: string };
  } catch {
    return null;
  }
}

/**
 * Umbrales por defecto: scores 0..100, donde:
 *  - score ≥ 75 → spam (descartar de la cola, no notificar al author)
 *  - score 35..74 → pending (mod humana revisa)
 *  - score < 35 → approved (publica directo)
 *
 * Configurables por workspace vía `getModerationThresholds(workspaceId)`. Si
 * un admin baja `spamThreshold` a 50, el sistema es más estricto (más comentarios
 * marcados spam automáticamente). Subirlo a 90 deja casi todo en pending para revisión.
 */
export const DEFAULT_MODERATION_THRESHOLDS = {
  spamThreshold: 75,
  pendingThreshold: 35,
} as const;

export type ModerationThresholds = {
  spamThreshold: number;
  pendingThreshold: number;
};

export function thresholdToStatus(
  score: number,
  thresholds: ModerationThresholds = DEFAULT_MODERATION_THRESHOLDS,
): "approved" | "pending" | "spam" {
  if (score >= thresholds.spamThreshold) return "spam";
  if (score >= thresholds.pendingThreshold) return "pending";
  return "approved";
}

const MODERATION_SETTINGS_KEY = "moderation";

/**
 * Lee los umbrales de moderación del workspace desde la tabla `settings`.
 * Si no hay config persistida, devuelve defaults. Se valida estrictamente:
 * thresholds fuera de 0..100 o `pending > spam` se ignoran (defaults).
 */
export async function getModerationThresholds(workspaceId: string): Promise<ModerationThresholds> {
  if (!db) return DEFAULT_MODERATION_THRESHOLDS;
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, MODERATION_SETTINGS_KEY)))
      .limit(1);
    if (!row?.value || typeof row.value !== "object") return DEFAULT_MODERATION_THRESHOLDS;
    const v = row.value as Record<string, unknown>;
    const spam = typeof v.spamThreshold === "number" ? v.spamThreshold : Number.NaN;
    const pending = typeof v.pendingThreshold === "number" ? v.pendingThreshold : Number.NaN;
    if (
      Number.isFinite(spam) &&
      Number.isFinite(pending) &&
      spam >= 0 &&
      spam <= 100 &&
      pending >= 0 &&
      pending <= 100 &&
      pending < spam
    ) {
      return { spamThreshold: spam, pendingThreshold: pending };
    }
    return DEFAULT_MODERATION_THRESHOLDS;
  } catch {
    return DEFAULT_MODERATION_THRESHOLDS;
  }
}

export async function setModerationThresholds(
  workspaceId: string,
  thresholds: ModerationThresholds,
): Promise<void> {
  if (!db) return;
  // Validamos antes de persistir.
  if (
    thresholds.spamThreshold < 0 ||
    thresholds.spamThreshold > 100 ||
    thresholds.pendingThreshold < 0 ||
    thresholds.pendingThreshold > 100 ||
    thresholds.pendingThreshold >= thresholds.spamThreshold
  ) {
    throw new Error("Umbrales inválidos: 0 ≤ pending < spam ≤ 100");
  }
  await upsert(settings, {
    values: {
      workspaceId,
      key: MODERATION_SETTINGS_KEY,
      value: thresholds,
    },
    target: [settings.workspaceId, settings.key],
    set: { value: thresholds },
  });
}
