/**
 * In-memory pubsub adapter — fallback cuando no hay backend cross-instance.
 *
 * **AVISO:** este adapter NO hace fanout entre instancias. Solo sirve para:
 *  - Single-instance deployments (Docker self-hosted con 1 réplica, dev local).
 *  - DB=MySQL sin REDIS_URL configurado (degradación funcional aceptable
 *    para pequeños despliegues; presence/collab funcionan within-instance).
 *
 * Loggea un warning una sola vez al primer uso para que el operador sepa
 * que está en modo limitado.
 */

import type { PubsubAdapter, PubsubListener } from "./types";

const localSubs = new Map<string, Set<PubsubListener>>();
let warned = false;

function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[csm/pubsub] Using in-memory pubsub: cross-instance fanout DISABLED. " +
      "Configure REDIS_URL (or use Postgres) for production multi-instance.",
  );
}

function subscribe(channel: string, fn: PubsubListener): () => void {
  warnOnce();
  let set = localSubs.get(channel);
  if (!set) {
    set = new Set();
    localSubs.set(channel, set);
  }
  set.add(fn);
  return () => {
    const cur = localSubs.get(channel);
    if (!cur) return;
    cur.delete(fn);
    if (cur.size === 0) localSubs.delete(channel);
  };
}

async function publish(channel: string, payload: unknown): Promise<void> {
  warnOnce();
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);
  const set = localSubs.get(channel);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(json);
    } catch {
      /* listener crash should not affect siblings */
    }
  }
}

export const memoryPubsub: PubsubAdapter = {
  kind: "memory",
  subscribe,
  publish,
};
