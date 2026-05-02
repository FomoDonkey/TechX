import { env } from "@/env";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "para",
  "con",
  "por",
  "que",
  "este",
  "esta",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

const COLOR_NAMES_ES: Array<{ name: string; ranges: [number, number][] }> = [
  {
    name: "rojizo",
    ranges: [
      [0, 20],
      [340, 360],
    ],
  },
  { name: "naranja", ranges: [[20, 45]] },
  { name: "amarillo", ranges: [[45, 65]] },
  { name: "verde", ranges: [[65, 165]] },
  { name: "cian", ranges: [[165, 195]] },
  { name: "azul", ranges: [[195, 255]] },
  { name: "violeta", ranges: [[255, 295]] },
  { name: "rosado", ranges: [[295, 340]] },
];

function hexToHue(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return null;
  const code = m[1];
  const r = Number.parseInt(code.slice(0, 2), 16) / 255;
  const g = Number.parseInt(code.slice(2, 4), 16) / 255;
  const b = Number.parseInt(code.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function colorNameFromHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const hsl = hexToHue(hex);
  if (!hsl) return null;
  if (hsl.s < 0.12) {
    if (hsl.l < 0.2) return "negro";
    if (hsl.l < 0.45) return "gris oscuro";
    if (hsl.l < 0.75) return "gris";
    return "blanco";
  }
  for (const c of COLOR_NAMES_ES) {
    for (const [lo, hi] of c.ranges) {
      if (hsl.h >= lo && hsl.h < hi) return c.name;
    }
  }
  return null;
}

export type VisionInput = {
  url: string;
  filename?: string | null;
  dominantColor?: string | null;
  width?: number | null;
  height?: number | null;
  mime: string;
};

/**
 * Adapter: Hugging Face BLIP si hay HUGGINGFACE_API_KEY; mock determinista si no.
 */
export async function generateAltText(input: VisionInput): Promise<string> {
  if (env.HUGGINGFACE_API_KEY) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: input.url }),
        },
      );
      if (r.ok) {
        const j = (await r.json()) as Array<{ generated_text?: string }> | { error?: string };
        if (Array.isArray(j) && j[0]?.generated_text) return j[0].generated_text.slice(0, 200);
      }
    } catch {
      // fall through to mock
    }
  }
  return mockAlt(input);
}

function mockAlt(input: VisionInput): string {
  const color = colorNameFromHex(input.dominantColor) ?? "neutros";
  const baseName = (input.filename ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const tokens = tokenize(baseName).slice(0, 4);
  const subject = tokens.length > 0 ? tokens.join(" ") : "Imagen";
  const dim = input.width && input.height ? ` (${input.width}×${input.height})` : "";
  return `${subject} en tonos ${color}${dim}`;
}

export async function generateTags(input: VisionInput): Promise<string[]> {
  if (env.HUGGINGFACE_API_KEY) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: input.url }),
        },
      );
      if (r.ok) {
        const j = (await r.json()) as Array<{ label?: string; score?: number }>;
        return j
          .filter((it) => (it.score ?? 0) > 0.05)
          .slice(0, 6)
          .map((it) => (it.label ?? "").split(",")[0]?.trim().toLowerCase() ?? "")
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return mockTags(input);
}

function mockTags(input: VisionInput): string[] {
  const color = colorNameFromHex(input.dominantColor);
  const tokens = tokenize(input.filename ?? "").slice(0, 5);
  const out = new Set<string>(tokens);
  if (color) out.add(color);
  if (input.mime.startsWith("image/")) out.add("imagen");
  return Array.from(out).slice(0, 6);
}

const PICSUM_RATIOS: Record<string, [number, number]> = {
  "1:1": [800, 800],
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "4:3": [1024, 768],
};

export type GenerateImageInput = {
  prompt: string;
  ratio?: keyof typeof PICSUM_RATIOS;
};

export type GeneratedImage = {
  buffer: Buffer;
  mime: string;
  filename: string;
  source: "replicate" | "picsum";
};

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  if (env.REPLICATE_API_TOKEN) {
    try {
      // Flux schnell: model id corresponds to "black-forest-labs/flux-schnell".
      const aspect = input.ratio ?? "1:1";
      const create = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=30",
        },
        body: JSON.stringify({
          version: "131d9e185621b4b4d349fd262e363420a6f74081d8c27966c9c5bcf120fa3985",
          input: {
            prompt: input.prompt,
            aspect_ratio: aspect,
            num_outputs: 1,
            output_format: "webp",
          },
        }),
      });
      if (create.ok) {
        const pred = (await create.json()) as { output?: string[] | string; status?: string };
        const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
        if (out) {
          const img = await fetch(out);
          if (img.ok) {
            return {
              buffer: Buffer.from(await img.arrayBuffer()),
              mime: "image/webp",
              filename: `ai-${slugifyShort(input.prompt)}.webp`,
              source: "replicate",
            };
          }
        }
      }
    } catch {
      // fall through to mock
    }
  }
  return picsumMock(input);
}

function slugifyShort(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function picsumMock(input: GenerateImageInput): Promise<GeneratedImage> {
  const [w, h] = PICSUM_RATIOS[input.ratio ?? "1:1"] ?? [800, 800];
  // Seed determinista para reproducibilidad.
  let hash = 0;
  for (const ch of input.prompt) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const seed = String(hash % 1000);
  const url = `https://picsum.photos/seed/${seed}/${w}/${h}.jpg`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("picsum.photos no disponible (sin red)");
  return {
    buffer: Buffer.from(await r.arrayBuffer()),
    mime: "image/jpeg",
    filename: `ai-${slugifyShort(input.prompt)}.jpg`,
    source: "picsum",
  };
}

export const visionFeatures = {
  hasReplicate: !!env.REPLICATE_API_TOKEN,
  hasHuggingface: !!env.HUGGINGFACE_API_KEY,
};
