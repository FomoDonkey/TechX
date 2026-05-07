#!/usr/bin/env node
// scripts/sync-f1-data.mjs
// Lee los CSVs del dataset toUpperCase78/formula1-datasets y genera
// `src/blocks/spectacular/f1-data.ts` con datos hardcoded.
// Run: node scripts/sync-f1-data.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA = resolve(ROOT, "data/formula1");
const OUT = resolve(ROOT, "src/blocks/spectacular/f1-data.ts");

// ---- CSV parser mínimo (respeta comillas) ----
function parseCSV(text) {
  const lines = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "\n" && !inQ) {
      lines.push(cur);
      cur = "";
      continue;
    }
    if (c === "\r") continue;
    cur += c;
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cols = splitRow(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = (cols[i] ?? "").trim()));
    return obj;
  });
}
function splitRow(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}
function readCSV(name) {
  const p = resolve(DATA, name);
  if (!existsSync(p)) return [];
  return parseCSV(readFileSync(p, "utf8"));
}

// ---- Mapeo equipos → color (estándar de marca) ----
const TEAM_COLORS = {
  McLaren: "#FF8000",
  "McLaren Mercedes": "#FF8000",
  Mercedes: "#27F4D2",
  Ferrari: "#DC0000",
  "Scuderia Ferrari HP": "#DC0000",
  "Red Bull Racing": "#1E3A8A",
  "Red Bull Racing Honda RBPT": "#1E3A8A",
  Williams: "#64C4FF",
  "Williams Mercedes": "#64C4FF",
  "Aston Martin": "#229971",
  "Aston Martin Aramco Mercedes": "#229971",
  "Kick Sauber": "#52E252",
  "Kick Sauber Ferrari": "#52E252",
  Sauber: "#52E252",
  "Racing Bulls": "#6692FF",
  "RB Honda RBPT": "#6692FF",
  "Visa Cash App RB Honda RBPT": "#6692FF",
  Haas: "#B6BABD",
  "Haas Ferrari": "#B6BABD",
  Alpine: "#0093CC",
  "Alpine Renault": "#0093CC",
};
function teamColor(name) {
  if (!name) return "#FFFFFF";
  // Match shortest
  for (const k of Object.keys(TEAM_COLORS)) {
    if (name.includes(k)) return TEAM_COLORS[k];
  }
  return "#FFFFFF";
}

// ---- Mapeo país → emoji bandera ----
const COUNTRY_FLAGS = {
  Australia: "🇦🇺",
  China: "🇨🇳",
  Japan: "🇯🇵",
  Bahrain: "🇧🇭",
  "Saudi Arabia": "🇸🇦",
  "United States": "🇺🇸",
  USA: "🇺🇸",
  Italy: "🇮🇹",
  Monaco: "🇲🇨",
  Spain: "🇪🇸",
  Canada: "🇨🇦",
  Austria: "🇦🇹",
  "Great Britain": "🇬🇧",
  "United Kingdom": "🇬🇧",
  Belgium: "🇧🇪",
  Hungary: "🇭🇺",
  Netherlands: "🇳🇱",
  Azerbaijan: "🇦🇿",
  Singapore: "🇸🇬",
  Mexico: "🇲🇽",
  Brazil: "🇧🇷",
  Qatar: "🇶🇦",
  "United Arab Emirates": "🇦🇪",
  UAE: "🇦🇪",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Thailand: "🇹🇭",
  Italia: "🇮🇹",
  España: "🇪🇸",
  "Países Bajos": "🇳🇱",
  "Reino Unido": "🇬🇧",
  Mónaco: "🇲🇨",
  Mexico_: "🇲🇽",
};
function flag(country) {
  if (!country) return "🏁";
  return COUNTRY_FLAGS[country] ?? "🏁";
}

