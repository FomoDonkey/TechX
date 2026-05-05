import { requireUser } from "@/auth/server";
import { suggestSlots } from "@/editorial";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireUser();
  const ctx = await requireWorkspace("author");
  const url = new URL(req.url);
  const count = Math.min(Math.max(Number(url.searchParams.get("count") ?? 3) || 3, 1), 7);
  const collectionId = url.searchParams.get("collectionId") ?? undefined;
  const slots = await suggestSlots(ctx.workspace.id, { count, collectionId });
  return Response.json({
    ok: true,
    slots: slots.map((s) => ({
      date: s.date.toISOString(),
      score: s.score,
      rationale: s.rationale,
    })),
  });
}
