import { buildMcpServer } from "@/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP Streamable HTTP endpoint para clientes remotos (Cursor, IDEs, web apps).
 *
 * **Auth:** API key via header `Authorization: Bearer csm_live_xxx` (o `csm_test_xxx`).
 * El scope mínimo es `mcp:any`. Las keys con scopes específicos (`entries:read`)
 * sólo activan los tools correspondientes.
 *
 * **Modo:** stateless — cada POST construye un servidor nuevo. Apto para Vercel
 * Fluid Compute (instancias compartidas reusan código pero no estado MCP entre
 * requests). Para resumibilidad real con SSE largo, ampliar a sessionful + EventStore
 * en F10d.
 *
 * **Compat:** GET (SSE legacy) deshabilitado de momento — basta con POST + JSON.
 */
async function handle(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing_api_key", hint: "Authorization: Bearer csm_live_xxx" },
      { status: 401 },
    );
  }

  let server: Awaited<ReturnType<typeof buildMcpServer>>;
  try {
    server = await buildMcpServer({ apiKey });
  } catch (e) {
    return NextResponse.json(
      { error: "auth_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 401 },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: sin sessionIdGenerator → cada request es independiente.
    enableJsonResponse: true,
    // DNS rebinding protection: si fueras a exponer fuera del origen del CMS,
    // pasar `allowedHosts: [new URL(env.NEXT_PUBLIC_APP_URL).host]`.
  });

  await server.connect(transport);
  const response = await transport.handleRequest(req);
  // El transporte cierra la conexión cuando termina; no hace falta hacer cleanup.
  return response;
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}
