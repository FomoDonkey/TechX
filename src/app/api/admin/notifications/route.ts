import { requireUser } from "@/auth/server";
import { listNotifications } from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");
  const url = new URL(req.url);
  const onlyUnread = url.searchParams.get("unread") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30) || 30, 1), 100);
  const data = await listNotifications(ctx.workspace.id, user.id, { onlyUnread, limit });
  return Response.json({
    ok: true,
    unread: data.unread,
    items: data.rows.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
