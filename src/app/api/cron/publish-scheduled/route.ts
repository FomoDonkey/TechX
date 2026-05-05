import { db } from "@/db/client";
import { atomicClaimMany } from "@/db/dialect";
import { entries } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { emit } from "@/webhooks/dispatcher";
import { and, isNull, lte } from "drizzle-orm";
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
  // F9b: el cron sólo publica entries de main. Forks scheduled en una branch
  // se publican vía merge — nunca por el cron global.
  // Pattern H atomic claim batch: el SELECT FOR UPDATE adquiere row-level lock
  // por entry candidata; la precondición exige status='scheduled' para evitar
  // doble-publicación si otro cron concurrente las tocó entre SELECT y UPDATE.
  const due = await atomicClaimMany<{
    id: string;
    workspaceId: string;
    slug: string;
    title: string;
    status: string;
  }>(entries, {
    where: and(lte(entries.scheduledAt, now), isNull(entries.branchId))!,
    precondition: (row) => row.status === "scheduled",
    set: { status: "published", publishedAt: now, updatedAt: now },
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
