#!/usr/bin/env node
/**
 * Bootstrap del CSM MCP Server. Carga `tsx` para ejecutar `src/mcp/cli.ts`
 * con resolución de paths (`@/`) y TS-runtime sin compilación previa.
 *
 * Uso típico (Claude Desktop / Cursor):
 *   node bin/csm-mcp.mjs
 * con `DATABASE_URL` + `CSM_API_KEY` en `env`.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const tsxBin =
  process.platform === "win32"
    ? join(root, "node_modules", ".bin", "tsx.cmd")
    : join(root, "node_modules", ".bin", "tsx");

const cliPath = join(root, "src", "mcp", "cli.ts");

if (!existsSync(tsxBin)) {
  process.stderr.write(
    `[csm-mcp] tsx no encontrado en ${tsxBin}. Ejecuta \`npm install\` en ${root}.\n`,
  );
  process.exit(1);
}

const child = spawn(tsxBin, [cliPath], {
  stdio: "inherit",
  env: process.env,
  // En Windows, .cmd requiere shell para que el wrapper bat funcione.
  shell: process.platform === "win32",
  cwd: root,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
