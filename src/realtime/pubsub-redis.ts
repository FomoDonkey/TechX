/**
 * Redis pub/sub adapter.
 *
 * Funciona con CUALQUIER DB (Postgres o MySQL). Recomendado cuando:
 *  - DB es MySQL (sin LISTEN/NOTIFY equivalente).
 *  - DB es Postgres pero quieres separar el tráfico de pubsub del DB.
 *  - Despliegue multi-region donde el DB pueda estar lejos pero Redis cerca.
 *
 * Modelo Redis pub/sub:
 *  - Necesita DOS conexiones: una en modo subscriber (bloqueada en SUBSCRIBE)
 *    y otra para PUBLISH normal. ioredis lo gestiona — duplicamos el cliente.
 *  - SUBSCRIBE/PUBLISH son fire-and-forget; sin persistencia (igual que Postgres
 *    NOTIFY). Si esto es un problema en el futuro, migrar a Streams.
 *  - Sin cap de payload práctico (Redis acepta hasta 512MB) — pero mantener
 *    payloads pequeños por latencia.
 *
 * `ioredis` está en `optionalDependencies` — si no está instalado, este
 * módulo lanza al construir, pero la auto-detect lo evita: solo se carga
 * vía `await import()` cuando REDIS_URL está configurado.
 */

import type { PubsubAdapter, PubsubListener } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: ioredis types se resuelven en runtime via dynamic import
type RedisClient = any;

const localSubs = new Map<string, Set<PubsubListener>>();
let pub: RedisClient | null = null;
let sub: RedisClient | null = null;
const subscribedChannels = new Set<string>();
let initPromise: Promise<void> | null = null;

async function ensureClients(redisUrl: string): Promise<void> {
  if (pub && sub) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const mod = await import("ioredis");
    const Redis = mod.default;
    pub = new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });
    sub = pub.duplicate();
    // Evita que un error puntual de network reviente el proceso. ioredis
    // reintenta solito; nosotros solo silenciamos los logs.
    pub.on("error", () => {});
    sub.on("error", () => {});
    // El listener global hace fanout a todos los suscriptores locales.
    sub.on("message", (channel: string, payload: string) => {
      const set = localSubs.get(channel);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(payload);
        } catch {
          /* listener crash should not affect siblings */
        }
      }
    });
  })();
  return initPromise;
}

function makeAdapter(redisUrl: string): PubsubAdapter {
  function subscribe(channel: string, fn: PubsubListener): () => void {
    let set = localSubs.get(channel);
    if (!set) {
      set = new Set();
      localSubs.set(channel, set);
    }
    set.add(fn);

    // Asegura conexión + SUBSCRIBE al canal (idempotente).
    void (async () => {
      await ensureClients(redisUrl);
      if (!sub) return;
      if (!subscribedChannels.has(channel)) {
        try {
          await sub.subscribe(channel);
          subscribedChannels.add(channel);
        } catch {
          /* swallow — el próximo subscribe lo reintenta */
        }
      }
    })();

    return () => {
      const cur = localSubs.get(channel);
      if (!cur) return;
      cur.delete(fn);
      if (cur.size === 0) localSubs.delete(channel);
      // Mantenemos el SUBSCRIBE abierto aunque no haya listeners locales,
      // por simetría con el adapter Postgres y para evitar race conditions.
    };
  }

  async function publish(channel: string, payload: unknown): Promise<void> {
    await ensureClients(redisUrl);
    if (!pub) return;
    const json = typeof payload === "string" ? payload : JSON.stringify(payload);
    try {
      await pub.publish(channel, json);
    } catch {
      /* swallow — pubsub es best-effort */
    }
  }

  return { kind: "redis", subscribe, publish };
}

export function createRedisPubsub(redisUrl: string): PubsubAdapter {
  return makeAdapter(redisUrl);
}
