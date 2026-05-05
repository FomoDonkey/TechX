import type { HealthIssueType, HealthSeverity } from "@/db/schema";

/**
 * Issue detectado por el motor de health scan. Estructura puramente in-memory
 * — al persistir mapeamos a `entryHealthIssues`.
 */
export type DetectedIssue = {
  type: HealthIssueType;
  severity: HealthSeverity;
  message: string;
  suggestion?: string;
  location?: Record<string, unknown>;
};

/** Pesos para el cálculo del score (100 - sum). Tunables. */
export const SEVERITY_WEIGHT: Record<HealthSeverity, number> = {
  low: 2,
  medium: 5,
  high: 10,
  critical: 20,
};

/** Etiqueta legible de cada tipo. Usada en UI + emails. */
export const ISSUE_TYPE_LABEL: Record<HealthIssueType, string> = {
  broken_link: "Enlaces rotos",
  outdated_date: "Fechas obsoletas",
  missing_alt: "Imágenes sin alt",
  seo_title_length: "Título SEO fuera de rango",
  seo_meta_missing: "Meta description ausente o pobre",
  heading_hierarchy: "Jerarquía de headings rota",
  thin_content: "Contenido escaso",
  duplicate_slug: "Slug duplicado",
  orphan_entry: "Entrada huérfana",
};

/**
 * Calcula score 0-100 desde los issues detectados.
 * Cap inferior en 0; nunca negativo aunque la entry esté llena de problemas.
 */
export function computeScore(issues: DetectedIssue[]): number {
  const penalty = issues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
  return Math.max(0, 100 - penalty);
}

/** Cuenta issues por severidad — usado para columna `counts` jsonb. */
export function countBySeverity(issues: DetectedIssue[]): {
  low: number;
  medium: number;
  high: number;
  critical: number;
} {
  const out = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const i of issues) out[i.severity]++;
  return out;
}
