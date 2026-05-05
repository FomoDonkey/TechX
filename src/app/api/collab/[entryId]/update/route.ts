import { requireUser } from "@/auth/server";
import { MAX_UPDATE_BYTES, appendUpdate, checkEntryAccess } from "@/collab/server";
import { requireWorkspace } from "@/lib/workspace";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().min(1).max(64),
  update: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_UPDATE_BYTES * 4) / 3) + 8), // base64 overhead ~4/3
});

export async function POST(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const user = await requireUser();
  const wsCtx = await requireWorkspace("author");

  const ok = await checkEntryAccess(entryId, wsCtx.workspace.id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  await appendUpdate({
    entryId,
    workspaceId: wsCtx.workspace.id,
    userId: user.id,
    clientId: body.clientId,
    update: body.update,
  });

  return Response.json({ ok: true });
}
