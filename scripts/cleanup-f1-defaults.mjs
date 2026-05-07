// scripts/cleanup-f1-defaults.mjs
// Reemplaza los DEFAULT_* arrays hardcoded por slices del dataset f1-data.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "../src/blocks/spectacular/f1-grand-prix-sections.tsx");

let txt = readFileSync(FILE, "utf8");

// Función: reemplaza un bloque desde "const NAME ... = [" hasta el "];" siguiente
// (con balanceo simple de [ ]).
function replaceBlock(src, declStartRegex, replacement) {
  const m = declStartRegex.exec(src);
  if (!m) {
    console.warn("No match for:", declStartRegex);
    return src;
  }
  const start = m.index;
  // Encuentra el primer "[" tras el match
  const afterDecl = src.indexOf("[", start + m[0].length);
  if (afterDecl === -1) return src;
  // Balancea brackets respetando strings.
  let depth = 0;
  let inStr = null;
  let escape = false;
  let end = afterDecl;
  for (let i = afterDecl; i < src.length; i++) {
    const c = src[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (inStr) {
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  // Buscamos el ; siguiente
  let stop = end + 1;
  while (stop < src.length && src[stop] !== ";") stop++;
  stop++; // incluye el ;
  return src.slice(0, start) + replacement + src.slice(stop);
}

// 1. DEFAULT_DRIVERS (incluye también el legacy _LEGACY_KEEP que dejé)
txt = replaceBlock(
  txt,
  /\/\/ Top 10 pilotos.*\nconst DEFAULT_DRIVERS: Driver\[\] = F1_DRIVERS_2025\.slice\(0, 10\);\s*\n\s*\nconst _LEGACY_KEEP: Driver\[\] =/s,
  `// Top 10 pilotos del dataset oficial 2025 (carreras totales puntos).
// Para mostrar los 21 inscritos: edita el bloque y pega F1_DRIVERS_2025 completo.
const DEFAULT_DRIVERS: Driver[] = F1_DRIVERS_2025.slice(0, 10);`,
);

// 2. DEFAULT_TEAMS
txt = replaceBlock(
  txt,
  /const DEFAULT_TEAMS: Team\[\] =/s,
  `// Los 10 equipos oficiales 2025 (dataset).
const DEFAULT_TEAMS: Team[] = F1_TEAMS_2025;`,
);

// 3. DEFAULT_RACES
txt = replaceBlock(
  txt,
  /const DEFAULT_RACES: Race\[\] =/s,
  `// 6 GPs destacados del calendario 2025 (calendario completo en F1_CALENDAR_2025).
const DEFAULT_RACES: Race[] = F1_CALENDAR_2025
  .filter((r) =>
    [
      "Monaco",
      "Spain",
      "Italy",
      "Great Britain",
      "Belgium",
      "United Arab Emirates",
    ].includes(r.country),
  )
  .slice(0, 6)
  .map((r) => ({
    round: r.round,
    date: r.date,
    gpName: r.gpName,
    country: r.country,
    countryFlag: r.countryFlag,
    city: r.city,
    circuit: r.circuit,
    laps: r.laps,
    lengthKm: r.lengthKm,
    lapRecord: r.lapRecord,
    recordHolder: r.recordHolder,
  }));`,
);

// 4. DEFAULT_STANDINGS_DRIVERS
txt = replaceBlock(
  txt,
  /const DEFAULT_STANDINGS_DRIVERS: Driver\[\] =/s,
  `// Clasificación 2025 derivada de los resultados reales por carrera (dataset).
const DEFAULT_STANDINGS_DRIVERS: Driver[] = F1_DRIVER_STANDINGS_2025
  .slice(0, 10)
  .map((d) => {
    // Buscamos info extendida del piloto en el roster (bandera, abbrev, etc.).
    const full = F1_DRIVERS_2025.find((p) => p.name === d.name);
    return {
      name: d.name,
      abbrev: full?.abbrev ?? d.name.split(" ").map((s) => s[0]).join("").slice(0, 3).toUpperCase(),
      number: d.number,
      team: d.team,
      country: full?.country ?? "",
      countryFlag: full?.countryFlag ?? "🏁",
      points: d.points,
      podiums: d.podiums,
      championships: full?.championships ?? 0,
      color: d.color,
    };
  });`,
);

// 5. DEFAULT_CONSTRUCTORS_STANDINGS
txt = replaceBlock(
  txt,
  /const DEFAULT_CONSTRUCTORS_STANDINGS =/s,
  `// Clasificación constructores 2025 derivada de race results (dataset).
const DEFAULT_CONSTRUCTORS_STANDINGS = F1_TEAM_STANDINGS_2025;`,
);

// 6. DEFAULT_TRACKS — derivar del calendar 2025 (tiene turns/drsZones/firstGP)
txt = replaceBlock(
  txt,
  /const DEFAULT_TRACKS =/s,
  `// 8 circuitos legendarios del calendario 2025 (todos en F1_CALENDAR_2025).
const DEFAULT_TRACKS = F1_CALENDAR_2025
  .filter((r) =>
    [
      "Monaco",
      "Belgium",
      "Great Britain",
      "Italy",
      "Japan",
      "Brazil",
      "Spain",
      "United Arab Emirates",
    ].includes(r.country),
  )
  .slice(0, 8)
  .map((r) => ({
    name: r.circuit.replace(/^Circuit (de |of )?/i, "").replace(/Autodromo (Nazionale|Internazionale Enzo e Dino Ferrari) /i, ""),
    country: r.country,
    countryFlag: r.countryFlag,
    city: r.city,
    lengthKm: r.lengthKm,
    turns: r.turns,
    drsZones: r.drsZones,
    firstGP: r.firstGP,
  }));`,
);

writeFileSync(FILE, txt, "utf8");
console.log("Cleaned. New file size:", txt.length, "chars");
