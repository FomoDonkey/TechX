"use server";

import { requireWorkspace } from "@/lib/workspace";
import { reindexWorkspace } from "@/search/jobs";

export async function reindexAllAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    const ctx = await requireWorkspace("editor");
    const count = await reindexWorkspace(ctx.workspace.id);
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
