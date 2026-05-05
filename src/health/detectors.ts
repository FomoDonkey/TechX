import type { Entry } from "@/db/schema";
import type { DetectedIssue } from "./types";

/**
 * Detectores síncronos del Content Health Scan. Operan sobre un entry ya
 * cargado de DB (con `body` jsonb + `bodyText` + `seo` + `title` + `slug`).
 *
 * **No hacen HTTP** ni llamadas a servicios externos — eso queda para
 * detectores async (`broken_link`) que se ejecutan opcionalmente desde el cron
 * con timeout/concurrency limit.
 *
 * Cada detector devuelve 0..N issues. El motor agrega + persiste.
 */

// ============================================================
// SEO
// ============================================================
export function detectSeoTitleLength(entry: Entry): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const titleSeo = entry.seo?.title?.trim() ?? entry.title.trim();
  const len = titleSeo.length;
  if (len < 30) {
    issues.push({
      type: "seo_title_length",
      severity: "medium",
      message: `Título muy corto (${len} chars). Recomendado 50-60.`,
      suggestion: "Amplía el título con la keyword principal y un beneficio claro.",
      location: { field: "title", length: len },
    });
  } else if (len > 70) {
    issues.push({
      type: "seo_title_length",
      severity: "medium",
      message: `Título muy largo (${len} chars). Google lo trunca >60.`,
      suggestion: "Recorta a ≤60 chars manteniendo la keyword al inicio.",
      location: { field: "title", length: len },
    });
  }
  return issues;
}

export function detectSeoMetaMissing(entry: Entry): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const desc = entry.seo?.description?.trim() ?? entry.excerpt?.trim() ?? "";
  if (!desc) {
    issues.push({
      type: "seo_meta_missing",
      severity: "high",
      message: "Sin meta description. Google generará una automáticamente, perdiendo control.",
      suggestion: "Escribe 140-160 chars que resuman el valor del post + incluyan la keyword.",
      location: { field: "seo.description" },
    });
    return issues;
  }
  if (desc.length < 100) {
    issues.push({
      type: "seo_meta_missing",
      severity: "medium",
      message: `Meta description corta (${desc.length} chars). Recomendado 140-160.`,
      suggestion: "Añade contexto y CTA implícito.",
      location: { field: "seo.description", length: desc.length },
    });
  } else if (desc.length > 170) {
    issues.push({
      type: "seo_meta_missing",
      severity: "low",
      message: `Meta description larga (${desc.length} chars). Google trunca >160.`,
      suggestion: "Recorta a ≤160 chars.",
      location: { field: "seo.description", length: desc.length },
    });
  }
  return issues;
}

// ============================================================
// Body content
// ============================================================
export function detectThinContent(entry: Entry, minWords = 300): DetectedIssue[] {
  const text = entry.bodyText?.trim() ?? "";
  if (!text) {
    return [
      {
        type: "thin_content",
        severity: "high",
        message: "El cuerpo está vacío.",
        suggestion: "Añade al menos un par de párrafos antes de publicar.",
        location: { wordCount: 0 },
      },
    ];
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < minWords) {
    return [
      {
        type: "thin_content",
        severity: words < 100 ? "high" : "low",
        message: `Sólo ${words} palabras. Posts <300 suelen rankear peor en SEO.`,
        suggestion: `Amplía el cuerpo a ≥${minWords} palabras o márcalo como "nota corta" en su colección.`,
        location: { wordCount: words },
      },
    ];
  }
  return [];
}

// ============================================================
// Tiptap doc walker — comparte lógica entre detectors que recorren el body
// ============================================================
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

function* walkNodes(node: TiptapNode | null | undefined): Generator<TiptapNode> {
  if (!node) return;
  yield node;
  if (Array.isArray(node.content)) {
    for (const c of node.content) yield* walkNodes(c);
  }
}

function getDoc(entry: Entry): TiptapNode | null {
  const body = entry.body;
  if (!body || typeof body !== "object") return null;
  return body as TiptapNode;
}

