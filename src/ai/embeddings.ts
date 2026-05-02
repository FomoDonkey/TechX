/**
 * Embeddings adapter.
 * - OpenAI text-embedding-3-small (1536 dims) si OPENAI_API_KEY
 * - Mock determinista 1536-dim normalizado si no
 *
 * El schema reserva `entries.embedding vector(1536)` y `media.embedding vector(1536)`.
 * El mock sirve para desarrollo y para CSM sin clave: la búsqueda híbrida funciona,
 * solo que la parte semántica se reduce a hashing de bigrams (mejor que nada).
 */

import { env } from "@/env";

export const EMBED_DIMS = 1536;

export type EmbedResult = {
  vector: number[];
  source: "openai" | "mock";
};

/**
 * Calcula el embedding de un texto.
 * Para textos largos, trunca a 8K caracteres (OpenAI 8K tokens ~ 24K chars; reservamos margen).
 */
export async function embed(text: string): Promise<EmbedResult> {
  const t = (text ?? "").slice(0, 8000).trim();
  if (!t) return { vector: zeros(EMBED_DIMS), source: "mock" };

  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: t,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
        const v = j.data?.[0]?.embedding;
        if (Array.isArray(v) && v.length === EMBED_DIMS) {
          return { vector: v, source: "openai" };
        }
      }
    } catch {
      // fall through
    }
  }
  return { vector: mockEmbed(t), source: "mock" };
}

/**
 * Embedding mock determinista basado en hashing de bigramas.
 * No es semántico de verdad, pero da consistencia y permite que la búsqueda
 * vector funcione (textos parecidos → vectores parecidos por solapamiento de tokens).
 */
function mockEmbed(text: string): number[] {
  const v = new Array<number>(EMBED_DIMS).fill(0);
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = norm.split(" ").filter((t) => t.length > 1);
  if (tokens.length === 0) return v;
  // Distribuye unigrams + bigrams sobre el vector
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    const h = hash(t);
    v[h % EMBED_DIMS] = (v[h % EMBED_DIMS] ?? 0) + 1;
    const next = tokens[i + 1];
    if (next) {
      const h2 = hash(`${t}_${next}`);
      v[h2 % EMBED_DIMS] = (v[h2 % EMBED_DIMS] ?? 0) + 0.7;
    }
  }
  return l2normalize(v);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  return v.map((x) => x / n);
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

export const embedFeatures = {
  hasOpenai: !!env.OPENAI_API_KEY,
  dims: EMBED_DIMS,
};

/**
 * Helper para serializar a formato que pgvector entiende: '[0.1,0.2,...]'.
 * Drizzle's `vector` column acepta `number[]` directamente al insertar, pero
 * para queries con sql`` necesitamos el string.
 */
export function vectorToSql(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
