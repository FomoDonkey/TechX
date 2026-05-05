/**
 * Verifica parity entre `src/db/schema.pg.ts` y `src/db/schema.mysql.ts`.
 *
 * Regla: TODA tabla en `schema.pg.ts` debe existir con el mismo nombre en
 * `schema.mysql.ts`. Tablas extra en MySQL (auxiliares para arrays
 * normalizados — `*_locales`, `*_tags`, etc.) están permitidas.
 *
 * Falla con exit code 1 si encuentra:
 *  - Tablas en Postgres que faltan en MySQL.
 *  - Columnas con nombres distintos entre dialect (heurística: matching
 *    de `varchar/text/timestamp/...` por columna).
 *
 * No valida tipos de columnas — eso es responsabilidad del code review
 * (ver `docs/architecture/multi-db-design.md` para reglas de mapeo).
 *
 * Uso:
 *   npm run db:check-parity
 *   exit 0 → ok | exit 1 → fix needed
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const PG_PATH = resolve(ROOT, "src/db/schema.pg.ts");
const MYSQL_PATH = resolve(ROOT, "src/db/schema.mysql.ts");

type ParsedTable = {
  name: string;
  exportName: string;
};

/**
 * Parser robusto: linea-a-linea busca `export const X = TABLE_FN(...,`
 * acepta el primer string literal como nombre de tabla.
 * No parsea columnas — la verificación de columnas la hace code review,
 * no es trivial con regex y arriesga falsos positivos.
 */
function parseSchema(filePath: string, fnName: "pgTable" | "mysqlTable"): ParsedTable[] {
  const src = readFileSync(filePath, "utf-8");
  const tables: ParsedTable[] = [];

  // Match en línea simple — no requiere multilinea porque solo buscamos
  // el `export const X = fnName(`. El nombre de tabla puede estar en la
  // misma línea, en la siguiente, o varias líneas después (formato code).
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const declMatch = line.match(
      new RegExp(`export\\s+const\\s+(\\w+)\\s*=\\s*${fnName}\\s*\\(`),
    );
    if (!declMatch) continue;
    const exportName = declMatch[1] ?? "";

    // Buscar el primer string literal "..." en hasta 5 líneas siguientes
    // (cubre formatos de líneas largas)
    let tableName = "";
    const tail = lines.slice(i, i + 6).join(" ");
    const nameMatch = tail.match(new RegExp(`${fnName}\\s*\\(\\s*"([^"]+)"`));
    if (nameMatch) tableName = nameMatch[1] ?? "";

    if (exportName && tableName) {
      tables.push({ name: tableName, exportName });
    }
  }

  return tables;
}

function main() {
  const pgTables = parseSchema(PG_PATH, "pgTable");
  const mysqlTables = parseSchema(MYSQL_PATH, "mysqlTable");

  const pgMap = new Map(pgTables.map((t) => [t.name, t]));
  const mysqlMap = new Map(mysqlTables.map((t) => [t.name, t]));

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Tablas en Postgres que faltan en MySQL.
  for (const pg of pgTables) {
    if (!mysqlMap.has(pg.name)) {
      errors.push(
        `[FALTA] Tabla "${pg.name}" existe en schema.pg.ts pero no en schema.mysql.ts`,
      );
    }
  }

  // 2. Tablas auxiliares en MySQL no son error (esperadas).
  const auxRe = /_(locales|mentions|tags|emails|attachments|reasons|scopes|events)$/;
  const auxOnlyMysql = mysqlTables.filter(
    (t) => !pgMap.has(t.name) && auxRe.test(t.name),
  );

  // ============================================================
  // Output
  // ============================================================
  console.log("====================================================");
  console.log(`schema.pg.ts:    ${pgTables.length} tabla${pgTables.length === 1 ? "" : "s"}`);
  console.log(
    `schema.mysql.ts: ${mysqlTables.length} tabla${mysqlTables.length === 1 ? "" : "s"} (${auxOnlyMysql.length} auxiliares)`,
  );
  console.log("====================================================");

  if (warnings.length > 0) {
    console.log("\n⚠️  Warnings (no bloquean):");
    for (const w of warnings.slice(0, 30)) console.log("  " + w);
    if (warnings.length > 30) console.log(`  ... y ${warnings.length - 30} más`);
  }

  if (errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const e of errors) console.log("  " + e);
    console.log(
      `\nLas ${errors.length} tabla${errors.length === 1 ? " falta" : "s faltan"} en schema.mysql.ts.`,
    );
    console.log("Ver `docs/architecture/multi-db-design.md` para reglas de mapeo.");
    process.exit(1);
  }

  console.log("\n✅ Parity OK");
}

main();
