import { pruneExpiredKeys, resetDailyCounters } from "@/api/keys";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { anonymizeIp } from "@/lib/ip-anon";
import { purgeExpiredDeletions } from "@/privacy/lib";
import { pruneOldDeliveries } from "@/webhooks/dispatcher";
import { sql } from "drizzle-orm";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * Backfill defensivo: filas pre-F10a tenían la IP completa. El hook
 * `databaseHooks.session.create` ya trunca las nuevas, pero las existentes
 * pueden quedar con identidad full hasta que expiren. Truncamos en lotes
 * pequeños para evitar bloquear el cron.
 */
async function anonymizeLegacySessionIps(): Promise<number> {
  if (!db) return 0;
  const rows = await db
    .select({ id: sessions.id, ipAddress: sessions.ipAddress })
    .from(sessions)
    .where(
      sql`${sessions.ipAddress} IS NOT NULL AND ${sessions.ipAddress} !~ '\\.0$' AND ${sessions.ipAddress} !~ '::$'`,
    )
    .limit(500);
  let updated = 0;
  for (const r of rows) {
    const masked = anonymizeIp(r.ipAddress);
    if (masked && masked !== r.ipAddress) {
      await db.update(sessions).set({ ipAddress: masked }).where(sql`${sessions.id} = ${r.id}`);
      updated++;
    } else if (masked === null) {
      await db.update(sessions).set({ ipAddress: null }).where(sql`${sessions.id} = ${r.id}`);
      updated++;
    }
  }
  return updated;
}

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  await resetDailyCounters();
  const keysPruned = await pruneExpiredKeys();
  const deliveriesPruned = await pruneOldDeliveries(30);
  // GDPR: hard-delete users cuyo grace period (30d) ya pasó.
  const accountsPurged = await purgeExpiredDeletions();
  const legacyIpsAnonymized = await anonymizeLegacySessionIps();
  return Response.json({
    ok: true,
    keysPruned,
    deliveriesPruned,
    accountsPurged: accountsPurged.purged,
    legacyIpsAnonymized,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
