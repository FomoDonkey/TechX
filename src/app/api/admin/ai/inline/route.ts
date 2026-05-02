import { type AIAction, buildPrompt } from "@/ai/prompts";
import { chatStream } from "@/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set<AIAction>([
  "continue",
  "improve",
  "shorten",
  "expand",
  "translate",
  "excerpt",
  "title",
  "alt",
  "fix",
  "outline",
  "tone-formal",
  "tone-casual",
  "simplify",
]);

type Body = {
  action?: AIAction;
  selection?: string;
  context?: string;
  targetLang?: string;
};

export async function POST(req: Request) {
  try {
    await requireWorkspace("author");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const action = body.action;
  if (!action || !ACTIONS.has(action)) {
    return new NextResponse("Acción inválida", { status: 400 });
  }
  const selection = (body.selection ?? "").slice(0, 8000);
  const context = (body.context ?? "").slice(0, 8000);

  const { system, user, temperature } = buildPrompt({
    action,
    selection,
    context,
    targetLang: body.targetLang,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of chatStream({
          system,
          messages: [{ role: "user", content: user }],
          temperature,
          maxTokens: 1024,
        })) {
          // Formato SSE simple: solo el "data" como texto crudo (con escape de saltos)
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
