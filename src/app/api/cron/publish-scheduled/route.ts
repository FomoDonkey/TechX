import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { emit } from "@/webhooks/dispatcher";
import { and, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCronAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  if (!db) return Response.json({ ok: true, published: 0 });

  const now = new Date();
  // UPDATE...RETURNING garantiza que sólo emitimos webhooks por las filas que
  // efectivamente transicionaron a published (entre SELECT y UPDATE alguien
  // pudo cambiarlas a draft, archivar, etc.).
  const due = await db
    .update(entries)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(and(eq(entries.status, "scheduled"), lte(entries.scheduledAt, now)))
    .returning({
      id: entries.id,
      workspaceId: entries.workspaceId,
      slug: entries.slug,
      title: entries.title,
    });

  if (due.length === 0) return Response.json({ ok: true, published: 0 });

  for (const entry of due) {
    await logActivity({
      workspaceId: entry.workspaceId,
      actorId: null,
      action: "entry.published",
      targetType: "entry",
      targetId: entry.id,
      meta: { via: "cron-scheduled", title: entry.title, slug: entry.slug },
    });
    await emit({
      workspaceId: entry.workspaceId,
      event: "entry.published",
      payload: { id: entry.id, slug: entry.slug, title: entry.title, scheduled: true },
    });
  }
  revalidatePath("/blog");
  return Response.json({ ok: true, published: due.length });
}

export async function POST(req: Request) {
  return GET(req);
}
