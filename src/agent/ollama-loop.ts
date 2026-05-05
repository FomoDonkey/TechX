/**
 * Loop de tool-use para modelos locales via Ollama.
 *
 * Ollama soporta tool-calling en modelos compatibles (llama3.2, qwen2.5,
 * mistral-nemo, etc.) usando formato OpenAI. Este módulo es el equivalente
 * a `loop.ts` (Anthropic) pero hablando NDJSON-OpenAI con `localhost:11434`.
 *
 * Mismos eventos `AgentEvent`, misma signature `runAgentOllama` para que
 * el route handler decida en runtime cuál usar según el provider activo.
 *
 * Caveats:
 *  - Calidad de tool-calling en modelos locales <70b puede ser inferior
 *    a Claude/GPT — los tools se llaman correctamente pero el modelo
 *    puede ser menos consistente con la conversación.
 *  - El streaming de tool_calls en Ollama llega en un solo chunk
 *    (no parcial) — emitimos el `tool_call` cuando llega ese mensaje.
 */

import type { AgentEvent, AgentMessage } from "@/agent/loop";
import type { McpSession } from "@/mcp/auth";
import { buildAllTools } from "@/mcp/tools";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const MAX_ITER = 6;

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
• page_create — crear página vacía
• page_apply_template — crear página desde una plantilla espectacular
  (asme, jack, michael, mint, nimbus, securify, magazine, substack)
• page_update — cambiar título, path, status, isHome, SEO
• page_update_block — editar props de un bloque (textos, vídeos, items)
• page_remove_block — quitar un bloque del árbol
• page_publish — publicar (status='published')
• page_delete — borrar (require confirm con título exacto)
• template_list · template_get — catálogo y detalle de plantillas

Reglas:
1. Responde SIEMPRE en español, conciso, tono profesional cercano.
2. Antes de mutar confirma brevemente qué vas a hacer.
3. Si falla por scope o validación, explica el motivo y propón alternativa.
4. Si no necesitas tools, contesta sin invocar nada.
5. Tras una mutación, devuelve un resumen de una línea + id y editorUrl.

PATRÓN para "créame una página de X":
1. template_list (filtra por categoría) → recomienda plantilla.
2. Confirma con el usuario.
3. page_apply_template → page_update_block para personalizar.
4. (opcional) page_publish.

