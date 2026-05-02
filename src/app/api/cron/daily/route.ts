import { pruneExpiredKeys, resetDailyCounters } from "@/api/keys";
import { pruneOldDeliveries } from "@/webhooks/dispatcher";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  await resetDailyCounters();
  const keysPruned = await pruneExpiredKeys();
  const deliveriesPruned = await pruneOldDeliveries(30);
  return Response.json({ ok: true, keysPruned, deliveriesPruned });
}

export async function POST(req: Request) {
  return GET(req);
}
