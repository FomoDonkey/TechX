import { getFormById, listSubmissions, submissionsToCsv } from "@/forms/lib";
import type { FormSchema } from "@/forms/types";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const wsCtx = await requireWorkspace("editor");
  const form = await getFormById(wsCtx.workspace.id, id);
  if (!form) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const status = url.searchParams.get("status");

  // Paginar para no cargar todo en memoria. Hasta 10k rows.
  const all: Array<Awaited<ReturnType<typeof listSubmissions>>["rows"][number]> = [];
  let cursor: { createdAt: string; id: string } | null = null;
  while (all.length < MAX_ROWS) {
    const page = await listSubmissions({
      workspaceId: wsCtx.workspace.id,
      formId: id,
      ...(status ? { status: status as never } : {}),
      limit: 200,
      cursor,
    });
    all.push(...page.rows);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `submissions-${form.slug}-${stamp}.${format === "json" ? "json" : "csv"}`;

  if (format === "json") {
    const json = JSON.stringify(
      {
        form: { id: form.id, slug: form.slug, name: form.name, version: form.version },
        exportedAt: new Date().toISOString(),
        count: all.length,
        rows: all.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          status: r.status,
          spamScore: r.spamScore,
          spamReasons: r.spamReasons,
          country: r.country,
          data: r.data,
        })),
      },
      null,
      2,
    );
    return new Response(json, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = submissionsToCsv((form.schema ?? null) as FormSchema | null, all);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
