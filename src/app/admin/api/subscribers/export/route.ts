import { db } from "@/db/client";
import { subscribers as subsT } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { subscribersToCsv } from "@/newsletter/subscribers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireWorkspace("editor");
  if (!db) {
    return new Response("Database unavailable", { status: 503 });
  }
  const rows = await db.select().from(subsT).where(eq(subsT.workspaceId, ctx.workspace.id));
  const csv = subscribersToCsv(rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="suscriptores-${ctx.workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
