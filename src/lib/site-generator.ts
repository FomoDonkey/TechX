import { slugify } from "@/lib/slug";

export type GeneratedBrand = {
  name: string;
  tagline: string;
  slug: string;
  emoji: string;
  voice: string;
  palette: {
    primary: string;
    accent: string;
    success: string;
    background: string;
    foreground: string;
  };
  font: "geist" | "lora" | "jetbrains";
};

export type GeneratedCategory = { name: string; slug: string; emoji: string };
export type GeneratedPost = {
  title: string;
  excerpt: string;
  slug: string;
  category: string;
  bodyMarkdown: string;
};

export type GeneratedSite = {
  brand: GeneratedBrand;
  categories: GeneratedCategory[];
  posts: GeneratedPost[];
};

const PALETTES: GeneratedBrand["palette"][] = [
  // Violeta-rosa (default)
  {
    primary: "oklch(0.55 0.22 290)",
    accent: "oklch(0.72 0.25 340)",
    success: "oklch(0.65 0.18 165)",
    background: "oklch(0.13 0.015 280)",
    foreground: "oklch(0.97 0.01 280)",
  },
  // Verde-cian (cocina, bienestar)
  {
    primary: "oklch(0.62 0.18 160)",
    accent: "oklch(0.72 0.16 200)",
    success: "oklch(0.78 0.18 130)",
    background: "oklch(0.12 0.01 180)",
    foreground: "oklch(0.97 0.01 180)",
  },
  // Naranja-rojo (foodie, lifestyle)
  {
    primary: "oklch(0.66 0.2 40)",
    accent: "oklch(0.72 0.22 25)",
    success: "oklch(0.7 0.18 90)",
    background: "oklch(0.14 0.015 30)",
    foreground: "oklch(0.97 0.01 30)",
  },
  // Azul electric (tech, IA, docs)
  {
    primary: "oklch(0.58 0.22 250)",
    accent: "oklch(0.72 0.2 220)",
    success: "oklch(0.72 0.18 165)",
    background: "oklch(0.12 0.015 250)",
    foreground: "oklch(0.97 0.01 250)",
  },
  // Mono carbón (editorial, fotografía)
  {
    primary: "oklch(0.5 0.02 280)",
    accent: "oklch(0.78 0.18 65)",
    success: "oklch(0.7 0.16 165)",
    background: "oklch(0.1 0.005 280)",
    foreground: "oklch(0.97 0.005 280)",
  },
  // Magenta-purpura (creator, newsletter)
  {
    primary: "oklch(0.6 0.24 320)",
    accent: "oklch(0.72 0.22 360)",
    success: "oklch(0.7 0.18 165)",
    background: "oklch(0.13 0.02 320)",
    foreground: "oklch(0.97 0.01 320)",
  },
  // Verde forest (sustentable, vegano)
  {
    primary: "oklch(0.5 0.16 145)",
    accent: "oklch(0.7 0.18 95)",
    success: "oklch(0.78 0.16 130)",
    background: "oklch(0.12 0.012 140)",
    foreground: "oklch(0.97 0.008 140)",
  },
  // Rosa-coral (moda, beauty)
  {
    primary: "oklch(0.65 0.22 0)",
    accent: "oklch(0.78 0.18 30)",
    success: "oklch(0.72 0.16 165)",
    background: "oklch(0.14 0.018 10)",
    foreground: "oklch(0.97 0.01 10)",
  },
];

const KEYWORDS_TO_PALETTE: Record<string, number> = {
  cocina: 1,
  vegan: 6,
  vegana: 6,
  recet: 1,
  food: 2,
  gastro: 2,
  ia: 3,
  tech: 3,
  dev: 3,
  code: 3,
  docs: 3,
  saas: 3,
  api: 3,
  foto: 4,
  photograph: 4,
  editorial: 4,
  moda: 7,
  beauty: 7,
  newsletter: 5,
  creator: 5,
  blog: 0,
  bienestar: 1,
  salud: 1,
  fitness: 6,
  music: 5,
  arte: 5,
  art: 5,
  travel: 2,
  viajes: 2,
};

const EMOJIS = ["✨", "🚀", "🌿", "🔮", "📰", "🎨", "🌸", "⚡", "🪐", "🌊", "🍃", "📚"];

const FONTS: GeneratedBrand["font"][] = ["geist", "lora", "jetbrains"];

function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return Math.abs(h);
}

function pickPalette(prompt: string): GeneratedBrand["palette"] {
  const lower = prompt.toLowerCase();
  for (const [keyword, idx] of Object.entries(KEYWORDS_TO_PALETTE)) {
    if (lower.includes(keyword)) {
      const p = PALETTES[idx];
      if (p) return p;
    }
  }
  return PALETTES[hashString(prompt) % PALETTES.length] ?? PALETTES[0]!;
}

