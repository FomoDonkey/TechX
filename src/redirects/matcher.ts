/**
 * Matcher de redirects: dado un path, encuentra la primera regla que aplica.
 *
 * Tipos de match:
 * - `exact`: source debe coincidir con path exacto.
 * - `prefix`: path empieza con source. Lo que sobre se preserva en el destino.
 * - `regex`: source es un patrón JS RegExp; capturas $1, $2... reemplazables en destino.
 *
 * preserveQuery aplica a todos los tipos: si true, la querystring del request
 * se mantiene en el destino (mergeada con la del destino si la había).
 *
 * Detección de ciclos: el caller puede pasar maxChain (default 5) para limitar
 * encadenados. Si excede, devuelve null y registra el ciclo en `cycle`.
 */

export interface RedirectRule {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  matchType: "exact" | "prefix" | "regex";
  preserveQuery: boolean;
  enabled: boolean;
}

export interface RedirectMatch {
  rule: RedirectRule;
  destination: string;
  statusCode: 301 | 302 | 307 | 308;
}

const VALID_STATUS = new Set([301, 302, 307, 308]);

function normalizeStatus(code: number): 301 | 302 | 307 | 308 {
  return (VALID_STATUS.has(code) ? code : 301) as 301 | 302 | 307 | 308;
}

/** Match a single rule against a path. Returns destination string or null. */
export function applyRule(rule: RedirectRule, path: string): string | null {
  if (!rule.enabled) return null;
  switch (rule.matchType) {
    case "exact":
      return rule.source === path ? rule.destination : null;
    case "prefix": {
      const src = rule.source.endsWith("/") ? rule.source : `${rule.source}/`;
      const targetPath = path.endsWith("/") ? path : `${path}/`;
      if (targetPath === src || targetPath.startsWith(src)) {
        const remainder = path.slice(rule.source.length);
        const dest = rule.destination.endsWith("/")
          ? rule.destination.slice(0, -1)
          : rule.destination;
        return remainder ? `${dest}${remainder.startsWith("/") ? "" : "/"}${remainder}` : dest;
      }
      return null;
    }
    case "regex": {
      let re: RegExp;
      try {
        re = new RegExp(rule.source);
      } catch {
        return null;
      }
      const m = re.exec(path);
      if (!m) return null;
      // Reemplaza $1, $2 ... en destination con las capturas.
      return rule.destination.replace(/\$(\d+)/g, (_, i) => m[Number(i)] ?? "");
    }
    default:
      return null;
  }
}

/** Encuentra la primera regla que matchea, siguiendo cadenas y detectando ciclos. */
export function matchRedirect(
  path: string,
  rules: RedirectRule[],
  query?: string,
  opts: { maxChain?: number } = {},
): { destination: string; statusCode: 301 | 302 | 307 | 308; rule: RedirectRule } | null {
  const maxChain = opts.maxChain ?? 5;
  const seen = new Set<string>();
  let current = path;
  let lastMatch: RedirectMatch | null = null;
  for (let i = 0; i < maxChain; i++) {
    if (seen.has(current)) {
      // Ciclo: devolvemos el último match válido si lo había.
      return lastMatch
        ? {
            destination: appendQuery(lastMatch.destination, query, lastMatch.rule.preserveQuery),
            statusCode: lastMatch.statusCode,
            rule: lastMatch.rule,
          }
        : null;
    }
    seen.add(current);
    const found = rules.find((r) => applyRule(r, current) !== null);
    if (!found) {
      if (i === 0) return null;
      break;
    }
    const next = applyRule(found, current);
    if (next === null) break;
    lastMatch = {
      rule: found,
      destination: next,
      statusCode: normalizeStatus(found.statusCode),
    };
    // Si destino es URL absoluta o está fuera del set actual, no encadenar.
    if (/^https?:\/\//i.test(next)) break;
    current = next;
  }
  if (!lastMatch) return null;
  return {
    destination: appendQuery(lastMatch.destination, query, lastMatch.rule.preserveQuery),
    statusCode: lastMatch.statusCode,
    rule: lastMatch.rule,
  };
}

function appendQuery(dest: string, query: string | undefined, preserve: boolean): string {
  if (!preserve || !query) return dest;
  // Si destino ya tiene query, mergea (request query gana sólo si la key no existe).
  const [base, existing] = dest.split("?");
  const merged = new URLSearchParams(existing ?? "");
  const incoming = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  for (const [k, v] of incoming) {
    if (!merged.has(k)) merged.append(k, v);
  }
  const qs = merged.toString();
  return qs ? `${base}?${qs}` : (base ?? dest);
}

/** Valida que una regla no se redirige a sí misma (caso trivial de loop). */
export function isSelfReferential(rule: {
  source: string;
  destination: string;
  matchType: string;
}): boolean {
  if (rule.matchType === "exact") return rule.source === rule.destination;
  if (rule.matchType === "prefix") {
    const s = rule.source.replace(/\/+$/, "");
    const d = rule.destination.replace(/\/+$/, "");
    return s === d || d.startsWith(`${s}/`);
  }
  return false;
}
