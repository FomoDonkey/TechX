/**
 * Heurística simple de spam scoring (0..100). Si supera el umbral devolvemos
 * "spam" para que la submission entre como tal sin disparar webhook.
 *
 * No reemplaza un captcha real (hCaptcha/Turnstile soportados aparte) pero
 * sirve de primera línea sin coste.
 */

import { DEFAULT_MIN_SUBMIT_TIME_MS, type FormSettings } from "./types";

export type ScoreInput = {
  honeypotValue: unknown;
  formLoadedAt?: number; // epoch ms
  submittedAt?: number; // epoch ms
  data: Record<string, unknown>;
  userAgent?: string;
  settings: FormSettings | null | undefined;
};

export type ScoreResult = {
  score: number; // 0..100+
  reasons: string[];
  /** True si debemos dropearla silenciosamente (honeypot). */
  drop: boolean;
};

const SUSPICIOUS_TLD = /\.(ru|cn|tk|click|top|gq|cf|xyz|loan|work|men|date|pw|info)$/i;
const URL_RE = /https?:\/\/[^\s)]+/gi;

export function scoreSubmission(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  let drop = false;

  // 1) Honeypot — si tiene cualquier valor "verdadero", es bot
  if (
    input.honeypotValue !== undefined &&
    input.honeypotValue !== null &&
    input.honeypotValue !== "" &&
    input.honeypotValue !== false
  ) {
    score += 100;
    reasons.push("honeypot-filled");
    drop = true;
  }

  // 2) Time trap — submit demasiado rápido
  const minMs = input.settings?.minSubmitTimeMs ?? DEFAULT_MIN_SUBMIT_TIME_MS;
  if (input.formLoadedAt && input.submittedAt && input.submittedAt - input.formLoadedAt < minMs) {
    score += 50;
    reasons.push("submit-too-fast");
  }

  // 3) UA vacío o sospechoso
  if (!input.userAgent || input.userAgent.length < 10) {
    score += 15;
    reasons.push("no-user-agent");
  } else if (/curl|wget|python-requests|httpclient|bot|spider|crawler/i.test(input.userAgent)) {
    score += 30;
    reasons.push("bot-user-agent");
  }

  // 4) Email sospechoso o TLD raro en cualquier string
  for (const v of Object.values(input.data)) {
    if (typeof v !== "string") continue;
    if (SUSPICIOUS_TLD.test(v)) {
      score += 15;
      reasons.push("suspicious-tld");
      break;
    }
  }

  // 5) Texto con muchas URLs (>3) — spam clásico
  let totalUrls = 0;
  for (const v of Object.values(input.data)) {
    if (typeof v !== "string") continue;
    const matches = v.match(URL_RE);
    if (matches) totalUrls += matches.length;
  }
  if (totalUrls >= 4) {
    score += 25;
    reasons.push("too-many-urls");
  } else if (totalUrls >= 2) {
    score += 10;
    reasons.push("multiple-urls");
  }

  // 6) Repetición de caracteres (aaaaa, !!!!!) — chato indicador
  for (const v of Object.values(input.data)) {
    if (typeof v !== "string" || v.length < 10) continue;
    if (/(.)\1{6,}/.test(v)) {
      score += 10;
      reasons.push("char-repetition");
      break;
    }
  }

  return { score, reasons, drop };
}

/** Umbral por defecto. Submissions con score >= esto se marcan "spam". */
export const SPAM_THRESHOLD = 60;