function pickEmoji(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("vegan") || lower.includes("plant")) return "🌿";
  if (lower.includes("cocina") || lower.includes("recet") || lower.includes("food")) return "🍳";
  if (lower.includes("ia") || lower.includes("tech") || lower.includes("dev")) return "🤖";
  if (lower.includes("foto")) return "📷";
  if (lower.includes("docs") || lower.includes("saas")) return "📚";
  if (lower.includes("newsletter") || lower.includes("creator")) return "📨";
  if (lower.includes("moda") || lower.includes("fashion")) return "👗";
  if (lower.includes("viaj") || lower.includes("travel")) return "✈️";
  if (lower.includes("music")) return "🎵";
  if (lower.includes("arte") || lower.includes("art")) return "🎨";
  return EMOJIS[hashString(prompt) % EMOJIS.length] ?? "✨";
}

function pickFont(prompt: string): GeneratedBrand["font"] {
  const lower = prompt.toLowerCase();
  if (lower.includes("editorial") || lower.includes("magazine") || lower.includes("revista"))
    return "lora";
  if (
    lower.includes("docs") ||
    lower.includes("api") ||
    lower.includes("dev") ||
    lower.includes("code")
  )
    return "jetbrains";
  return "geist";
}

const NAME_TEMPLATES = [
  (kw: string) => `${capitalize(kw)} Studio`,
  (kw: string) => `${capitalize(kw)} Diario`,
  (kw: string) => `Casa ${capitalize(kw)}`,
  (kw: string) => `${capitalize(kw)} & Co`,
  (kw: string) => `${capitalize(kw)}lab`,
  (kw: string) => `Sobre ${capitalize(kw)}`,
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractKeyword(prompt: string): string {
  const stopwords = new Set([
    "un",
    "una",
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "para",
    "con",
    "y",
    "o",
    "blog",
    "newsletter",
    "portfolio",
    "docs",
    "sobre",
    "que",
    "es",
  ]);
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w));
  return capitalize(words[0] ?? "Espectacular");
}

function buildName(prompt: string): string {
  const kw = extractKeyword(prompt);
  const tpl = NAME_TEMPLATES[hashString(prompt) % NAME_TEMPLATES.length] ?? NAME_TEMPLATES[0]!;
  return tpl(kw);
}

function buildTagline(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("vegan"))
    return "Comida vegetal con alma. Recetas, ideas y técnica para cocinar mejor cada día.";
  if (lower.includes("cocina") || lower.includes("recet"))
    return "Comida hecha con cabeza. Recetas claras, técnica honesta, sabor sin atajos.";
  if (lower.includes("ia") || lower.includes("ai"))
    return "Análisis sin ruido sobre lo que importa de la IA esta semana.";
  if (lower.includes("foto"))
    return "Imágenes que se quedan. Editorial, retrato y series con criterio.";
  if (lower.includes("docs") || lower.includes("saas"))
    return "Documentación clara para que tu equipo y tu producto vayan a la misma velocidad.";
  if (lower.includes("newsletter"))
    return "Una idea bien explicada cada semana. Sin scroll infinito.";
  return "Publicado con cuidado. Diseñado para durar.";
}

function buildCategories(prompt: string): GeneratedCategory[] {
  const lower = prompt.toLowerCase();
  let names: { name: string; emoji: string }[];
  if (lower.includes("vegan") || lower.includes("cocina") || lower.includes("recet")) {
    names = [
      { name: "Recetas rápidas", emoji: "⚡" },
      { name: "Técnica", emoji: "🔪" },
      { name: "Estaciones", emoji: "🌿" },
      { name: "Despensa", emoji: "🥣" },
      { name: "Lecturas", emoji: "📖" },
    ];
  } else if (lower.includes("ia") || lower.includes("tech") || lower.includes("dev")) {
    names = [
      { name: "Modelos", emoji: "🧠" },
      { name: "Herramientas", emoji: "🛠" },
      { name: "Análisis", emoji: "🔬" },
      { name: "Industria", emoji: "🏛" },
      { name: "Tutoriales", emoji: "📐" },
    ];
  } else if (lower.includes("foto")) {
    names = [
      { name: "Editorial", emoji: "📰" },
      { name: "Moda", emoji: "👗" },
      { name: "Retrato", emoji: "🪞" },
      { name: "Series", emoji: "🎞" },
      { name: "Detrás de cámara", emoji: "🎬" },
    ];
  } else if (lower.includes("docs") || lower.includes("saas")) {
    names = [
      { name: "Empezar", emoji: "🚀" },
      { name: "Guías", emoji: "📘" },
      { name: "API", emoji: "🔌" },
      { name: "Ejemplos", emoji: "🧩" },
      { name: "Changelog", emoji: "📝" },
    ];
  } else {
    names = [
      { name: "Destacados", emoji: "✨" },
      { name: "Ensayos", emoji: "✍️" },
      { name: "Notas", emoji: "📓" },
      { name: "Entrevistas", emoji: "🎙" },
      { name: "Inspiración", emoji: "💡" },
    ];
  }
  return names.map((n) => ({ name: n.name, slug: slugify(n.name), emoji: n.emoji }));
}

