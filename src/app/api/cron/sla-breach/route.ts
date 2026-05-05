import { sweepSlaBreaches } from "@/editorial";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  const result = await sweepSlaBreaches();
  return Response.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
