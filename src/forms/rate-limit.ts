/**
 * Rate limit por IP+formId para submissions públicas.
 * In-memory token-bucket — adecuado para una sola región (Fluid Compute reusa
 * instancias). Para multi-región habría que mover a Redis/Upstash.
 *
 * Dos buckets por (ip, form): hourly y daily. Si excede cualquiera, rechaza.
 */

type Bucket = {
  tokens: number;
  refillRate: number; // tokens/ms
  capacity: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 50_000; // eviction simple

function makeBucket(capacity: number, windowMs: number): Bucket {
  return {
    tokens: capacity,
    capacity,
    refillRate: capacity / windowMs,
    lastRefill: Date.now(),
  };
}

function consumeBucket(key: string, capacity: number, windowMs: number): boolean {
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size > MAX_BUCKETS) {
      // Eviction simple: borra los primeros 10% (orden de inserción).
      const toEvict = Math.floor(MAX_BUCKETS * 0.1);
      let i = 0;
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (++i >= toEvict) break;
      }
    }
    b = makeBucket(capacity, windowMs);
    buckets.set(key, b);
  }
  // Refill
  const now = Date.now();
  const elapsed = now - b.lastRefill;
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRate);
    b.lastRefill = now;
  }
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export type SubmitRateLimitInput = {
  ip: string;
  formId: string;
  hourly: number;
  daily: number;
};

export type SubmitRateLimitResult = {
  ok: boolean;
  reason?: "hourly" | "daily";
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function consumeSubmitRateLimit(input: SubmitRateLimitInput): SubmitRateLimitResult {
  // Aplicamos primero el daily (más restrictivo); si pasa, también el hourly.
  const dailyOk = consumeBucket(`d:${input.formId}:${input.ip}`, input.daily, DAY_MS);
  if (!dailyOk) return { ok: false, reason: "daily" };
  const hourlyOk = consumeBucket(`h:${input.formId}:${input.ip}`, input.hourly, HOUR_MS);
  if (!hourlyOk) return { ok: false, reason: "hourly" };
  return { ok: true };
}

/** Test helper. */
export function _resetSubmitRateLimit() {
  buckets.clear();
}
