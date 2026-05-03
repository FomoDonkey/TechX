#!/usr/bin/env node
/**
 * CSM CLI — herramienta de línea de comandos para CSM.
 *
 * Comandos:
 *   csm init [name]            Genera scaffold de proyecto consumidor (.env, index.ts)
 *   csm login [profile]        Guarda credenciales en ~/.csmrc
 *   csm logout [profile]       Borra un profile
 *   csm whoami [--profile p]   Info de la API key activa
 *   csm pull schema [--out f]  Descarga schema de colecciones (JSON)
 *   csm push schema <file>     Sube collections schema desde un JSON local
 *   csm export [--type entries|forms|media] [--out file]
 *   csm import <type> <file>   Importa entries/forms desde JSON/CSV
 *   csm gen sdk [--out file]   Genera cliente JS desde OpenAPI
 *   csm gen types [--out file] Genera types TS desde OpenAPI
 *   csm types graphql [--out f] Descarga schema GraphQL como SDL
 *   csm version                Imprime versión
 *   csm help                   Esta ayuda
 *
 * Config (~/.csmrc):
 *   {
 *     "default": "main",
 *     "profiles": {
 *       "main": { "baseUrl": "https://csm.example/api/v1", "apiKey": "csm_live_..." }
 *     }
 *   }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const VERSION = "0.1.0";
const RC_PATH = join(homedir(), ".csmrc");

// ============================================================
// ANSI helpers (no deps)
// ============================================================
const c = {
  reset: "[0m",
  bold: "[1m",
  dim: "[2m",
  red: "[31m",
  green: "[32m",
  yellow: "[33m",
  blue: "[34m",
  magenta: "[35m",
  cyan: "[36m",
};
const noColor = process.env.NO_COLOR || !stdout.isTTY;
const paint = (color, s) => (noColor ? s : `${c[color] ?? ""}${s}${c.reset}`);

const BANNER = `${paint("magenta", "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")}
${paint("magenta", "┃")}  ${paint("bold", "CSM")} · Content Spectacular Machine  ${paint("magenta", "┃")}
${paint("magenta", "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")}`;

// ============================================================
// Config (~/.csmrc)
// ============================================================
function loadRc() {
  if (!existsSync(RC_PATH)) return { default: null, profiles: {} };
  try {
    return JSON.parse(readFileSync(RC_PATH, "utf8"));
  } catch (e) {
    fail(`No se pudo leer ${RC_PATH}: ${e.message}`);
  }
}

function saveRc(rc) {
  writeFileSync(RC_PATH, JSON.stringify(rc, null, 2), { mode: 0o600 });
}

function getProfile(name) {
  const rc = loadRc();
  const profileName = name ?? rc.default;
  if (!profileName) {
    fail("No hay profile configurado. Ejecuta `csm login` primero.");
  }
  const profile = rc.profiles?.[profileName];
  if (!profile) {
    fail(`Profile "${profileName}" no existe en ${RC_PATH}.`);
  }
  return { name: profileName, ...profile };
}

// ============================================================
// HTTP helpers
// ============================================================
async function api(profile, path, init = {}) {
  const url = `${profile.baseUrl.replace(/\/$/, "")}${path}`;
  const headers = {
    authorization: `Bearer ${profile.apiKey}`,
    accept: "application/json",
    ...(init.headers ?? {}),
  };
  if (init.body && !headers["content-type"]) headers["content-type"] = "application/json";
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? text ?? `HTTP ${res.status}`;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return body;
}

// ============================================================
// Tiny argv parser (--key value | --flag | positional)
// ============================================================
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(msg, code = 1) {
  console.error(paint("red", `✗ ${msg}`));
  process.exit(code);
}

function ok(msg) {
  console.log(paint("green", `✓ ${msg}`));
}

function info(msg) {
  console.log(paint("cyan", `ℹ ${msg}`));
}

async function prompt(question, opts = {}) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const a = await rl.question(question);
    if (!a && opts.default !== undefined) return opts.default;
    return a.trim();
  } finally {
    rl.close();
  }
}

// ============================================================
// Commands
// ============================================================

async function cmdHelp() {
  console.log(BANNER);
  console.log("");
  console.log(paint("bold", `csm v${VERSION}`));
  console.log("");
  console.log(`${paint("yellow", "Uso:")}  csm <comando> [opciones]`);
  console.log("");
  console.log(paint("yellow", "Comandos:"));
  const rows = [
    ["init [name]", "Crea un proyecto consumidor con SDK + .env.example"],
    ["login [profile]", "Guarda baseUrl + API key en ~/.csmrc"],
    ["logout [profile]", "Borra un profile guardado"],
    ["whoami [--profile p]", "Info de la API key activa"],
    ["pull schema [--out file]", "Descarga el schema de colecciones a JSON"],
    ["push schema <file>", "Sube schema de colecciones desde JSON"],
    ["export entries|forms|media [--out file]", "Exporta entidades a JSON"],
    ["import entries|forms <file>", "Importa entries/forms desde JSON"],
    ["gen sdk [--out file]", "Genera cliente JS desde OpenAPI (CommonJS)"],
    ["gen types [--out file]", "Genera tipos TypeScript desde OpenAPI"],
    ["types graphql [--out file]", "Descarga el schema GraphQL como SDL"],
    ["version", "Imprime la versión"],
    ["help", "Esta ayuda"],
  ];
  for (const [k, v] of rows) {
    console.log(`  ${paint("cyan", k.padEnd(42))} ${paint("dim", v)}`);
  }
  console.log("");
  console.log(paint("dim", `Config: ${RC_PATH}`));
}

async function cmdVersion() {
  console.log(`csm v${VERSION}`);
}

async function cmdLogin(args) {
  const profileName = args.positional[1] ?? "main";
  console.log(BANNER);
  console.log("");
  info(`Configurando profile "${profileName}"`);
  const baseUrl = await prompt(
    `Base URL del API (incluye /api/v1) [https://csm.example/api/v1]: `,
    { default: "https://csm.example/api/v1" },
  );
  const apiKey = await prompt(`API key (csm_live_… o csm_test_…): `);
  if (!apiKey) fail("API key es obligatoria");

  // Validar la key con un /me
  info("Verificando…");
  try {
    const me = await api({ baseUrl, apiKey }, "/me");
    const meData = me?.data ?? me;
    ok(`Autenticado en workspace ${meData?.workspaceId ?? "—"}`);
  } catch (e) {
    fail(`Validación falló: ${e.message}`);
  }

  const rc = loadRc();
  rc.profiles = rc.profiles ?? {};
  rc.profiles[profileName] = { baseUrl, apiKey };
  if (!rc.default) rc.default = profileName;
  saveRc(rc);
  ok(`Guardado en ${RC_PATH} (perms 600)`);
}

async function cmdLogout(args) {
  const name = args.positional[1] ?? "main";
  const rc = loadRc();
  if (!rc.profiles?.[name]) fail(`Profile "${name}" no existe`);
  delete rc.profiles[name];
  if (rc.default === name) {
    const remaining = Object.keys(rc.profiles ?? {});
    rc.default = remaining[0] ?? null;
  }
  saveRc(rc);
  ok(`Profile "${name}" eliminado`);
}

async function cmdWhoami(args) {
  const profile = getProfile(args.flags.profile);
  try {
    const me = await api(profile, "/me");
    const data = me?.data ?? me;
    console.log(paint("bold", `Profile: ${profile.name}`));
    console.log(`  Base URL:    ${profile.baseUrl}`);
    console.log(`  Workspace:   ${data.workspaceId}`);
    console.log(`  API key id:  ${data.apiKeyId}`);
    console.log(`  Environment: ${data.environment}`);
    console.log(`  Scopes:      ${(data.scopes ?? []).join(", ") || "(ninguno)"}`);
  } catch (e) {
    fail(e.message);
  }
}

async function cmdPullSchema(args) {
  const profile = getProfile(args.flags.profile);
  info("Descargando colecciones…");
  const out = args.flags.out ?? "schema.json";
  const list = await api(profile, "/collections");
  const collections = list.data ?? list;
  const detailed = [];
  for (const c of collections) {
    const detail = await api(profile, `/collections/${c.slug}`);
    detailed.push(detail.data ?? detail);
  }
  writeFileSync(out, JSON.stringify(detailed, null, 2));
  ok(`Escrito ${detailed.length} colecciones en ${out}`);
}

async function cmdPushSchema(args) {
  const file = args.positional[2];
  if (!file || !existsSync(file)) fail("Pasa un archivo JSON válido: csm push schema schema.json");
  const profile = getProfile(args.flags.profile);
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data)) fail("El JSON debe ser un array de colecciones");
  info(`F7c v0.1: push schema requiere endpoints PATCH /collections (próximo). Por ahora, ejecuta el push manualmente desde /admin/colecciones.`);
  console.log(paint("dim", `(payload validado: ${data.length} colecciones)`));
}

async function cmdExport(args) {
  const type = args.positional[1] ?? "entries";
  const profile = getProfile(args.flags.profile);
  const out = args.flags.out ?? `${type}.jsonl`;
  if (!["entries", "forms", "media", "menus", "redirects", "automations", "webhooks"].includes(type)) {
    fail(`Tipo no soportado: ${type}`);
  }
  info(`Exportando ${type} → ${out}`);
  const path = `/${type}`;
  let cursor = null;
  let total = 0;
  const lines = [];
  while (true) {
    const url = cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
    const page = await api(profile, url);
    for (const item of page.data ?? []) {
      lines.push(JSON.stringify(item));
      total++;
    }
    if (!page.meta?.hasMore || !page.meta?.nextCursor) break;
    cursor = page.meta.nextCursor;
    process.stdout.write(paint("dim", `  · ${total} registros\r`));
  }
  writeFileSync(out, lines.join("\n"));
  ok(`Exportadas ${total} entidades a ${out}`);
}

async function cmdImport(args) {
  const type = args.positional[1];
  const file = args.positional[2];
  if (!type || !file) fail("Uso: csm import <entries|forms> <file>");
  if (!existsSync(file)) fail(`Archivo no encontrado: ${file}`);
  const profile = getProfile(args.flags.profile);
  const raw = readFileSync(file, "utf8");
  const items = file.endsWith(".jsonl")
    ? raw.split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : (() => {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      })();
  info(`Importando ${items.length} ${type}…`);
  let inserted = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await api(profile, `/${type}`, { method: "POST", body: JSON.stringify(item) });
      inserted++;
    } catch (e) {
      failed++;
      console.error(paint("red", `  ✗ ${e.message}`));
    }
  }
  ok(`Insertadas ${inserted}, fallidas ${failed}`);
}

async function cmdGenSdk(args) {
  const profile = getProfile(args.flags.profile);
  const out = args.flags.out ?? "csm-client.mjs";
  info("Descargando OpenAPI…");
  const spec = await api(profile, "/openapi.json");
  const content = `// Auto-generado por csm gen sdk a partir de OpenAPI ${spec.info?.version ?? ""}
// Endpoints incluidos: ${Object.keys(spec.paths ?? {}).length}
// Regenerar: csm gen sdk
import { createCsmClient } from "@csm/sdk";
export { createCsmClient };
export const BASE_URL = ${JSON.stringify(profile.baseUrl)};
`;
  writeFileSync(out, content);
  ok(`Escrito ${out}`);
}

async function cmdGenTypes(args) {
  const profile = getProfile(args.flags.profile);
  const out = args.flags.out ?? "csm.types.ts";
  info("Descargando OpenAPI…");
  const spec = await api(profile, "/openapi.json");
  // Generación minimalista: extrae nombres de schemas como interface stubs.
  const schemas = spec.components?.schemas ?? {};
  const names = Object.keys(schemas);
  const lines = [
    `// Auto-generado por csm gen types a partir de OpenAPI ${spec.info?.version ?? ""}`,
    `// Para tipos detallados, usa @csm/sdk (que ya está tipado).`,
    "",
  ];
  for (const name of names) {
    lines.push(`export interface ${name.replace(/[^A-Za-z0-9_]/g, "_")} {`);
    const props = schemas[name]?.properties ?? {};
    for (const [k, v] of Object.entries(props)) {
      const tsType = jsonTypeToTs(v);
      lines.push(`  ${k}: ${tsType};`);
    }
    lines.push("}");
    lines.push("");
  }
  writeFileSync(out, lines.join("\n"));
  ok(`Escrito ${out} (${names.length} interfaces)`);
}

function jsonTypeToTs(schema) {
  if (!schema) return "unknown";
  if (Array.isArray(schema.enum)) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  switch (schema.type) {
    case "string":
      return schema.format === "date-time" ? "string" : "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${jsonTypeToTs(schema.items)}[]`;
    case "object":
      if (schema.properties) {
        const inner = Object.entries(schema.properties)
          .map(([k, v]) => `${k}: ${jsonTypeToTs(v)}`)
          .join("; ");
        return `{ ${inner} }`;
      }
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

async function cmdTypesGraphql(args) {
  const profile = getProfile(args.flags.profile);
  const out = args.flags.out ?? "csm.graphql";
  info("Descargando GraphQL schema…");
  const url = `${profile.baseUrl.replace(/\/api\/v1$/, "")}/api/graphql/schema`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${profile.apiKey}` } });
  if (!res.ok) fail(`HTTP ${res.status} al descargar schema`);
  const sdl = await res.text();
  writeFileSync(out, sdl);
  ok(`Escrito ${out} (${sdl.length} bytes)`);
}

async function cmdInit(args) {
  const dirName = args.positional[1] ?? "csm-app";
  if (existsSync(dirName)) fail(`El directorio "${dirName}" ya existe`);
  mkdirSync(dirName);
  console.log(BANNER);
  console.log("");
  info(`Creando proyecto en ${dirName}/`);

  writeFileSync(
    join(dirName, "package.json"),
    JSON.stringify(
      {
        name: dirName,
        version: "0.0.1",
        type: "module",
        scripts: { dev: "node index.mjs" },
        dependencies: {},
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(dirName, ".env.example"),
    `# Configura tu CSM API key y endpoint
CSM_BASE_URL=https://csm.example/api/v1
CSM_API_KEY=csm_test_xxx
`,
  );

  writeFileSync(
    join(dirName, "index.mjs"),
    `import { createCsmClient } from "@csm/sdk";

const csm = createCsmClient({
  baseUrl: process.env.CSM_BASE_URL,
  apiKey: process.env.CSM_API_KEY,
});

const me = await csm.me();
console.log("Conectado a", me.workspaceId);

for await (const entry of csm.entries.iterAll({ status: "published" })) {
  console.log("·", entry.title);
}
`,
  );

  writeFileSync(
    join(dirName, "README.md"),
    `# ${dirName}

Proyecto consumidor de la API de CSM.

## Setup

\`\`\`bash
cp .env.example .env
# Edita .env con tus credenciales
node index.mjs
\`\`\`
`,
  );
  ok(`Proyecto creado. Siguiente paso:`);
  console.log(paint("dim", `  cd ${dirName} && cp .env.example .env && node index.mjs`));
}

// ============================================================
// Dispatch
// ============================================================
const argv = process.argv.slice(2);
const args = parseArgs(argv);
const cmd = args.positional[0];

const handlers = {
  help: cmdHelp,
  "--help": cmdHelp,
  "-h": cmdHelp,
  version: cmdVersion,
  "--version": cmdVersion,
  "-v": cmdVersion,
  init: cmdInit,
  login: cmdLogin,
  logout: cmdLogout,
  whoami: cmdWhoami,
  pull: async (a) => {
    if (a.positional[1] === "schema") return cmdPullSchema(a);
    fail(`Subcomando "pull ${a.positional[1] ?? ""}" no reconocido`);
  },
  push: async (a) => {
    if (a.positional[1] === "schema") return cmdPushSchema(a);
    fail(`Subcomando "push ${a.positional[1] ?? ""}" no reconocido`);
  },
  export: cmdExport,
  import: cmdImport,
  gen: async (a) => {
    if (a.positional[1] === "sdk") return cmdGenSdk(a);
    if (a.positional[1] === "types") return cmdGenTypes(a);
    fail(`Subcomando "gen ${a.positional[1] ?? ""}" no reconocido`);
  },
  types: async (a) => {
    if (a.positional[1] === "graphql") return cmdTypesGraphql(a);
    fail(`Subcomando "types ${a.positional[1] ?? ""}" no reconocido`);
  },
};

if (!cmd) {
  cmdHelp();
  process.exit(0);
}

const handler = handlers[cmd];
if (!handler) {
  fail(`Comando "${cmd}" no reconocido. Ejecuta \`csm help\` para la lista.`);
}

handler(args).catch((e) => {
  fail(e.stack || e.message || String(e));
});