// ---- Drivers (2025) ----
const drivers2025Raw = readCSV("Formula1_2025Season_Drivers.csv");
const drivers2025 = drivers2025Raw.map((d) => ({
  name: d.Driver,
  abbrev: d.Abbreviation,
  number: parseInt(d["Race Number"], 10) || 0,
  team: d.Team,
  country: d.Country,
  countryFlag: flag(d.Country),
  points: parseFloat(d["Career Points"]) || 0,
  podiums: parseInt(d.Podiums, 10) || 0,
  championships: parseInt(d["World Championships"], 10) || 0,
  color: teamColor(d.Team),
}));

// ---- Teams (2025) ----
const teams2025Raw = readCSV("Formula1_2025Season_Teams.csv");
const teams2025 = teams2025Raw.map((t) => ({
  name: t.Team,
  fullName: t["Full Team Name"],
  base: t.Base,
  championships: parseInt(t["World Championships"], 10) || 0,
  points: parseFloat(t["Team Points"]) || 0,
  color: teamColor(t.Team),
}));

// ---- Calendar (2025) ----
const calRaw = readCSV("Formula1_2025Season_Calendar.csv");
const calendar2025 = calRaw.map((r) => ({
  round: parseInt(r.Round, 10) || 0,
  date: r["Race Date"],
  gpName: r["GP Name"],
  country: r.Country,
  countryFlag: flag(r.Country),
  city: r.City,
  circuit: r["Circuit Name"],
  laps: parseInt(r["Number of Laps"], 10) || 0,
  lengthKm: parseFloat(r["Circuit Length(km)"]) || 0,
  raceDistanceKm: parseFloat(r["Race Distance(km)"]) || 0,
  lapRecord: r["Lap Record"],
  recordHolder: r["Record Owner"],
  recordYear: parseInt(r["Record Year"], 10) || 0,
  turns: parseInt(r.Turns, 10) || 0,
  drsZones: parseInt(r["DRS Zones"], 10) || 0,
  firstGP: parseInt(r["First GP"], 10) || 0,
}));

// ---- Race results (2025) — agrupar por carrera, ordenar por posición ----
const raceResults2025 = readCSV("Formula1_2025Season_RaceResults.csv");
function summarizeStandings(results) {
  const drivers = new Map();
  const teams = new Map();
  for (const r of results) {
    const pos = parseInt(r.Position, 10);
    if (!Number.isFinite(pos)) continue;
    const pts = parseFloat(r.Points) || 0;
    const dKey = `${r.Driver}|${r.No}`;
    if (!drivers.has(dKey)) {
      drivers.set(dKey, {
        name: r.Driver,
        number: parseInt(r.No, 10) || 0,
        team: r.Team,
        wins: 0,
        podiums: 0,
        points: 0,
        color: teamColor(r.Team),
      });
    }
    const d = drivers.get(dKey);
    d.points += pts;
    if (pos === 1) d.wins += 1;
    if (pos <= 3) d.podiums += 1;

    const tKey = r.Team;
    if (!teams.has(tKey)) {
      teams.set(tKey, { name: r.Team, points: 0, wins: 0, color: teamColor(r.Team) });
    }
    const t = teams.get(tKey);
    t.points += pts;
    if (pos === 1) t.wins += 1;
  }
  // Ordenar por puntos desc
  const driverArr = [...drivers.values()].sort((a, b) => b.points - a.points);
  const teamArr = [...teams.values()].sort((a, b) => b.points - a.points);
  return { driverArr, teamArr };
}

const standings2025 = summarizeStandings(raceResults2025);
const standings2026 = summarizeStandings(readCSV("Formula1_2026Season_RaceResults.csv"));
const standings2024 = summarizeStandings(readCSV("Formula1_2024season_raceResults.csv"));
const standings2023 = summarizeStandings(readCSV("Formula1_2023season_raceResults.csv"));
const standings2022 = summarizeStandings(readCSV("Formula1_2022season_raceResults.csv"));

