import { env } from "@/env";
import type { McpSession } from "@/mcp/auth";
import { buildAllTools } from "@/mcp/tools";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Loop de tool-use estilo Anthropic. Toma un session MCP (in-product),
 * convierte tools a definiciones Anthropic y conduce la conversación hasta
 * que el modelo deja de pedir tools y produce el mensaje final.
 *
 * **Diseño:**
 * - Stream basado en eventos JSON. El cliente recibe deltas de texto, anuncios
 *   de tool_use, y resultados de tools — todo en orden cronológico.
 * - Hard-cap de 8 iteraciones (cada iteración = una llamada al modelo) para
 *   evitar bucles infinitos / cost runaway.
 * - Si no hay `ANTHROPIC_API_KEY`, fallback a stub determinista.
 *
 * **Why no AI SDK / no LangChain:** queremos cero magia, control total sobre el
 * stream, y compatibilidad con Vercel Fluid Compute (Web fetch + ReadableStream).
 * Anthropic API directa es ~150 líneas honestas.
 */

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; output: string; isError?: boolean }
  | { type: "done"; reason: "end" | "max_iter" }
  | { type: "error"; message: string };

type Role = "user" | "assistant";
export type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
    }
  | {
      role: "user";
      content: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }>;
    };

const MAX_ITER = 8;
const MODEL = "claude-haiku-4-5-20251001";

type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

/**
 * Convierte los tools del MCP en definiciones Anthropic JSON Schema.
 * `inputSchema` viene como `ZodRawShape` (objeto con campos Zod) — lo envolvemos
 * en `z.object()` antes de pasar por `zodToJsonSchema` para sacar JSON Schema.
 */
function buildAnthropicTools(session: McpSession): {
  defs: AnthropicToolDef[];
  byName: Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>;
} {
  const tools = buildAllTools(session);
  const byName = new Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>();
  const defs: AnthropicToolDef[] = tools.map((t) => {
    byName.set(t.name, t.handler);
    const shape = t.config.inputSchema ?? {};
    const wrapped = z.object(shape as z.ZodRawShape);
    const schema = zodToJsonSchema(wrapped, {
      $refStrategy: "none",
      target: "openApi3",
    }) as Record<string, unknown>;
    // Anthropic exige `type: object` en root; zodToJsonSchema lo suele poner.
    if (!("type" in schema)) (schema as { type: string }).type = "object";
    return {
      name: t.name,
      description: t.config.description,
      input_schema: schema,
    };
  });
  return { defs, byName };
}

const SYSTEM_PROMPT = `Eres el copiloto editorial integrado en CSM, el CMS donde estás operando ahora mismo.

Capacidades disponibles vía tools:

CONTENIDO (entries / posts / blog)
• entry_search · entry_list · entry_get  — buscar y leer entradas
• entry_create · entry_update · entry_publish — crear drafts y publicar
• collection_list · taxonomy_list · branch_list — estructura del contenido
• subscriber_list · media_search — newsletters y DAM
• health_summary · entry_health_scan — diagnóstico de SEO/links

PÁGINAS Y PLANTILLAS ESPECTACULARES
• page_list · page_get — listar y leer páginas estáticas
• page_create — crear página vacía (para layouts custom)
• page_apply_template — crear página desde una plantilla espectacular
  (asme, jack, michael, mint, nimbus, securify, magazine, substack)
  Ej: { templateId: "agency-spotlight", title: "Estudio Vela" }
• page_update — cambiar título, path, status, isHome, SEO
• page_update_block — editar props de un bloque (textos, vídeos, items)
  Flujo típico: page_get → identificas el blockId → page_update_block con propsPatch
• page_remove_block — quitar un bloque del árbol
• page_publish — publicar (status='published')
• page_delete — borrar (require confirm con título exacto)
• template_list · template_get — catálogo y detalle de plantillas

WORKSPACE
• workspace_info — locale, timezone, plan activo

Reglas:
1. Responde SIEMPRE en español, conciso, tono profesional cercano.
2. Antes de mutar (crear/actualizar/publicar/borrar) confirma brevemente lo que vas a hacer en una frase.
3. Si una operación falla por scope o validación, explica al usuario el motivo y propón alternativa.
4. Si no necesitas tools, contesta directamente sin invocar nada.
5. Para fechas relativas ("mañana a las 9"), pregunta la zona horaria sólo si workspace_info no la tiene.
6. Tras una mutación, devuelve un resumen de una línea + el id y editorUrl de la entrada/página.

PATRÓN para "créame una página de X":
1. template_list (filtra por categoría) — encuentra la plantilla más adecuada.
2. Confirma con el usuario qué plantilla vas a usar.
3. page_apply_template con templateId + title.
4. (opcional) page_get para ver los blockIds.
5. (opcional) page_update_block para personalizar textos según pidió el usuario.
6. (opcional) page_publish si pidió publicación inmediata.

NO inventes ids, slugs ni datos de tools que no existen. Si no estás seguro, llama a la tool antes.`;