function buildPosts(prompt: string, categories: GeneratedCategory[]): GeneratedPost[] {
  const lower = prompt.toLowerCase();
  const c = (i: number) => categories[i % categories.length]?.name ?? "General";
  if (lower.includes("vegan") || lower.includes("cocina") || lower.includes("recet")) {
    return [
      {
        title: "Curry de garbanzos en 20 minutos",
        excerpt: "Cremoso, especiado y todo en una sartén. La cena que vuelve cada semana.",
        slug: "curry-garbanzos-20-minutos",
        category: c(0),
        bodyMarkdown:
          "# Curry de garbanzos\n\nEsta receta es la que cocino cuando no tengo tiempo y quiero algo que abrace.\n\n## Ingredientes\n- 1 lata de garbanzos\n- 1 lata de leche de coco\n- 2 cdas de pasta de curry rojo\n- Espinacas, jengibre, ajo\n\n## Cómo\n1. Sofríe ajo y jengibre.\n2. Añade la pasta de curry.\n3. Coco y garbanzos. Reduce 8 min.\n4. Espinacas al final.\n",
      },
      {
        title: "Por qué tu sartén importa más que la receta",
        excerpt: "La técnica vive en el material. Una nota sobre hierro, antiadherente y carbono.",
        slug: "tu-sarten-importa",
        category: c(1),
        bodyMarkdown:
          "# La sartén\n\nLa receta no falla por la receta. Falla por la sartén que usas.\n\n## Hierro vs antiadherente\n…\n",
      },
      {
        title: "5 verduras de temporada que se cocinan solas",
        excerpt: "Lo que está bueno ahora, sin esfuerzo.",
        slug: "verduras-temporada",
        category: c(2),
        bodyMarkdown:
          "# De temporada\n\nLa verdura más cara se vuelve barata cuando es su mes.\n\n## La lista\n…\n",
      },
    ];
  }
  if (lower.includes("ia") || lower.includes("ai")) {
    return [
      {
        title: "Por qué los modelos pequeños están ganando",
        excerpt: "Llama 3 8B, Phi-3, Qwen 2: la edge se mueve al cliente.",
        slug: "modelos-pequenos",
        category: c(0),
        bodyMarkdown: "# Modelos pequeños\n\n…\n",
      },
      {
        title: "Cómo evaluar un agente sin volverte loca",
        excerpt: "Tres tipos de eval que sí funcionan en producción.",
        slug: "eval-agentes",
        category: c(2),
        bodyMarkdown: "# Eval\n\n…\n",
      },
      {
        title: "El stack mínimo de un asistente RAG en 2026",
        excerpt: "pgvector, embeddings buenos y chunking que no es magia.",
        slug: "stack-rag-2026",
        category: c(4),
        bodyMarkdown: "# RAG mínimo\n\n…\n",
      },
    ];
  }
  return [
    {
      title: "Empezamos: por qué este lugar existe",
      excerpt: "Una nota corta sobre la intención y lo que vas a leer aquí.",
      slug: "empezamos",
      category: c(0),
      bodyMarkdown: "# Empezamos\n\nEsta es la primera entrada. Aquí hablamos de lo que importa.\n",
    },
    {
      title: "Tres ideas que merecen tu atención esta semana",
      excerpt: "Un resumen breve y honesto, sin ruido.",
      slug: "tres-ideas-semana",
      category: c(1),
      bodyMarkdown: "# Tres ideas\n\n1. …\n2. …\n3. …\n",
    },
    {
      title: "Cómo trabajamos: un manual interno hecho público",
      excerpt: "Procesos, principios y por qué decimos no a casi todo.",
      slug: "como-trabajamos",
      category: c(2),
      bodyMarkdown: "# Cómo trabajamos\n\n…\n",
    },
  ];
}

export function generateSite(prompt: string): GeneratedSite {
  const seed = prompt.trim() || "blog espectacular";
  const name = buildName(seed);
  const brand: GeneratedBrand = {
    name,
    slug: slugify(name) || `csm-${hashString(seed) % 9999}`,
    tagline: buildTagline(seed),
    emoji: pickEmoji(seed),
    voice: "cercano, claro, optimista",
    palette: pickPalette(seed),
    font: pickFont(seed),
  };
  const categories = buildCategories(seed);
  const posts = buildPosts(seed, categories);
  return { brand, categories, posts };
}
