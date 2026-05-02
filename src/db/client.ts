import { env, features } from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __csmDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  if (!features.database || !env.DATABASE_URL) {
    return null;
  }
  const client = postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });
  return drizzle(client, { schema, logger: env.NODE_ENV === "development" });
}

function getOrCreateDb() {
  if (globalThis.__csmDb !== undefined) return globalThis.__csmDb;
  const instance = createDb();
  if (env.NODE_ENV !== "production") {
    globalThis.__csmDb = instance;
  }
  return instance;
}

export const db = getOrCreateDb();

export { schema };
