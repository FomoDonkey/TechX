import { getCurrentUser } from "@/auth/server";
import { resolveBuilderProvider, runBuilder } from "@/builder/lovable";
import { runRefinement } from "@/builder/refine";
import { currentWorkspace } from "@/lib/workspace";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint del Builder. Dos modos:
 *
 *  - `mode: "first"` → primera generación. `runBuilder()` (plan + materialize).
 *  - `mode: "refine"` → refinamiento iterativo sobre el sitio existente.
 *    `runRefinement()` clasifica intent y aplica cambios incrementales.
 *
 * Auth: cookie + workspace + role >= editor.
 */

const RequestSchema = z.object({
  prompt: z.string().min(2).max(2000),
  mode: z.enum(["first", "refine"]),
  forceProvider: z.enum(["anthropic", "openai", "ollama", "groq", "mock"]).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await currentWorkspace();
  if (!ctx) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "editor") {
    return NextResponse.json({ error: "role_insufficient" }, { status: 403 });
  }

  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "bad_request", message: e instanceof Error ? e.message : "invalid" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (parsed.mode === "first") {
          for await (const evt of runBuilder({
            prompt: parsed.prompt,
            workspaceId: ctx.workspace.id,
            userId: user.id,
            forceProvider: parsed.forceProvider,
            signal: req.signal,
          })) {
            controller.enqueue(encoder.encode(`${JSON.stringify(evt)}\n`));
          }
        } else {
          // Refine: resolvemos provider una sola vez y lo pasamos.
          const { provider, workspaceConfig } = await resolveBuilderProvider(
            ctx.workspace.id,
            parsed.forceProvider,
          );
          for await (const evt of runRefinement({
            prompt: parsed.prompt,
            workspaceId: ctx.workspace.id,
            userId: user.id,
            provider,
            workspaceConfig,
            signal: req.signal,
          })) {
            controller.enqueue(encoder.encode(`${JSON.stringify(evt)}\n`));
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream_error";
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: msg })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
