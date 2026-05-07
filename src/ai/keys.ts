/**
 * Helpers para leer/guardar configs de proveedores AI por workspace.
 *
 * Encryption-at-rest via `encryptKey/decryptKey` (AES-256-GCM derivado
 * de AUTH_SECRET). Si AUTH_SECRET cambia, las keys quedan inválidas y
 * el resolver hace fallback a env vars / mock.
 *
 * Cache: NO se cachea. Cada llamada es un query. Aceptable porque las
 * llamadas a `chat()` ya hacen network IO al provider — un query extra
 * a Postgres añade <5ms. Si fuera bottleneck, cachear con TTL=5min en
 * Redis o LRU local.
 */

import { decryptKey, encryptKey } from "@/ai/key-crypto";
import { db } from "@/db/client";
import { upsert } from "@/db/dialect";
import { aiProviderConfigs } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type AiProviderId = "anthropic" | "openai" | "xai" | "openrouter" | "ollama";

export type AiProviderConfigDecrypted = {
  provider: AiProviderId;
  apiKey: string; // "" si no hay key (ollama)
  model: string;
  baseUrl: string | null;
  enabled: boolean;
};

/**
 * Lee la config de un provider para un workspace. Decripta la API key.
 * Devuelve null si no hay fila o la decryption falla (clave rotada, etc.).
 */
export async function getAiProviderConfig(
  workspaceId: string,
  provider: AiProviderId,
): Promise<AiProviderConfigDecrypted | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.workspaceId, workspaceId),
        eq(aiProviderConfigs.provider, provider),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Si apiKeyEncrypted es "", apiKey será "" (válido para ollama).
  const apiKey = row.apiKeyEncrypted ? (decryptKey(row.apiKeyEncrypted) ?? "") : "";
  return {
    provider: row.provider as AiProviderId,
    apiKey,
    model: row.model,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
  };
}

/**
 * Lista TODAS las configs de un workspace (para mostrar en UI). Decripta keys.
 */
export async function listAiProviderConfigs(
  workspaceId: string,
): Promise<AiProviderConfigDecrypted[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.workspaceId, workspaceId));
  return rows.map((row) => ({
    provider: row.provider as AiProviderId,
    apiKey: row.apiKeyEncrypted ? (decryptKey(row.apiKeyEncrypted) ?? "") : "",
    model: row.model,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
  }));
}

/**
 * Upsert config. apiKey vacío = no se actualiza la key (preserva la anterior).
 * Para borrar la key se usa un sentinel `__clear__`.
 */
export async function setAiProviderConfig(
  workspaceId: string,
  provider: AiProviderId,
  patch: { apiKey?: string; model?: string; baseUrl?: string | null; enabled?: boolean },
): Promise<void> {
  if (!db) throw new Error("DB not configured");
  const now = new Date();

  // Decide qué hacer con apiKey:
  //  - undefined → no tocar la encrypted column en update (CASE WHEN)
  //  - "__clear__" → encriptar string vacío (= "")
  //  - otro string → encriptar normal
  const shouldUpdateKey = patch.apiKey !== undefined;
  const encryptedKey = shouldUpdateKey
    ? patch.apiKey === "__clear__"
      ? ""
      : encryptKey(patch.apiKey ?? "")
    : null;

  // Drizzle no tiene un modo "no update if undefined" limpio para
  // upsert — manejamos como insert + on conflict update.
  await upsert(aiProviderConfigs, {
    values: {
      workspaceId,
      provider,
      apiKeyEncrypted: encryptedKey ?? "",
      model: patch.model ?? "",
      baseUrl: patch.baseUrl ?? null,
      enabled: patch.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    },
    target: [aiProviderConfigs.workspaceId, aiProviderConfigs.provider],
    set: {
      ...(shouldUpdateKey ? { apiKeyEncrypted: encryptedKey ?? "" } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: now,
    },
  });
}

/**
 * Borra el registro completo (key + model + baseUrl).
 */
export async function deleteAiProviderConfig(
  workspaceId: string,
  provider: AiProviderId,
): Promise<void> {
  if (!db) return;
  await db
    .delete(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.workspaceId, workspaceId),
        eq(aiProviderConfigs.provider, provider),
      ),
    );
}
