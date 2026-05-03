/**
 * Cron de newsletter (cada 5 min). Funciones:
 *  1. Promote scheduled campaigns cuando scheduledAt vence → status='sending' + expand recipients.
 *  2. Process pending recipients: enviar lotes (cap 200/tick).
 *  3. Process drip enrollments listas (nextRunAt <= now).
 *  4. Marcar campañas finished cuando ya no hay pending.
 */

import { processCampaigns } from "@/newsletter/dispatcher";
import { processDripEnrollments } from "@/newsletter/drip";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const startedAt = Date.now();
  const [campaigns, drips] = await Promise.all([
    processCampaigns().catch((err) => {
      console.error("[cron newsletter campaigns]", err);
      return { sent: 0, failed: 0 };
    }),
    processDripEnrollments().catch((err) => {
      console.error("[cron newsletter drips]", err);
      return { processed: 0, completed: 0, failed: 0, skipped: 0 };
    }),
  ]);

  return Response.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    campaigns,
    drips,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
