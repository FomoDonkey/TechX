/**
 * Pubsub cross-instance — entrypoint público.
 *
 * Auto-detect del backend según env vars:
 *
 *   | Caso                                   | Backend           |
 *   |----------------------------------------|-------------------|
 *   | REDIS_URL set                          | Redis pub/sub     |
 *   | DB=Postgres y NO REDIS_URL             | Postgres LISTEN   |
 *   | DB=MySQL y NO REDIS_URL                | In-memory (warn)  |
 *   | NO DB                                  | In-memory (warn)  |
 *
 * Los call-sites usan los wrappers `subscribePubsub` / `publishPubsub` y
 * NO ven el backend concreto. Esto permite migrar de Postgres a Redis
 * (o viceversa) cambiando solo env vars.
 */

import { dialect } from "@/db/client";
import { env } from "@/env";
import { memoryPubsub } from "./pubsub-memory";
import { postgresPubsub } from "./pubsub-postgres";
import { createRedisPubsub } from "./pubsub-redis";
import type { PubsubAdapter } from "./types";

let adapter: PubsubAdapter | null = null;

export function getPubsub(): PubsubAdapter {
  if (adapter) return adapter;
  const redisUrl = env.REDIS_URL;
  if (redisUrl) {
    adapter = createRedisPubsub(redisUrl);
  } else if (dialect === "postgres" && env.DATABASE_URL) {
    adapter = postgresPubsub;
  } else {
    adapter = memoryPubsub;
  }
  return adapter;
}

/** Suscribe un listener al canal (cross-instance via backend). */
export function subscribePubsub(channel: string, fn: (payload: string) => void): () => void {
  return getPubsub().subscribe(channel, fn);
}

/** Publica un payload al canal. Best-effort — errores se swallowean. */
export async function publishPubsub(channel: string, payload: unknown): Promise<void> {
  return getPubsub().publish(channel, payload);
}

export type { PubsubAdapter, PubsubListener } from "./types";
