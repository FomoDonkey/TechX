/**
 * Token-bucket rate limiter en memoria.
 *
 * - Cada bucket tiene `capacity` tokens y se refill `capacity/windowMs` tokens/ms.
 * - El contador es por process; perfecto para serverless/edge dado que cada función
 *   se asigna a una instancia (cold-warm) y el bucket es ephemeral.
 * - Para hardening cross-instance habría que mover a Redis/Upstash en F10.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const BUCKETS = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // safety cap para evitar leak

export type RateLimitResult = {
  ok: boolean;
  /** Tokens restantes tras consumir 1 (puede ser negativo si ok=false). */
  remaining: number;
  /** Capacidad total del bucket. */
  limit: number;
  /** ms hasta que vuelve a haber al menos 1 token. */
  retryAfterMs: number;
  /** Epoch ms del próximo reset completo (limit tokens). */
  resetAt: number;
};

/**
 * Consume 1 token de `key`. Window por defecto 1 hora.
 */
export function consume(
  key: string,
  capacity: number,
  windowMs: number = 60 * 60 * 1000,
  cost = 1,
): RateLimitResult {
  if (BUCKETS.size > MAX_BUCKETS) {
    // Eviction simple: limpia los más viejos
    const now = Date.now();
    for (const [k, v] of BUCKETS.entries()) {
      if (now - v.lastRefill > windowMs) BUCKETS.delete(k);
    }
  }

  const now = Date.now();
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    BUCKETS.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refilled = (elapsed / windowMs) * capacity;
      bucket.tokens = Math.min(capacity, bucket.tokens + refilled);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    const resetAt = now + ((capacity - bucket.tokens) / capacity) * windowMs;
    return {
      ok: true,
      remaining: Math.floor(bucket.tokens),
      limit: capacity,
      retryAfterMs: 0,
      resetAt,
    };
  }
  // No alcanza
  const tokensNeeded = cost - bucket.tokens;
  const retryAfterMs = (tokensNeeded / capacity) * windowMs;
  return {
    ok: false,
    remaining: Math.floor(bucket.tokens),
    limit: capacity,
    retryAfterMs: Math.ceil(retryAfterMs),
    resetAt: now + retryAfterMs,
  };
}

export function reset(key: string) {
  BUCKETS.delete(key);
}

export function clearAll() {
  BUCKETS.clear();
}
