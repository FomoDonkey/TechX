/**
 * Prompts curados para CSM. Todos en español por defecto.
 * Cada acción tiene un `system` y un builder de `user` que recibe el contexto.
 */

export type AIAction =
  | "continue"
  | "improve"
  | "shorten"
  | "expand"
  | "translate"
  | "excerpt"
  | "title"
  | "alt"
  | "fix"
  | "outline"
  | "tone-formal"
  | "tone-casual"
  | "simplify";

export const AI_ACTIONS: Array<{
  id: AIAction;
  label: string;
  description: string;
  group: string;
}> = [
  {
    id: "continue",
    label: "Continuar",
    description: "Sigue escribiendo desde donde lo dejaste",
    group: "Generar",
  },
  {
    id: "expand",
    label: "Ampliar",
    description: "Añade detalle, ejemplos y contexto",
    group: "Generar",
  },
  {
    id: "outline",
    label: "Esquema",
    description: "Crea una estructura de secciones",
    group: "Generar",
  },
  {
    id: "improve",
    label: "Mejorar redacción",
    description: "Limpia, fluidez y claridad",
    group: "Refinar",
  },
  {
    id: "fix",
    label: "Corregir gramática",
    description: "Ortografía, tildes, puntuación",
    group: "Refinar",
  },
  {
    id: "shorten",
    label: "Acortar",
    description: "Más conciso sin perder esencia",
    group: "Refinar",
  },
  {
    id: "simplify",
    label: "Simplificar",
    description: "Lenguaje sencillo y directo",
    group: "Refinar",
  },
  {
    id: "tone-formal",
    label: "Más formal",
    description: "Tono profesional y cuidado",
    group: "Tono",
  },
  {
    id: "tone-casual",
    label: "Más casual",
    description: "Tono cercano y conversacional",
    group: "Tono",
  },
  { id: "translate", label: "Traducir", description: "A otro idioma", group: "Traducir" },
  { id: "excerpt", label: "Generar excerpt", description: "Resumen de 1-2 frases", group: "SEO" },
  { id: "title", label: "Sugerir título SEO", description: "Atractivo y optimizado", group: "SEO" },
];

export const SUPPORTED_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "Inglés" },
  { code: "fr", label: "Francés" },
  { code: "de", label: "Alemán" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Portugués" },
  { code: "es", label: "Español" },
];

export type PromptArgs = {
  action: AIAction;
  selection: string;
  /** Texto completo del documento alrededor (para acciones que necesiten contexto). */
  context?: string;
  /** Idioma destino para "translate". */
  targetLang?: string;
  /** Tono extra solicitado por el usuario. */
  hint?: string;
};