export async function* runAgent(args: {
  session: McpSession;
  messages: AgentMessage[];
  signal?: AbortSignal;
  /**
   * Si está, override de credenciales por workspace (de
   * `/admin/ajustes/ia` → tabla `ai_provider_configs`). Tiene prioridad
   * sobre `ANTHROPIC_API_KEY` env.
   */
  workspaceConfig?: { apiKey: string; model?: string };
}): AsyncGenerator<AgentEvent, void, undefined> {
  const apiKey = args.workspaceConfig?.apiKey || env.ANTHROPIC_API_KEY;
  const model = args.workspaceConfig?.model || MODEL;
  if (!apiKey) {
    // Mock determinista — útil en local sin clave.
    yield* mockAgent(args.messages);
    return;
  }

  const { defs, byName } = buildAnthropicTools(args.session);

  // Conversación que vamos extendiendo en cada iteración.
  const messages: AgentMessage[] = [...args.messages];

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const requestBody = {
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: defs,
      messages: messages.map(serializeMessage),
      stream: true,
    };

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: args.signal,
      });
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : "fetch_failed" };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: `Anthropic ${res.status}: ${text.slice(0, 200)}` };
      return;
    }

    // Acumulamos los content blocks de la respuesta para añadirla a la conversación
    // y, si hay tool_use, ejecutarlos antes de la siguiente iteración.
    const assistantBlocks: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    > = [];
    let stopReason: "end_turn" | "tool_use" | "max_tokens" | "unknown" = "unknown";

    // Per-block state durante el streaming SSE.
    const blocks: Map<
      number,
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; partialJson: string }
    > = new Map();

    for await (const evt of readAnthropicSse(res.body)) {
      if (evt.type === "content_block_start") {
        const idx = evt.index;
        if (evt.content_block.type === "text") {
          blocks.set(idx, { type: "text", text: "" });
        } else if (evt.content_block.type === "tool_use") {
          blocks.set(idx, {
            type: "tool_use",
            id: evt.content_block.id,
            name: evt.content_block.name,
            partialJson: "",
          });
        }
      } else if (evt.type === "content_block_delta") {
        const block = blocks.get(evt.index);
        if (!block) continue;
        if (evt.delta.type === "text_delta" && block.type === "text") {
          block.text += evt.delta.text;
          yield { type: "text", delta: evt.delta.text };
        } else if (evt.delta.type === "input_json_delta" && block.type === "tool_use") {
          block.partialJson += evt.delta.partial_json;
        }
      } else if (evt.type === "content_block_stop") {
        const block = blocks.get(evt.index);
        if (!block) continue;
        if (block.type === "text") {
          assistantBlocks.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          let input: Record<string, unknown> = {};
          if (block.partialJson.trim()) {
            try {
              input = JSON.parse(block.partialJson) as Record<string, unknown>;
            } catch {
              input = {};
            }
          }
          assistantBlocks.push({ type: "tool_use", id: block.id, name: block.name, input });
        }
      } else if (evt.type === "message_delta") {
        if (evt.delta.stop_reason) stopReason = evt.delta.stop_reason;
      }
    }

    // Persiste el turno del assistant en la conversación.
    messages.push({ role: "assistant", content: assistantBlocks });

    // Si no pidió tools, terminamos.
    const toolUses = assistantBlocks.filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use",
    );
    if (toolUses.length === 0 || stopReason === "end_turn" || stopReason === "max_tokens") {
      yield { type: "done", reason: "end" };
      return;
    }

    // Ejecuta tools en paralelo y emite eventos al cliente.
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const tu of toolUses) {
      yield { type: "tool_call", id: tu.id, name: tu.name, input: tu.input };
      const handler = byName.get(tu.name);
      if (!handler) {
        const errMsg = `tool_not_found: ${tu.name}`;
        yield { type: "tool_result", id: tu.id, output: errMsg, isError: true };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: errMsg,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await handler(tu.input);
        const text = stringifyResult(result);
        yield { type: "tool_result", id: tu.id, output: text, isError: result.isError };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: text,
          is_error: result.isError,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "tool_error";
        yield { type: "tool_result", id: tu.id, output: msg, isError: true };
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: msg, is_error: true });
      }
    }

    // Añade los resultados como mensaje del user para el siguiente turno.
    messages.push({ role: "user", content: toolResults });
  }

  yield { type: "done", reason: "max_iter" };
}

function stringifyResult(r: CallToolResult): string {
  return r.content
    .map((b) => {
      if (b.type === "text") return b.text;
      return JSON.stringify(b);
    })
    .join("\n");
}

function serializeMessage(m: AgentMessage): { role: Role; content: unknown } {
  return { role: m.role, content: m.content };
}

// ============================================================
// SSE parser específico para Anthropic
// ============================================================

type AnthropicEvent =
  | { type: "message_start"; message: { id: string } }
  | {
      type: "content_block_start";
      index: number;
      content_block:
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
    }
  | {
      type: "content_block_delta";
      index: number;
      delta:
        | { type: "text_delta"; text: string }
        | { type: "input_json_delta"; partial_json: string };
    }
  | { type: "content_block_stop"; index: number }
  | {
      type: "message_delta";
      delta: { stop_reason?: "end_turn" | "tool_use" | "max_tokens" | "unknown" };
    }
  | { type: "message_stop" }
  | { type: "ping" }
  | { type: "error"; error: { type: string; message: string } };

async function* readAnthropicSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AnthropicEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx = buf.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLines = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      const payload = dataLines.join("");
      if (payload && payload !== "[DONE]") {
        try {
          yield JSON.parse(payload) as AnthropicEvent;
        } catch {
          // skip malformed
        }
      }
      idx = buf.indexOf("\n\n");
    }
  }
}

// ============================================================
// Mock fallback (sin Anthropic key)
// ============================================================
async function* mockAgent(messages: AgentMessage[]): AsyncGenerator<AgentEvent, void, undefined> {
  const last = messages[messages.length - 1];
  const userText =
    last && last.role === "user" && typeof last.content === "string" ? last.content : "tu mensaje";
  const reply = `Estoy en modo mock (no hay ANTHROPIC_API_KEY configurada). Tu mensaje fue: "${userText.slice(0, 200)}". Configura ANTHROPIC_API_KEY en .env para chatear de verdad.`;
  for (const ch of reply.match(/.{1,12}/g) ?? []) {
    yield { type: "text", delta: ch };
    await new Promise((r) => setTimeout(r, 30));
  }
  yield { type: "done", reason: "end" };
}
