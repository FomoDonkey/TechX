import { features } from "@/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      version: "1.0.0",
      database: features.database,
      ai: features.ai,
      storage: features.storageDriver,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
