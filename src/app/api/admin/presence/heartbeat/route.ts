import { requireUser } from "@/auth/server";
import { userColor } from "@/collab/colors";
import { requireWorkspace } from "@/lib/workspace";
import { upsertHeartbeat } from "@/presence/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().min(1).max(64),
  route: z.string().min(1).max(512),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const ctx = await requireWorkspace("viewer");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  await upsertHeartbeat({
    workspaceId: ctx.workspace.id,
    userId: user.id,
    clientId: body.clientId,
    route: body.route,
    user: {
      id: user.id,
      name: user.name ?? user.email ?? "Editor",
      color: userColor(user.id),
      role: ctx.role,
      avatarUrl: user.image ?? null,
    },
  });
  return Response.json({ ok: true });
}
