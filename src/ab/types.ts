/**
 * Tipos compartidos del subsistema A/B (F8c).
 *
 * Variants se persisten como JSONB en `ab_tests.variants`. Su shape es
 * estable y validado con Zod en cada read/write. Pesos enteros 1-100, suma
 * exactamente 100. Al menos una variant con isControl=true.
 */

export type AbVariant = {
  id: string;
  label: string;
  weight: number;
  isControl: boolean;
  /** Sólo aplica a target=page. Si null, render la página host. */
  pageId?: string | null;
};

export type AbGoalKind = "click" | "submit" | "purchase" | "custom";
export type AbGoal = {
  kind: AbGoalKind;
  /** Sólo si kind=click */
  selector?: string;
  /** Sólo si kind=submit */
  formId?: string;
  /** Sólo si kind=custom */
  eventName?: string;
};

export type AbTarget = "block" | "page";
export type AbStatus = "draft" | "running" | "paused" | "completed";

/** Resultado de una resolución sticky para una request. */
export type AbResolution = {
  testId: string;
  testKey: string;
  variantId: string;
  /** True si esta resolución acaba de crearse (insert assignment). */
  isFresh: boolean;
};

/** Mapa testKey → variantId, alimenta el render. */
export type AbResolutionMap = Map<string, AbResolution>;
