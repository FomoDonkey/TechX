import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveSession } from "./auth";
import { buildAllTools } from "./tools";

/**
 * Builder del servidor MCP de CSM. Recibe una API key, resuelve workspace y
 * scopes, y registra los ~12 tools.
 *
 * **Diseño:**
 * - Una instancia por sesión (cada conexión de cliente).
 * - El SDK gestiona stdio/sse/streamable-http internamente; este builder es
 *   transport-agnostic.
 * - Los tools se construyen con la `session` cerrada en closure → cero state
 *   global, multi-tenant safe.
 */
export async function buildMcpServer(args: { apiKey: string }): Promise<McpServer> {
  const session = await resolveSession(args.apiKey);

  const server = new McpServer(
    {
      name: "csm-mcp",
      version: "0.1.0",
      title: "CSM — Content Spectacular Machine",
    },
    {
      instructions: [
        "Eres un copiloto editorial conectado al CMS CSM. Puedes:",
        "• Buscar y leer entradas con `entry_search`, `entry_list`, `entry_get`.",
        "• Crear drafts con `entry_create` y editarlos con `entry_update` (incluye `bodyMarkdown`).",
        "• Publicar con `entry_publish` (idempotente).",
        "• Listar colecciones, taxonomías, branches, suscriptores y medios.",
        "Respeta siempre el idioma del workspace (suele ser español). Devuelve resúmenes claros tras cada operación.",
      ].join("\n"),
    },
  );

  for (const tool of buildAllTools(session)) {
    server.registerTool(tool.name, tool.config, tool.handler);
  }

  return server;
}
