import { requireUser } from "@/auth/server";
import { markAllNotificationsRead, markNotificationRead } from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  if (parsed.data.all) {
    const n = await markAllNotificationsRead(ctx.workspace.id, user.id);
    return Response.json({ ok: true, marked: n });
  }
  if (parsed.data.id) {
    const ok = await markNotificationRead(ctx.workspace.id, user.id, parsed.data.id);
    return Response.json({ ok });
  }
  return Response.json({ ok: false, error: "Falta id o all=true" }, { status: 400 });
}
