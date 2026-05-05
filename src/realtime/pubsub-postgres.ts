/**
 * Postgres LISTEN/NOTIFY pubsub adapter.
 *
 * Coste: 1 conexión long-lived por instancia. En Vercel Fluid Compute las
 * instancias se reúsan varios minutos → la misma conexión sirve a múltiples
 * requests SSE.
 *
 * Limitación: Neon pooler-mode (`-pooler.` en host) no soporta LISTEN. El
 * helper detecta el sufijo y conecta al endpoint directo.
 *
 * NOTIFY tiene cap de 8000 bytes de payload. Para updates más grandes
 * (snapshots Y.js >8KB), enviar un puntero (id) y que el receptor SELECT.
 */

import { env } from "@/env";
import postgres from "postgres";
import type { PubsubAdapter, PubsubListener } from "./types";

const localSubs = new Map<string, Set<PubsubListener>>();
let listenerSql: ReturnType<typeof postgres> | null = null;
const listeningChannels = new Map<string, Promise<void>>();

function ensureListenerSql() {
  if (listenerSql || !env.DATABASE_URL) return;
  // Neon: el pooler no soporta LISTEN. Forzar endpoint directo.
  // Heurística segura: si el host contiene `-pooler.`, lo retiramos.
  const directUrl = env.DATABASE_URL.replace("-pooler.", ".");
  listenerSql = postgres(directUrl, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
}

function subscribe(channel: string, fn: PubsubListener): () => void {
  ensureListenerSql();
  if (!listenerSql) return () => {};

  let set = localSubs.get(channel);
  if (!set) {
    set = new Set();
    localSubs.set(channel, set);
  }
  set.add(fn);

  if (!listeningChannels.has(channel)) {
    const sql = listenerSql;
    const promise = sql
      .listen(channel, (payload: string) => {
        const cur = localSubs.get(channel);
        if (!cur) return;
        for (const sub of cur) {
          try {
            sub(payload);
          } catch {
            /* listener crash should not affect siblings */
          }
        }
      })
      .then(() => {})
      .catch((err) => {
        listeningChannels.delete(channel);
        throw err;
      });
    listeningChannels.set(channel, promise);
  }

  return () => {
    const cur = localSubs.get(channel);
    if (!cur) return;
    cur.delete(fn);
    if (cur.size === 0) localSubs.delete(channel);
  };
}

async function publish(channel: string, payload: unknown): Promise<void> {
  ensureListenerSql();
  if (!listenerSql) return;
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    await listenerSql`SELECT pg_notify(${channel}, ${json})`;
  } catch {
    /* swallow — pubsub es best-effort */
  }
}

export const postgresPubsub: PubsubAdapter = {
  kind: "postgres",
  subscribe,
  publish,
};
