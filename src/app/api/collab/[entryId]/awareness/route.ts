import { requireUser } from "@/auth/server";
import { checkEntryAccess, publishAwareness } from "@/collab/server";
import { requireWorkspace } from "@/lib/workspace";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().min(1).max(64),
  update: z
    .string()
    .min(1)
    .max(8 * 1024), // awareness deltas son pequeños
  user: z.object({
    id: z.string(),
    name: z.string().max(120),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    role: z.string().max(32),
    avatarUrl: z.string().url().optional(),
  }),
});

export async function POST(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const user = await requireUser();
  const wsCtx = await requireWorkspace("viewer");

  const ok = await checkEntryAccess(entryId, wsCtx.workspace.id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  // Hardening: el `user.id` reportado por el cliente DEBE coincidir con la sesión.
  // Sin esta verificación un cliente podría suplantar la presence de otro user.
  if (body.user.id !== user.id) {
    return Response.json({ error: "user_mismatch" }, { status: 403 });
  }

  await publishAwareness({
    entryId,
    clientId: body.clientId,
    update: body.update,
    user: body.user,
  });

  return Response.json({ ok: true });
}
