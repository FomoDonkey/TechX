#!/usr/bin/env node
// scripts/f1-setup.mjs
// Setup completo del dataset F1 en un solo comando:
//   1. Clona toUpperCase78/formula1-datasets en data/formula1 si no existe
//      (o hace pull si ya está). Usa --depth 1 para evitar 100+MB de history.
//   2. Ejecuta sync-f1-data.mjs para regenerar src/blocks/spectacular/f1-data.ts
//      desde los CSVs del dataset.
//   3. Imprime un resumen verificable.
//
// Uso:  npm run f1:setup
// Idempotente — puedes ejecutarlo cuantas veces quieras.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, "data");
const DATASET_DIR = resolve(DATA_DIR, "formula1");
const DATASET_REPO = "https://github.com/toUpperCase78/formula1-datasets.git";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) {
    console.error(`\n✗ El comando "${cmd} ${args.join(" ")}" falló con código ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

console.log("┌─────────────────────────────────────────────");
console.log("│ CSM · F1 dataset setup");
console.log("└─────────────────────────────────────────────\n");

// 1. Clonar o pull del dataset
if (existsSync(DATASET_DIR)) {
  console.log(`✓ Dataset ya existe en ${DATASET_DIR}`);
  console.log("  → git pull para actualizar...");
  run("git", ["-C", DATASET_DIR, "pull", "--ff-only"]);
} else {
  console.log(`→ Clonando dataset en ${DATASET_DIR}...`);
  if (!existsSync(DATA_DIR)) {
    run("node", ["-e", `require('fs').mkdirSync(${JSON.stringify(DATA_DIR)},{recursive:true})`]);
  }
  run("git", ["clone", "--depth", "1", DATASET_REPO, DATASET_DIR]);
}

// 2. Regenerar f1-data.ts
console.log("\n→ Regenerando src/blocks/spectacular/f1-data.ts...\n");
run("node", [resolve(__dirname, "sync-f1-data.mjs")]);

// 3. Resumen
console.log("\n┌─────────────────────────────────────────────");
console.log("│ ✓ F1 dataset listo");
console.log("├─────────────────────────────────────────────");
console.log("│ Siguiente paso: aplica la plantilla en /admin/plantillas");
console.log("│   1. Login en /admin");
console.log("│   2. Filtro categoría 'Deportes'");
console.log("│   3. Click en 'F1 Grand Prix — Inmersivo'");
console.log("│   4. 'Usar esta plantilla' → publicar");
console.log("└─────────────────────────────────────────────\n");
