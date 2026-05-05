import { type AgentMessage, runAgent } from "@/agent/loop";
import { runAgentOllama } from "@/agent/ollama-loop";
import { buildAgentSession } from "@/agent/session";
import { getAiProviderConfig } from "@/ai/keys";
import { getCurrentUser } from "@/auth/server";
import { currentWorkspace } from "@/lib/workspace";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint del agente editorial in-product. Recibe la conversación, ejecuta
 * el loop de tool-use y stream-ea eventos JSON-line al cliente.
 *
 * **Formato de respuesta:** newline-delimited JSON (ND-JSON). Cada línea es
 * un `AgentEvent`. Más simple que SSE para el cliente (`for-await` sobre lines).
 *
 * **Auth:** cookie de sesión + workspace activo + role >= editor.
 */

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.union([
          z.string(),
          z.array(
            z.union([
              z.object({ type: z.literal("text"), text: z.string() }),
              z.object({
                type: z.literal("tool_use"),
                id: z.string(),
                name: z.string(),
                input: z.record(z.unknown()),
              }),
              z.object({
                type: z.literal("tool_result"),
                tool_use_id: z.string(),
                content: z.string(),
                is_error: z.boolean().optional(),
              }),
            ]),
          ),
        ]),
      }),
    )
    .min(1)
    .max(60),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await currentWorkspace();
  if (!ctx) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "editor") {
    return NextResponse.json({ error: "role_insufficient" }, { status: 403 });
  }

  let body: { messages: AgentMessage[] };
  try {
    const raw = await req.json();
    const parsed = RequestSchema.parse(raw);
    body = parsed as { messages: AgentMessage[] };
  } catch (e) {
    return NextResponse.json(
      { error: "bad_request", message: e instanceof Error ? e.message : "invalid" },
      { status: 400 },
    );
  }

  const session = buildAgentSession({ workspaceId: ctx.workspace.id, userId: user.id });

  // Detecta el provider activo del workspace y elige el loop adecuado:
  //  - "ollama" → runAgentOllama con baseUrl + model del workspace
  //  - cualquier otro (anthropic, default) → runAgent (Anthropic API)
  // Si Anthropic no tiene key configurada en /admin/ajustes/ia, runAgent
  // cae a env.ANTHROPIC_API_KEY o mock.
  const activeProvider = ctx.workspace.aiProvider ?? "anthropic";
  const useOllama = activeProvider === "ollama";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const events = useOllama
          ? await streamOllama(ctx.workspace.id, session, body.messages, req.signal)
          : await streamAnthropic(ctx.workspace.id, session, body.messages, req.signal);
        for await (const evt of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(evt)}\n`));
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

// ============================================================
// Helpers para resolver provider config + crear el AsyncIterable
// ============================================================
async function streamAnthropic(
  workspaceId: string,
  session: ReturnType<typeof buildAgentSession>,
  messages: AgentMessage[],
  signal: AbortSignal,
) {
  const ws = await getAiProviderConfig(workspaceId, "anthropic");
  const workspaceConfig =
    ws?.enabled && ws.apiKey ? { apiKey: ws.apiKey, model: ws.model || undefined } : undefined;
  return runAgent({ session, messages, signal, workspaceConfig });
}

async function streamOllama(
  workspaceId: string,
  session: ReturnType<typeof buildAgentSession>,
  messages: AgentMessage[],
  signal: AbortSignal,
) {
  const ws = await getAiProviderConfig(workspaceId, "ollama");
  const baseUrl = ws?.baseUrl || process.env.OLLAMA_URL || "http://localhost:11434";
  const model = ws?.model || process.env.OLLAMA_MODEL || "llama3.2";
  return runAgentOllama({ session, messages, signal, baseUrl, model });
}