// ============================================================
// Imagen sin alt
// ============================================================
export function detectMissingAlt(entry: Entry): DetectedIssue[] {
  const doc = getDoc(entry);
  if (!doc) return [];
  const offenders: Array<{ src: string; idx: number }> = [];
  let i = 0;
  for (const node of walkNodes(doc)) {
    if (node.type === "image" || node.type === "figure" || node.type === "imageBlock") {
      const alt = (node.attrs?.alt as string | undefined)?.trim() ?? "";
      const src = (node.attrs?.src as string | undefined) ?? "";
      if (!alt) offenders.push({ src, idx: i });
    }
    i++;
  }
  if (offenders.length === 0) return [];
  return [
    {
      type: "missing_alt",
      severity: offenders.length > 3 ? "high" : "medium",
      message: `${offenders.length} ${offenders.length === 1 ? "imagen sin" : "imágenes sin"} alt text.`,
      suggestion:
        "Describe brevemente cada imagen para a11y + SEO. Puedes usar AI ⌘J → 'Generar alt'.",
      location: { offenders: offenders.slice(0, 10) },
    },
  ];
}

// ============================================================
// Heading hierarchy (h1→h3 sin h2, etc.)
// ============================================================
export function detectHeadingHierarchy(entry: Entry): DetectedIssue[] {
  const doc = getDoc(entry);
  if (!doc) return [];
  const levels: Array<{ level: number; text: string }> = [];
  for (const node of walkNodes(doc)) {
    if (node.type === "heading") {
      const lvl = Number(node.attrs?.level ?? 1);
      const text = (node.content ?? [])
        .map((c) => c.text ?? "")
        .join("")
        .slice(0, 60);
      levels.push({ level: lvl, text });
    }
  }
  if (levels.length < 2) return [];

  const skips: Array<{ from: number; to: number; text: string }> = [];
  let prev = levels[0]?.level ?? 1;
  for (let k = 1; k < levels.length; k++) {
    const cur = levels[k];
    if (!cur) continue;
    if (cur.level > prev + 1) {
      skips.push({ from: prev, to: cur.level, text: cur.text });
    }
    prev = cur.level;
  }
  if (skips.length === 0) return [];
  return [
    {
      type: "heading_hierarchy",
      severity: "low",
      message: `${skips.length} salto(s) de nivel en headings (ej. H${skips[0]?.from}→H${skips[0]?.to}).`,
      suggestion:
        "Mantén la jerarquía: tras H2 viene H3, no H4. Mejora la accesibilidad y el outline SEO.",
      location: { skips: skips.slice(0, 5) },
    },
  ];
}

// ============================================================
// Outdated dates (fechas en el body >2 años)
// ============================================================
const DATE_PATTERNS = [
  // Año aislado entre 2000-2099 cuando aparece en contexto "en 2021", "del 2020", etc.
  /\b(?:en|del|de|durante)\s+(?:el\s+(?:año\s+)?)?(20\d{2})\b/gi,
  // Formato dd/mm/yyyy o dd-mm-yyyy
  /\b\d{1,2}[/\-.](?:0?[1-9]|1[0-2])[/\-.](20\d{2})\b/g,
  // Mes año, ej. "marzo de 2021"
  /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/gi,
];

export function detectOutdatedDates(
  entry: Entry,
  options: { now?: Date; thresholdYears?: number } = {},
): DetectedIssue[] {
  const text = entry.bodyText?.trim() ?? "";
  if (!text) return [];
  const now = options.now ?? new Date();
  const thresholdYears = options.thresholdYears ?? 2;
  const currentYear = now.getFullYear();

  const found = new Set<number>();
  for (const re of DATE_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex.exec idiom
    while ((match = re.exec(text)) !== null) {
      const y = Number(match[1]);
      if (Number.isFinite(y)) found.add(y);
    }
  }

  const stale = [...found]
    .filter((y) => y >= 2000 && y <= currentYear && currentYear - y >= thresholdYears)
    .sort((a, b) => a - b);
  if (stale.length === 0) return [];

  const oldest = stale[0] ?? currentYear;
  return [
    {
      type: "outdated_date",
      severity: currentYear - oldest >= 5 ? "medium" : "low",
      message: `Menciona año(s) ${stale.join(", ")} — el post puede sentirse desactualizado.`,
      suggestion:
        "Revisa si los datos siguen vigentes; añade un sello 'actualizado en' o reescribe.",
      location: { years: stale },
    },
  ];
}