// Campeón = primer driver / primer team de cada standings sorted
function championOf(season) {
  return {
    driver: season.driverArr[0]?.name ?? "—",
    driverTeam: season.driverArr[0]?.team ?? "",
    driverPoints: season.driverArr[0]?.points ?? 0,
    driverWins: season.driverArr[0]?.wins ?? 0,
    driverColor: season.driverArr[0]?.color ?? "#FFFFFF",
    constructor: season.teamArr[0]?.name ?? "—",
    constructorPoints: season.teamArr[0]?.points ?? 0,
    constructorWins: season.teamArr[0]?.wins ?? 0,
    constructorColor: season.teamArr[0]?.color ?? "#FFFFFF",
  };
}

const champions = [
  { year: 2022, ...championOf(standings2022) },
  { year: 2023, ...championOf(standings2023) },
  { year: 2024, ...championOf(standings2024) },
];

// ---- Last race podium (última con datos en 2025) ----
function lastRacePodium(results) {
  if (results.length === 0) return null;
  // Agrupar por Track manteniendo orden
  const byTrack = new Map();
  for (const r of results) {
    if (!byTrack.has(r.Track)) byTrack.set(r.Track, []);
    byTrack.get(r.Track).push(r);
  }
  const tracks = [...byTrack.keys()];
  const lastTrack = tracks[tracks.length - 1];
  const rows = (byTrack.get(lastTrack) ?? []).filter((x) => parseInt(x.Position, 10));
  rows.sort((a, b) => parseInt(a.Position, 10) - parseInt(b.Position, 10));
  return {
    track: lastTrack,
    podium: rows.slice(0, 3).map((r) => ({
      pos: parseInt(r.Position, 10) || 0,
      driver: r.Driver,
      team: r.Team,
      number: parseInt(r.No, 10) || 0,
      time: r["Time/Retired"],
      points: parseInt(r.Points, 10) || 0,
      color: teamColor(r.Team),
    })),
  };
}

const lastRace2025 = lastRacePodium(raceResults2025);
const lastRace2026 = lastRacePodium(readCSV("Formula1_2026Season_RaceResults.csv"));

// ---- DOTD top votes (agregar % medio por driver) ----
const dotd2025 = readCSV("Formula1_2025Season_DriverOfTheDayVotes.csv");
function aggregateDOTD(rows) {
  const m = new Map();
  for (const r of rows) {
    for (const place of ["1st", "2nd", "3rd", "4th", "5th"]) {
      const drv = r[`${place} Place`];
      const pct = parseFloat(r[`${place} Place(%)`]) || 0;
      if (!drv) continue;
      if (!m.has(drv)) m.set(drv, { name: drv, votes: 0, races: 0, wins: 0 });
      const d = m.get(drv);
      d.votes += pct;
      d.races += 1;
      if (place === "1st") d.wins += 1;
    }
  }
  return [...m.values()].sort((a, b) => b.wins - a.wins || b.votes - a.votes).slice(0, 10);
}
const dotdAgg = aggregateDOTD(dotd2025);

// ---- 2026 Drivers (de 2026 Season Drivers folder, pero como CSV no existe, derivamos) ----
// Intentamos derivar de RaceResults 2026 únicos.
const drivers2026 = (() => {
  const m = new Map();
  for (const r of readCSV("Formula1_2026Season_RaceResults.csv")) {
    const k = r.Driver;
    if (!k || m.has(k)) continue;
    m.set(k, { name: r.Driver, team: r.Team, number: parseInt(r.No, 10) || 0, color: teamColor(r.Team) });
  }
  return [...m.values()];
})();

// ---- Genera output TS ----
function ts(value) {
  return JSON.stringify(value, null, 2);
}

