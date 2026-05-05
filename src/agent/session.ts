import type { McpSession } from "@/mcp/auth";

/**
 * Crea una sesión MCP "in-product" que no pasa por API key. La usa el agente
 * editorial dentro del admin (`/admin/agente`) para reusar las mismas tools
 * que el MCP server expone a clientes externos.
 *
 * - `apiKeyId` queda como sentinel `"agent:<userId>"` para que cualquier
 *   audit log lo pueda distinguir.
 * - `scopes` siempre incluye `mcp:any` porque el caller ya pasó por
 *   `requireWorkspace(role)` con permisos de admin/editor.
 * - `directActorId` apunta al user real → audit log queda trazable.
 */
export function buildAgentSession(args: {
  workspaceId: string;
  userId: string;
}): McpSession {
  return {
    apiKeyId: `agent:${args.userId}`,
    workspaceId: args.workspaceId,
    scopes: ["mcp:any"],
    environment: "live",
    directActorId: args.userId,
  };
}