export function buildPrompt(args: PromptArgs): {
  system: string;
  user: string;
  temperature: number;
} {
  const base =
    "Eres un editor experto en español que ayuda a escribir y mejorar contenido para un CMS llamado CSM. " +
    "Responde solo con el texto resultante, sin comentarios meta, sin etiquetas, sin Markdown si la entrada no lo usa. " +
    "Conserva el idioma original salvo que se pida traducir. Mantén el sentido. No inventes datos.";

  const sel = args.selection.trim();
  const ctx = args.context?.trim() ?? "";

  switch (args.action) {
    case "continue":
      return {
        system: `${base} Tu tarea es CONTINUAR un texto existente desde donde se quedó. Devuelve únicamente la continuación nueva, sin repetir lo anterior.`,
        user: ctx
          ? `Contexto previo:\n${ctx.slice(-1500)}\n\nÚltimo fragmento (continúa naturalmente):\n${sel}`
          : sel,
        temperature: 0.7,
      };
    case "improve":
      return {
        system: `${base} Tu tarea es MEJORAR la redacción. Reescribe con mejor fluidez, ritmo y claridad. No cambies la longitud sustancialmente. Si hay repeticiones, varíalas.`,
        user: sel,
        temperature: 0.4,
      };
    case "shorten":
      return {
        system: `${base} Tu tarea es ACORTAR el texto a la mitad de su longitud aproximada, conservando los puntos clave. Sin viñetas a menos que ya las haya.`,
        user: sel,
        temperature: 0.3,
      };
    case "expand":
      return {
        system: `${base} Tu tarea es AMPLIAR el texto añadiendo ejemplos, contexto o explicaciones útiles. Mantén el tono original.`,
        user: sel,
        temperature: 0.6,
      };
    case "translate":
      return {
        system: `${base} Tu tarea es TRADUCIR el texto al idioma "${args.targetLang ?? "en"}". Conserva nombres propios y estructura. Devuelve solo la traducción.`,
        user: sel,
        temperature: 0.2,
      };
    case "excerpt":
      return {
        system: `${base} Tu tarea es generar un EXCERPT de 1-2 frases (máximo 180 caracteres) que resuma el texto y enganche al lector. Sin signos finales innecesarios. Sin "En este post...".`,
        user: sel || ctx,
        temperature: 0.5,
      };
    case "title":
      return {
        system: `${base} Tu tarea es proponer un TÍTULO SEO atractivo (50-65 caracteres). Sin comillas, sin punto final, capital inicial únicamente. Devuelve solo el título.`,
        user: sel || ctx,
        temperature: 0.7,
      };
    case "alt":
      return {
        system: `${base} Tu tarea es generar un texto ALT en español de máximo 125 caracteres que describa la imagen referenciada en el contexto. Sin "Imagen de" al inicio.`,
        user: sel || ctx,
        temperature: 0.4,
      };
    case "fix":
      return {
        system: `${base} Tu tarea es CORREGIR gramática, ortografía, tildes y puntuación. NO cambies el estilo ni reescribas. Devuelve el texto corregido manteniendo formato y longitud.`,
        user: sel,
        temperature: 0.1,
      };
    case "outline":
      return {
        system: `${base} Tu tarea es proponer un ESQUEMA del artículo con 4-6 secciones (H2). Devuelve cada sección en una línea, numeradas (1. 2. 3.).`,
        user: sel || ctx,
        temperature: 0.5,
      };
    case "tone-formal":
      return {
        system: `${base} Tu tarea es REESCRIBIR el texto en tono más FORMAL y profesional, manteniendo el mismo significado.`,
        user: sel,
        temperature: 0.4,
      };
    case "tone-casual":
      return {
        system: `${base} Tu tarea es REESCRIBIR el texto en tono más CASUAL y cercano, como hablando con un amigo. Manteniendo el mismo significado.`,
        user: sel,
        temperature: 0.5,
      };
    case "simplify":
      return {
        system: `${base} Tu tarea es SIMPLIFICAR el texto: frases cortas, vocabulario común, evitar tecnicismos. Lo entendería un adolescente.`,
        user: sel,
        temperature: 0.3,
      };
  }
}

/** Prompt JSON para estructurar transcripción de voz en bloques Tiptap. */
export function structureVoiceSystem(): string {
  return (
    "Eres un asistente que estructura una transcripción de voz en formato Tiptap JSON. " +
    "Devuelve estrictamente un objeto JSON con esta forma: " +
    `{"title":"...","sections":[{"heading":"...","paragraphs":["..."]}]}. ` +
    "Sin texto previo ni posterior. Idioma español. Mínimo 1 sección. " +
    "El title resume la transcripción en máximo 80 caracteres. " +
    "Cada paragraph es texto plano, sin saltos de línea internos."
  );
}

/** Prompt JSON para sugerir enlaces internos. */
export function smartLinkSystem(): string {
  return (
    "Eres un editor SEO. Te paso (1) un fragmento del artículo actual y (2) una lista de candidatos a enlazar (cada uno con id, title, slug y excerpt). " +
    'Devuelve estrictamente JSON: {"suggestions":[{"id":"<uuid>","anchor":"<frase exacta a enlazar>","reason":"<por qué>"}]} con un máximo de 5 sugerencias. ' +
    'Si no hay match natural, devuelve {"suggestions":[]}. La frase ancla debe aparecer literal en el fragmento.'
  );
}

/** Prompt JSON para puntuar comentarios anti-spam. */
export function moderationSystem(): string {
  return (
    "Eres un moderador de comentarios. Evalúa el comentario y devuelve estrictamente JSON: " +
    '{"score":0-100,"reason":"<corto>"} donde 0 = legítimo, 100 = spam evidente. ' +
    "Penaliza enlaces múltiples, mayúsculas excesivas, ofertas, repeticiones."
  );
}

/** Prompt para Ask CSM (RAG). */
export function askCsmSystem(): string {
  return (
    "Eres el asistente del workspace, experto en su contenido. " +
    "Te paso fragmentos numerados [1], [2]... extraídos de los posts publicados. " +
    "Responde la pregunta del usuario en español, conciso y útil. " +
    "Cita inline con [1], [2] cuando uses información de un fragmento. " +
    'Si los fragmentos no son suficientes, di "No encuentro información sobre eso en tus posts" sin inventar.'
  );
}
