#!/usr/bin/env -S npx tsx
/**
 * CSM MCP Server — entry point para stdio (Claude Desktop, Cursor local).
 *
 * Uso desde un cliente MCP:
 * ```json
 * {
 *   "mcpServers": {
 *     "csm": {
 *       "command": "node",
 *       "args": ["/path/to/csm/bin/csm-mcp.mjs"],
 *       "env": {
 *         "DATABASE_URL": "postgresql://...",
 *         "CSM_API_KEY": "csm_live_...",
 *         "AUTH_SECRET": "..."
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * Variables de entorno requeridas:
 * - `DATABASE_URL`  — Postgres con schema CSM aplicado.
 * - `CSM_API_KEY`   — API key del workspace con scope `mcp:any` (o `*`).
 * - `AUTH_SECRET`   — sólo para validar internamente env (mismo que la app).
 *
 * También respeta `CSM_API_KEY_FILE` para leer la key desde un archivo (útil
 * en sandbox/CI). Si ambas están definidas gana `CSM_API_KEY`.
 */

import { readFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server";

function readKey(): string {
  const direct = process.env.CSM_API_KEY?.trim();
  if (direct) return direct;
  const file = process.env.CSM_API_KEY_FILE?.trim();
  if (file) {
    try {
      return readFileSync(file, "utf8").trim();
    } catch {
      throw new Error(`No se pudo leer CSM_API_KEY_FILE: ${file}`);
    }
  }
  throw new Error(
    "Falta CSM_API_KEY (o CSM_API_KEY_FILE). Crea una key en /admin/api-keys con scope `mcp:any`.",
  );
}

async function main() {
  const apiKey = readKey();
  const server = await buildMcpServer({ apiKey });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Mantener el proceso vivo. El SDK gestiona ciclos de vida.
  // Logs van a stderr para no contaminar el stream MCP (stdout).
  process.stderr.write("[csm-mcp] listo · stdio transport conectado\n");
}

main().catch((err) => {
  process.stderr.write(`[csm-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