NO inventes ids, slugs ni datos de tools. Llama a la tool antes si no estás seguro.`;

type OpenAiToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OllamaMessage =
  | { role: "system"; content: string }
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
      tool_calls?: Array<{
        id?: string;
        type?: "function";
        function: { name: string; arguments: Record<string, unknown> | string };
      }>;
    }
  | {
      role: "tool";
      content: string;
      tool_call_id?: string;
    };

function buildOpenAiTools(session: McpSession): {
  defs: OpenAiToolDef[];
  byName: Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>;
} {
  const tools = buildAllTools(session);
  const byName = new Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>();
  const defs: OpenAiToolDef[] = tools.map((t) => {
    byName.set(t.name, t.handler);
    const shape = t.config.inputSchema ?? {};
    const wrapped = z.object(shape as z.ZodRawShape);
    const schema = zodToJsonSchema(wrapped, {
      $refStrategy: "none",
      target: "openApi3",
    }) as Record<string, unknown>;
    if (!("type" in schema)) (schema as { type: string }).type = "object";
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.config.description,
        parameters: schema,
      },
    };
  });
  return { defs, byName };
}

/**
 * Convierte el historial AgentMessage (formato Anthropic) a formato Ollama/OpenAI.
 * - assistant blocks de tool_use → assistant.tool_calls
 * - user.tool_result → tool message
 */
function toOllamaMessages(messages: AgentMessage[]): OllamaMessage[] {
  const out: OllamaMessage[] = [];
  out.push({ role: "system", content: SYSTEM_PROMPT });
  for (const m of messages) {
    if (m.role === "user") {
      if (typeof m.content === "string") {
        out.push({ role: "user", content: m.content });
      } else {
        // Array of tool_result
        for (const block of m.content) {
          out.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
        }
      }
    } else {
      // assistant: array of text/tool_use
      const blocks = m.content;
      const textParts = blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text);
      const toolUses = blocks.filter((b) => b.type === "tool_use") as Array<{
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;
      if (toolUses.length > 0) {
        out.push({
          role: "assistant",
          content: textParts.join(""),
          tool_calls: toolUses.map((tu) => ({
            id: tu.id,
            type: "function",
            function: { name: tu.name, arguments: tu.input },
          })),
        });
      } else {
        out.push({ role: "assistant", content: textParts.join("") });
      }
    }
  }
  return out;
}

function stringifyResult(r: CallToolResult): string {
  return r.content
    .map((b) => {
      if (b.type === "text") return b.text;
      return JSON.stringify(b);
    })
    .join("\n");
}

export async function* runAgentOllama(args: {
  session: McpSession;
  messages: AgentMessage[];
  signal?: AbortSignal;
  /** Endpoint Ollama, ej. `http://localhost:11434`. Sin slash final. */
  baseUrl: string;
  /** Modelo, ej. `llama3.2`, `qwen2.5:14b`, `mistral-nemo`. */
  model: string;
}): AsyncGenerator<AgentEvent, void, undefined> {
  const { defs, byName } = buildOpenAiTools(args.session);
  const messages: AgentMessage[] = [...args.messages];
  const baseUrl = args.baseUrl.replace(/\/+$/, "");

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const ollamaMsgs = toOllamaMessages(messages);
    const requestBody = {
      model: args.model,
      stream: true,
      messages: ollamaMsgs,
      tools: defs,
      options: { temperature: 0.4 },
    };

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: args.signal,
      });
    } catch (e) {
      yield {
        type: "error",
        message: `No se pudo conectar a Ollama (${baseUrl}): ${
          e instanceof Error ? e.message : "fetch_failed"
        }. ¿Está corriendo \`ollama serve\`?`,
      };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield {
        type: "error",
        message: `Ollama ${res.status}: ${text.slice(0, 200) || "sin body"}. Comprueba que el modelo \`${args.model}\` esté descargado (\`ollama pull ${args.model}\`).`,
      };
      return;
    }

    const accumulatedText: string[] = [];
    const accumulatedToolCalls: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];
    let doneReason: string | null = null;

    for await (const chunk of readNdjson(res.body)) {
      const message = (chunk as { message?: OllamaMessage }).message;
      const isDone = (chunk as { done?: boolean }).done === true;
      if (isDone) {
        doneReason = (chunk as { done_reason?: string }).done_reason ?? "stop";
      }
      if (!message) continue;
      // Streaming text content (Ollama envía content por chunks pequeños)
      if (message.role === "assistant" && typeof message.content === "string" && message.content) {
        accumulatedText.push(message.content);
        yield { type: "text", delta: message.content };
      }
      // Tool calls (Ollama típicamente los envía en el último chunk completos)
      const toolCalls = (message as { tool_calls?: Array<unknown> }).tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls as Array<{
          id?: string;
          function?: { name?: string; arguments?: Record<string, unknown> | string };
        }>) {
          const name = tc.function?.name ?? "";
          if (!name) continue;
          let input: Record<string, unknown> = {};
          const rawArgs = tc.function?.arguments;
          if (typeof rawArgs === "string") {
            try {
              input = JSON.parse(rawArgs) as Record<string, unknown>;
            } catch {
              input = {};
            }
          } else if (rawArgs && typeof rawArgs === "object") {
            input = rawArgs as Record<string, unknown>;
          }
          // Generamos id local si Ollama no lo provee.
          const id = tc.id || `tc_${Date.now()}_${accumulatedToolCalls.length}`;
          accumulatedToolCalls.push({ id, name, input });
        }
      }
    }

    // Persistimos el turno del assistant en el historial AgentMessage.
    const assistantBlocks: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    > = [];
    const text = accumulatedText.join("");
    if (text.length > 0) assistantBlocks.push({ type: "text", text });
    for (const tc of accumulatedToolCalls) {
      assistantBlocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: "assistant", content: assistantBlocks });

    // Si no hay tool_calls, la respuesta está completa.
    if (accumulatedToolCalls.length === 0) {
      yield { type: "done", reason: "end" };
      return;
    }

    // Ejecutamos tools y añadimos resultados al historial.
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const tc of accumulatedToolCalls) {
      yield { type: "tool_call", id: tc.id, name: tc.name, input: tc.input };
      const handler = byName.get(tc.name);
      if (!handler) {
        const errMsg = `tool_not_found: ${tc.name}`;
        yield { type: "tool_result", id: tc.id, output: errMsg, isError: true };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: errMsg,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await handler(tc.input);
        const out = stringifyResult(result);
        yield { type: "tool_result", id: tc.id, output: out, isError: result.isError };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: out,
          is_error: result.isError,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "tool_error";
        yield { type: "tool_result", id: tc.id, output: msg, isError: true };
        toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: msg, is_error: true });
      }
    }

    messages.push({ role: "user", content: toolResults });

    // Si Ollama dijo "stop" después de devolver tools, igualmente seguimos a otra
    // iteración para que el modelo procese los resultados. Solo paramos al final
    // del loop (MAX_ITER) o cuando no hay tool_calls.
    if (doneReason === "limit") {
      yield { type: "done", reason: "max_iter" };
      return;
    }
  }

  yield { type: "done", reason: "max_iter" };
}

async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line);
      } catch {
        // skip malformed
      }
    }
  }
  if (buf.trim()) {
    try {
      yield JSON.parse(buf);
    } catch {
      /* skip */
    }
  }
}
