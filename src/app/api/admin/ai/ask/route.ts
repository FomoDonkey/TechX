import { askCsmSystem } from "@/ai/prompts";
import { chatStream } from "@/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { ragRetrieve } from "@/search";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { question?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };

export async function POST(req: Request) {
  let ctx: Awaited<ReturnType<typeof requireWorkspace>>;
  try {
    ctx = await requireWorkspace("author");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const question = (body.question ?? "").trim().slice(0, 800);
  if (!question) return new NextResponse("Pregunta vacía", { status: 400 });

  // Retrieval
  const passages = await ragRetrieve({
    workspaceId: ctx.workspace.id,
    query: question,
    k: 5,
  });

  const refs = passages.map((p, i) => ({
    n: i + 1,
    id: p.id,
    title: p.title,
    slug: p.slug,
    text: (p.bodyText ?? p.excerpt ?? "").slice(0, 1200),
  }));

  const contextBlock = refs.map((r) => `[${r.n}] ${r.title}\n${r.text}`).join("\n\n---\n\n");

  const userPrompt = refs.length
    ? `Pregunta del usuario: ${question}\n\nFragmentos disponibles:\n\n${contextBlock}`
    : `Pregunta del usuario: ${question}\n\n(No hay fragmentos relevantes en el contenido publicado.)`;

  const history = (body.history ?? [])
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Primero enviamos las citas como evento `refs`
      const refsPayload = JSON.stringify(
        refs.map((r) => ({ n: r.n, id: r.id, title: r.title, slug: r.slug })),
      );
      controller.enqueue(encoder.encode(`event: refs\ndata: ${refsPayload}\n\n`));

      try {
        for await (const piece of chatStream({
          system: askCsmSystem(),
          messages: [...history, { role: "user", content: userPrompt }],
          temperature: 0.3,
          maxTokens: 900,
        })) {
          const safe = piece.replace(/\r?\n/g, "\\n");
          controller.enqueue(encoder.encode(`data: ${safe}\n\n`));
        }
        controller.enqueue(encoder.encode("event: done\ndata: end\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`event: error\ndata: ${msg}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
