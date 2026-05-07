import { z } from "zod";

/**
 * Blueprint que la IA genera en la fase Plan y que la fase Materialize
 * aplica al workspace. JSON estructurado y validable.
 *
 * Diseño minimalista para MVP F10g B1: brand + N posts. F10g B2 añade
 * collections custom, pages con bloques, menus y forms.
 */

const oklchString = z
  .string()
  .regex(/^oklch\([^)]+\)$/i, "debe ser oklch(L C H)")
  .max(64);

export const BrandSchema = z.object({
  name: z.string().min(2).max(80).describe("Nombre del proyecto / blog / marca"),
  tagline: z.string().min(2).max(140).describe("Tagline corto evocador"),
  emoji: z.string().min(1).max(4).describe("Un emoji que represente la marca (logo simple)"),
  voice: z.string().min(2).max(160).describe("Tono de voz en una frase (ej: cercano y técnico)"),
  palette: z.object({
    primary: oklchString,
    accent: oklchString,
    success: oklchString,
    background: oklchString,
    foreground: oklchString,
  }),
  font: z.enum(["geist", "lora", "jetbrains"]),
});

export const PostPlanSchema = z.object({
  title: z.string().min(3).max(120),
  excerpt: z.string().min(10).max(280),
  category: z.string().min(2).max(40).describe("Una categoría / tag de la entrada"),
  angle: z
    .string()
    .min(10)
    .max(280)
    .describe("Qué cuenta este post en una frase. Le sirve al modelo en la fase materialize."),
});

export const BlueprintSchema = z.object({
  brand: BrandSchema,
  posts: z.array(PostPlanSchema).min(1).max(8),
});

export type Brand = z.infer<typeof BrandSchema>;
export type PostPlan = z.infer<typeof PostPlanSchema>;
export type Blueprint = z.infer<typeof BlueprintSchema>;

/**
 * Extrae el primer objeto JSON de una respuesta del modelo. Tolera fences
 * markdown (```json ... ```), prosa antes/después y espacios. Si falla,
 * lanza con un snippet del input para debugging.
 */
export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  // Busca el primer "{" balanceado.
  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error(`Sin JSON en respuesta del modelo: ${raw.slice(0, 120)}…`);
  }
  let depth = 0;
  let end = -1;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(`JSON desbalanceado: ${candidate.slice(0, 120)}…`);
  }
  const slice = candidate.slice(start, end);
  return JSON.parse(slice);
}
