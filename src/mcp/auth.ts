import { hasScope, verifyKey } from "@/api/keys";

export type McpSession = {
  apiKeyId: string;
  workspaceId: string;
  scopes: string[];
  environment: "live" | "test";
  /**
   * Si está presente, las tools que necesiten un actor para audit log lo
   * usarán directamente sin caer al fallback (creator de la key → owner).
   * Útil para el agente in-product, que tiene cookie de usuario real.
   */
  directActorId?: string;
};

/**
 * Resuelve una sesión MCP desde una API key. Reusa el verificador del
 * REST API (`verifyKey`) para que las mismas keys con scope `mcp:*` o
 * scopes específicos (`entries:read`, etc.) sirvan para el MCP server.
 */
export async function resolveSession(apiKey: string): Promise<McpSession> {
  const result = await verifyKey(apiKey);
  if (!result.ok) {
    throw new Error(`Auth failed: ${result.reason}`);
  }
  return {
    apiKeyId: result.apiKey.id,
    workspaceId: result.apiKey.workspaceId,
    scopes: result.apiKey.scopes,
    environment: result.apiKey.environment,
  };
}

/**
 * Asegura que la sesión tenga al menos uno de los scopes requeridos.
 * Acepta un array — basta con que UNO de ellos esté concedido.
 *
 * Convención CSM: el scope `mcp:*` (o `*`) abre todas las operaciones MCP.
 * Para keys más restrictivas, usa scopes específicos (`entries:write`).
 */
export function ensureScope(session: McpSession, anyOf: string[]): void {
  if (anyOf.length === 0) return;
  // mcp:* o * abren todo lo MCP automáticamente.
  if (hasScope(session.scopes, "mcp:any") || hasScope(session.scopes, "*:*")) return;
  for (const s of anyOf) {
    if (hasScope(session.scopes, s)) return;
  }
  throw new Error(`Scope insuficiente. La key necesita uno de: ${anyOf.join(", ")} (o mcp:any).`);
}
