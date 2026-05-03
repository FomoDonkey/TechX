/**
 * Evaluación de reglas de audiencia (F8b-8).
 *
 * Cada `BlockNode.audience` es opcional. Si está presente, todas las claves
 * declaradas se evalúan con AND. `mode: "show"` (default) requiere match;
 * `mode: "hide"` excluye si matchea.
 */

import type { AudienceRule, ViewerContext } from "@/blocks/types";

function inListCi(needle: string | undefined, haystack: string[]): boolean {
  if (!needle) return false;
  const n = needle.toLowerCase();
  return haystack.some((h) => h.toLowerCase().includes(n));
}

function evaluateMatchesIgnoringMode(rule: AudienceRule, viewer: ViewerContext): boolean {
  // Cada criterio devuelve `true` si NO está declarado o si matchea.
  const checks: boolean[] = [];

  if (rule.countries && rule.countries.length > 0) {
    if (!viewer.country) checks.push(false);
    else
      checks.push(
        rule.countries.map((c) => c.toUpperCase()).includes(viewer.country.toUpperCase()),
      );
  }

  if (rule.devices && rule.devices.length > 0) {
    checks.push(rule.devices.includes(viewer.device));
  }

  if (rule.utmSource && rule.utmSource.length > 0) {
    checks.push(inListCi(viewer.utm.source, rule.utmSource));
  }
  if (rule.utmMedium && rule.utmMedium.length > 0) {
    checks.push(inListCi(viewer.utm.medium, rule.utmMedium));
  }
  if (rule.utmCampaign && rule.utmCampaign.length > 0) {
    checks.push(inListCi(viewer.utm.campaign, rule.utmCampaign));
  }

  if (rule.memberState && rule.memberState.length > 0) {
    const states: string[] = [];
    if (!viewer.isAuthenticated) states.push("guest");
    else {
      states.push("member");
      if (viewer.isActive) states.push("active");
    }
    checks.push(rule.memberState.some((s) => states.includes(s)));
  }

  if (rule.memberTierIds && rule.memberTierIds.length > 0) {
    checks.push(viewer.tierId !== null && rule.memberTierIds.includes(viewer.tierId));
  }

  if (rule.hourOfDay && viewer.hour !== null) {
    const { from, to } = rule.hourOfDay;
    if (from <= to) checks.push(viewer.hour >= from && viewer.hour <= to);
    else checks.push(viewer.hour >= from || viewer.hour <= to);
  } else if (rule.hourOfDay) {
    // Sin info → no aplicar criterio (no fail-open ni fail-close, neutral).
    checks.push(true);
  }

  if (checks.length === 0) return true;
  return checks.every(Boolean);
}

/**
 * Devuelve `true` si el bloque debe mostrarse según su regla y el viewer.
 * Si no hay regla → siempre true.
 */
export function shouldShow(rule: AudienceRule | undefined, viewer: ViewerContext): boolean {
  if (!rule) return true;
  const matches = evaluateMatchesIgnoringMode(rule, viewer);
  return rule.mode === "hide" ? !matches : matches;
}

/** Resumen humano de una regla (para UI inspector). */
export function describeAudience(rule: AudienceRule | undefined): string {
  if (!rule) return "Visible para todos";
  const parts: string[] = [];
  if (rule.countries?.length) parts.push(`países: ${rule.countries.join(",")}`);
  if (rule.devices?.length) parts.push(`device: ${rule.devices.join(",")}`);
  if (rule.utmSource?.length) parts.push(`utm_source: ${rule.utmSource.join(",")}`);
  if (rule.utmMedium?.length) parts.push(`utm_medium: ${rule.utmMedium.join(",")}`);
  if (rule.utmCampaign?.length) parts.push(`utm_campaign: ${rule.utmCampaign.join(",")}`);
  if (rule.memberState?.length) parts.push(`miembro: ${rule.memberState.join(",")}`);
  if (rule.memberTierIds?.length) parts.push(`tiers: ${rule.memberTierIds.length}`);
  if (rule.hourOfDay) parts.push(`hora ${rule.hourOfDay.from}-${rule.hourOfDay.to}`);
  const label = parts.length === 0 ? "Sin reglas" : parts.join(" · ");
  return rule.mode === "hide" ? `Oculto si: ${label}` : `Visible si: ${label}`;
}