const output = `// AUTO-GENERATED por scripts/sync-f1-data.mjs · NO editar a mano.
// Fuente: data/formula1/ (toUpperCase78/formula1-datasets).
// Para regenerar: node scripts/sync-f1-data.mjs

export type F1Driver = {
  name: string;
  abbrev: string;
  number: number;
  team: string;
  country: string;
  countryFlag: string;
  points: number;
  podiums: number;
  championships: number;
  color: string;
};

export type F1Team = {
  name: string;
  fullName: string;
  base: string;
  championships: number;
  points: number;
  color: string;
};

export type F1Race = {
  round: number;
  date: string;
  gpName: string;
  country: string;
  countryFlag: string;
  city: string;
  circuit: string;
  laps: number;
  lengthKm: number;
  raceDistanceKm: number;
  lapRecord: string;
  recordHolder: string;
  recordYear: number;
  turns: number;
  drsZones: number;
  firstGP: number;
};

export type F1StandingsDriver = {
  name: string;
  number: number;
  team: string;
  wins: number;
  podiums: number;
  points: number;
  color: string;
};

export type F1StandingsTeam = {
  name: string;
  points: number;
  wins: number;
  color: string;
};

export type F1Podium = {
  pos: number;
  driver: string;
  team: string;
  number: number;
  time: string;
  points: number;
  color: string;
};

export type F1LastRace = {
  track: string;
  podium: F1Podium[];
};

export type F1DotdEntry = {
  name: string;
  votes: number;
  races: number;
  wins: number;
};

export type F1Driver2026 = {
  name: string;
  team: string;
  number: number;
  color: string;
};

export type F1Champion = {
  year: number;
  driver: string;
  driverTeam: string;
  driverPoints: number;
  driverWins: number;
  driverColor: string;
  constructor: string;
  constructorPoints: number;
  constructorWins: number;
  constructorColor: string;
};

export const F1_DRIVERS_2025: F1Driver[] = ${ts(drivers2025)};

export const F1_TEAMS_2025: F1Team[] = ${ts(teams2025)};

export const F1_CALENDAR_2025: F1Race[] = ${ts(calendar2025)};

export const F1_DRIVER_STANDINGS_2025: F1StandingsDriver[] = ${ts(standings2025.driverArr)};

export const F1_TEAM_STANDINGS_2025: F1StandingsTeam[] = ${ts(standings2025.teamArr)};

export const F1_LAST_RACE_2025: F1LastRace | null = ${ts(lastRace2025)};

export const F1_DOTD_2025: F1DotdEntry[] = ${ts(dotdAgg)};

export const F1_DRIVERS_2026: F1Driver2026[] = ${ts(drivers2026)};

export const F1_DRIVER_STANDINGS_2026: F1StandingsDriver[] = ${ts(standings2026.driverArr)};

export const F1_TEAM_STANDINGS_2026: F1StandingsTeam[] = ${ts(standings2026.teamArr)};

export const F1_LAST_RACE_2026: F1LastRace | null = ${ts(lastRace2026)};

export const F1_CHAMPIONS_HISTORY: F1Champion[] = ${ts(champions)};
`;

writeFileSync(OUT, output, "utf8");
console.log("Wrote " + OUT);
console.log("  Drivers 2025:   " + drivers2025.length);
console.log("  Teams 2025:     " + teams2025.length);
console.log("  Calendar 2025:  " + calendar2025.length + " GPs");
console.log("  Standings 2025: " + standings2025.driverArr.length + " drivers / " + standings2025.teamArr.length + " teams");
console.log("  DOTD entries:   " + dotdAgg.length);
console.log("  Drivers 2026:   " + drivers2026.length);
console.log("  Standings 2026: " + standings2026.driverArr.length + " drivers / " + standings2026.teamArr.length + " teams");
console.log("  Last race 2025: " + (lastRace2025?.track ?? "n/a"));
console.log("  Last race 2026: " + (lastRace2026?.track ?? "n/a"));
console.log("  Champions:      " + champions.map((c) => c.year + ":" + c.driver).join(" · "));
