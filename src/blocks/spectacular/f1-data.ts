// AUTO-GENERATED por scripts/sync-f1-data.mjs · NO editar a mano.
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

export const F1_DRIVERS_2025: F1Driver[] = [
  {
    "name": "Lando Norris",
    "abbrev": "NOR",
    "number": 4,
    "team": "McLaren",
    "country": "United Kingdom",
    "countryFlag": "🇬🇧",
    "points": 1430,
    "podiums": 44,
    "championships": 1,
    "color": "#FF8000"
  },
  {
    "name": "Oscar Piastri",
    "abbrev": "PIA",
    "number": 81,
    "team": "McLaren",
    "country": "Australia",
    "countryFlag": "🇦🇺",
    "points": 799,
    "podiums": 26,
    "championships": 0,
    "color": "#FF8000"
  },
  {
    "name": "George Russell",
    "abbrev": "RUS",
    "number": 63,
    "team": "Mercedes",
    "country": "United Kingdom",
    "countryFlag": "🇬🇧",
    "points": 1033,
    "podiums": 24,
    "championships": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Kimi Antonelli",
    "abbrev": "ANT",
    "number": 12,
    "team": "Mercedes",
    "country": "Italy",
    "countryFlag": "🇮🇹",
    "points": 150,
    "podiums": 3,
    "championships": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Max Verstappen",
    "abbrev": "VER",
    "number": 1,
    "team": "Red Bull Racing",
    "country": "Netherlands",
    "countryFlag": "🇳🇱",
    "points": 3444.5,
    "podiums": 127,
    "championships": 4,
    "color": "#1E3A8A"
  },
  {
    "name": "Yuki Tsunoda",
    "abbrev": "TSU",
    "number": 22,
    "team": "Red Bull Racing",
    "country": "Japan",
    "countryFlag": "🇯🇵",
    "points": 124,
    "podiums": 0,
    "championships": 0,
    "color": "#1E3A8A"
  },
  {
    "name": "Charles Leclerc",
    "abbrev": "LEC",
    "number": 16,
    "team": "Ferrari",
    "country": "Monaco",
    "countryFlag": "🇲🇨",
    "points": 1672,
    "podiums": 50,
    "championships": 0,
    "color": "#DC0000"
  },
  {
    "name": "Lewis Hamilton",
    "abbrev": "HAM",
    "number": 44,
    "team": "Ferrari",
    "country": "United Kingdom",
    "countryFlag": "🇬🇧",
    "points": 5018.5,
    "podiums": 202,
    "championships": 7,
    "color": "#DC0000"
  },
  {
    "name": "Alexander Albon",
    "abbrev": "ALB",
    "number": 23,
    "team": "Williams",
    "country": "Thailand",
    "countryFlag": "🇹🇭",
    "points": 313,
    "podiums": 2,
    "championships": 0,
    "color": "#64C4FF"
  },
  {
    "name": "Carlos Sainz",
    "abbrev": "SAI",
    "number": 55,
    "team": "Williams",
    "country": "Spain",
    "countryFlag": "🇪🇸",
    "points": 1336.5,
    "podiums": 29,
    "championships": 0,
    "color": "#64C4FF"
  },
  {
    "name": "Liam Lawson",
    "abbrev": "LAW",
    "number": 30,
    "team": "Racing Bulls",
    "country": "New Zealand",
    "countryFlag": "🏁",
    "points": 44,
    "podiums": 0,
    "championships": 0,
    "color": "#6692FF"
  },
  {
    "name": "Isack Hajdar",
    "abbrev": "HAD",
    "number": 6,
    "team": "Racing Bulls",
    "country": "France",
    "countryFlag": "🇫🇷",
    "points": 51,
    "podiums": 1,
    "championships": 0,
    "color": "#6692FF"
  },
  {
    "name": "Lance Stroll",
    "abbrev": "STR",
    "number": 18,
    "team": "Aston Martin",
    "country": "Canada",
    "countryFlag": "🇨🇦",
    "points": 325,
    "podiums": 3,
    "championships": 0,
    "color": "#229971"
  },
  {
    "name": "Fernando Alonso",
    "abbrev": "ALO",
    "number": 14,
    "team": "Aston Martin",
    "country": "Spain",
    "countryFlag": "🇪🇸",
    "points": 2393,
    "podiums": 106,
    "championships": 2,
    "color": "#229971"
  },
  {
    "name": "Esteban Ocon",
    "abbrev": "OCO",
    "number": 31,
    "team": "Haas",
    "country": "France",
    "countryFlag": "🇫🇷",
    "points": 483,
    "podiums": 4,
    "championships": 0,
    "color": "#B6BABD"
  },
  {
    "name": "Oliver Bearman",
    "abbrev": "BEA",
    "number": 87,
    "team": "Haas",
    "country": "United Kingdom",
    "countryFlag": "🇬🇧",
    "points": 48,
    "podiums": 0,
    "championships": 0,
    "color": "#B6BABD"
  },
  {
    "name": "Nico Hulkenberg",
    "abbrev": "HUL",
    "number": 27,
    "team": "Kick Sauber",
    "country": "Germany",
    "countryFlag": "🇩🇪",
    "points": 622,
    "podiums": 1,
    "championships": 0,
    "color": "#52E252"
  },
  {
    "name": "Gabriel Bortoleto",
    "abbrev": "BOR",
    "number": 5,
    "team": "Kick Sauber",
    "country": "Brazil",
    "countryFlag": "🇧🇷",
    "points": 19,
    "podiums": 0,
    "championships": 0,
    "color": "#52E252"
  },
  {
    "name": "Pierre Gasly",
    "abbrev": "GAS",
    "number": 10,
    "team": "Alpine",
    "country": "France",
    "countryFlag": "🇫🇷",
    "points": 458,
    "podiums": 5,
    "championships": 0,
    "color": "#0093CC"
  },
  {
    "name": "Franco Colapinto",
    "abbrev": "COL",
    "number": 43,
    "team": "Alpine",
    "country": "Argentina",
    "countryFlag": "🏁",
    "points": 5,
    "podiums": 0,
    "championships": 0,
    "color": "#0093CC"
  },
  {
    "name": "Jack Doohan",
    "abbrev": "DOO",
    "number": 7,
    "team": "Alpine",
    "country": "Australia",
    "countryFlag": "🇦🇺",
    "points": 0,
    "podiums": 0,
    "championships": 0,
    "color": "#0093CC"
  }
];

export const F1_TEAMS_2025: F1Team[] = [
  {
    "name": "McLaren",
    "fullName": "McLaren Formula 1 Team",
    "base": "Woking",
    "championships": 177,
    "points": 995,
    "color": "#FF8000"
  },
  {
    "name": "Mercedes",
    "fullName": "Mercedes-AMG Petronas Formula One Team",
    "base": "Brackley",
    "championships": 135,
    "points": 329,
    "color": "#27F4D2"
  },
  {
    "name": "Red Bull Racing",
    "fullName": "Oracle Red Bull Racing",
    "base": "Milton Keynes",
    "championships": 111,
    "points": 418,
    "color": "#1E3A8A"
  },
  {
    "name": "Ferrari",
    "fullName": "Scuderia Ferrari HP",
    "base": "Maranello",
    "championships": 254,
    "points": 1123,
    "color": "#DC0000"
  },
  {
    "name": "Williams",
    "fullName": "Atlassian Williams Racing",
    "base": "Grove",
    "championships": 128,
    "points": 851,
    "color": "#64C4FF"
  },
  {
    "name": "Racing Bulls",
    "fullName": "Visa Cash App Racing Bulls Formula One Team",
    "base": "Faenza",
    "championships": 1,
    "points": 399,
    "color": "#6692FF"
  },
  {
    "name": "Aston Martin",
    "fullName": "Aston Martin Aramco Formula One Team",
    "base": "Silverstone",
    "championships": 1,
    "points": 152,
    "color": "#229971"
  },
  {
    "name": "Haas F1 Team",
    "fullName": "MoneyGram Haas F1 Team",
    "base": "Kannapolis",
    "championships": 1,
    "points": 214,
    "color": "#B6BABD"
  },
  {
    "name": "Kick Sauber",
    "fullName": "Stake F1 Team Kick Sauber",
    "base": "Hinwil",
    "championships": 1,
    "points": 615,
    "color": "#52E252"
  },
  {
    "name": "Alpine",
    "fullName": "BWT Alpine Formula One Team",
    "base": "Enstone",
    "championships": 20,
    "points": 392,
    "color": "#0093CC"
  }
];

export const F1_CALENDAR_2025: F1Race[] = [
  {
    "round": 1,
    "date": "16/03/2025",
    "gpName": "Louis Vuitton Australian Grand Prix",
    "country": "Australia",
    "countryFlag": "🇦🇺",
    "city": "Melbourne",
    "circuit": "Albert Park Circuit",
    "laps": 58,
    "lengthKm": 5.278,
    "raceDistanceKm": 306.124,
    "lapRecord": "1:19.813",
    "recordHolder": "Charles Leclerc",
    "recordYear": 2024,
    "turns": 14,
    "drsZones": 4,
    "firstGP": 1996
  },
  {
    "round": 2,
    "date": "23/03/2025",
    "gpName": "Heineken Chinese Grand Prix",
    "country": "China",
    "countryFlag": "🇨🇳",
    "city": "Shanghai",
    "circuit": "Shanghai International Circuit",
    "laps": 56,
    "lengthKm": 5.451,
    "raceDistanceKm": 305.066,
    "lapRecord": "1:32.238",
    "recordHolder": "Michael Schumacter",
    "recordYear": 2004,
    "turns": 16,
    "drsZones": 2,
    "firstGP": 2004
  },
  {
    "round": 3,
    "date": "06/04/2025",
    "gpName": "Lenovo Japanese Grand Prix",
    "country": "Japan",
    "countryFlag": "🇯🇵",
    "city": "Suzuka",
    "circuit": "Suzuka Circuit",
    "laps": 53,
    "lengthKm": 5.807,
    "raceDistanceKm": 307.471,
    "lapRecord": "1:30.965",
    "recordHolder": "Kimi Antonelli",
    "recordYear": 2025,
    "turns": 18,
    "drsZones": 1,
    "firstGP": 1987
  },
  {
    "round": 4,
    "date": "13/04/2025",
    "gpName": "Gulf Air Bahrain Grand Prix",
    "country": "Bahrain",
    "countryFlag": "🇧🇭",
    "city": "Sakhir",
    "circuit": "Bahrain International Circuit",
    "laps": 57,
    "lengthKm": 5.412,
    "raceDistanceKm": 308.238,
    "lapRecord": "1:31.447",
    "recordHolder": "Pedro de la Rosa",
    "recordYear": 2005,
    "turns": 15,
    "drsZones": 3,
    "firstGP": 2004
  },
  {
    "round": 5,
    "date": "20/04/2025",
    "gpName": "STC Saudi Arabian Grand Prix",
    "country": "Saudi Arabia",
    "countryFlag": "🇸🇦",
    "city": "Jeddah",
    "circuit": "Jeddah Corniche Circuit",
    "laps": 50,
    "lengthKm": 6.174,
    "raceDistanceKm": 308.45,
    "lapRecord": "1:30.734",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2021,
    "turns": 27,
    "drsZones": 3,
    "firstGP": 2021
  },
  {
    "round": 6,
    "date": "04/05/2025",
    "gpName": "Crypto.com Miami Grand Prix",
    "country": "United States",
    "countryFlag": "🇺🇸",
    "city": "Miami",
    "circuit": "Miami International Autodrome",
    "laps": 57,
    "lengthKm": 5.412,
    "raceDistanceKm": 308.326,
    "lapRecord": "1:29.708",
    "recordHolder": "Max Verstappen",
    "recordYear": 2023,
    "turns": 19,
    "drsZones": 3,
    "firstGP": 2022
  },
  {
    "round": 7,
    "date": "18/05/2025",
    "gpName": "AWS Gran Premio Del Made in Italy e Dell'Emilia-Romagna",
    "country": "Italy",
    "countryFlag": "🇮🇹",
    "city": "Imola",
    "circuit": "Autodromo Internazionale Enzo e Dino Ferrari",
    "laps": 63,
    "lengthKm": 4.909,
    "raceDistanceKm": 309.049,
    "lapRecord": "1:15.484",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2020,
    "turns": 19,
    "drsZones": 1,
    "firstGP": 1980
  },
  {
    "round": 8,
    "date": "25/05/2025",
    "gpName": "Tag Heuer Grand Prix de Monaco",
    "country": "Monaco",
    "countryFlag": "🇲🇨",
    "city": "Monaco",
    "circuit": "Circuit de Monaco",
    "laps": 78,
    "lengthKm": 3.337,
    "raceDistanceKm": 260.286,
    "lapRecord": "1:12.909",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2021,
    "turns": 19,
    "drsZones": 1,
    "firstGP": 1950
  },
  {
    "round": 9,
    "date": "01/06/2025",
    "gpName": "Aramco Gran Premio de España",
    "country": "Spain",
    "countryFlag": "🇪🇸",
    "city": "Barcelona",
    "circuit": "Circuit de Barcelona-Catalunya",
    "laps": 66,
    "lengthKm": 4.657,
    "raceDistanceKm": 307.236,
    "lapRecord": "1:15.743",
    "recordHolder": "Oscar Piastri",
    "recordYear": 2025,
    "turns": 14,
    "drsZones": 2,
    "firstGP": 1991
  },
  {
    "round": 10,
    "date": "15/06/2025",
    "gpName": "Pirelli Grand Prix du Canada",
    "country": "Canada",
    "countryFlag": "🇨🇦",
    "city": "Montréal",
    "circuit": "Circuit Gilles-Villeneuve",
    "laps": 70,
    "lengthKm": 4.361,
    "raceDistanceKm": 305.27,
    "lapRecord": "1:13.078",
    "recordHolder": "Valtteri Bottas",
    "recordYear": 2019,
    "turns": 14,
    "drsZones": 3,
    "firstGP": 1978
  },
  {
    "round": 11,
    "date": "29/06/2029",
    "gpName": "MSC Cruises Austrian Grand Prix",
    "country": "Austria",
    "countryFlag": "🇦🇹",
    "city": "Spielberg",
    "circuit": "Red Bull Ring",
    "laps": 71,
    "lengthKm": 4.326,
    "raceDistanceKm": 307.018,
    "lapRecord": "1:07.924",
    "recordHolder": "Oscar Piastri",
    "recordYear": 2025,
    "turns": 10,
    "drsZones": 3,
    "firstGP": 1970
  },
  {
    "round": 12,
    "date": "06/07/2025",
    "gpName": "Qatar Airways British Grand Prix",
    "country": "Great Britain",
    "countryFlag": "🇬🇧",
    "city": "Silverstone",
    "circuit": "Silverstone Circuit",
    "laps": 52,
    "lengthKm": 5.891,
    "raceDistanceKm": 306.198,
    "lapRecord": "1:27.097",
    "recordHolder": "Max Verstappen",
    "recordYear": 2020,
    "turns": 18,
    "drsZones": 2,
    "firstGP": 1950
  },
  {
    "round": 13,
    "date": "27/07/2025",
    "gpName": "Moet & Chandon Belgian Grand Prix",
    "country": "Belgium",
    "countryFlag": "🇧🇪",
    "city": "Spa-Francorchamps",
    "circuit": "Circuit de Spa-Francorchamps",
    "laps": 44,
    "lengthKm": 7.004,
    "raceDistanceKm": 308.052,
    "lapRecord": "1:44.701",
    "recordHolder": "Sergio Perez",
    "recordYear": 2024,
    "turns": 19,
    "drsZones": 2,
    "firstGP": 1950
  },
  {
    "round": 14,
    "date": "03/08/2025",
    "gpName": "Lenovo Hungarian Grand Prix",
    "country": "Hungary",
    "countryFlag": "🇭🇺",
    "city": "Budapest",
    "circuit": "Hungaroring",
    "laps": 70,
    "lengthKm": 4.381,
    "raceDistanceKm": 306.63,
    "lapRecord": "1:16.627",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2020,
    "turns": 14,
    "drsZones": 2,
    "firstGP": 1986
  },
  {
    "round": 15,
    "date": "31/08/2025",
    "gpName": "Heineken Dutch Grand Prix",
    "country": "Netherlands",
    "countryFlag": "🇳🇱",
    "city": "Zandvoort",
    "circuit": "Circuit Zandvoort",
    "laps": 72,
    "lengthKm": 4.259,
    "raceDistanceKm": 306.587,
    "lapRecord": "1:11.097",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2021,
    "turns": 14,
    "drsZones": 2,
    "firstGP": 1952
  },
  {
    "round": 16,
    "date": "07/09/2025",
    "gpName": "Pirelli Gran Premio D'Italia",
    "country": "Italy",
    "countryFlag": "🇮🇹",
    "city": "Monza",
    "circuit": "Autodromo Nazionale Monza",
    "laps": 53,
    "lengthKm": 5.793,
    "raceDistanceKm": 306.72,
    "lapRecord": "1:20.901",
    "recordHolder": "Lando Norris",
    "recordYear": 2025,
    "turns": 11,
    "drsZones": 2,
    "firstGP": 1950
  },
  {
    "round": 17,
    "date": "21/09/2025",
    "gpName": "Qatar Airways Azerbaijan Grand Prix",
    "country": "Azerbaijan",
    "countryFlag": "🇦🇿",
    "city": "Baku",
    "circuit": "Baku City Circuit",
    "laps": 51,
    "lengthKm": 6.003,
    "raceDistanceKm": 306.049,
    "lapRecord": "1:43.009",
    "recordHolder": "Charles Leclerc",
    "recordYear": 2019,
    "turns": 20,
    "drsZones": 2,
    "firstGP": 2016
  },
  {
    "round": 18,
    "date": "05/10/2025",
    "gpName": "Singapore Airlines Singapore Grand Prix",
    "country": "Singapore",
    "countryFlag": "🇸🇬",
    "city": "Singapore",
    "circuit": "Marina Bay Street Circuit",
    "laps": 62,
    "lengthKm": 4.927,
    "raceDistanceKm": 305.337,
    "lapRecord": "1:33.808",
    "recordHolder": "Lewis Hamilton",
    "recordYear": 2025,
    "turns": 19,
    "drsZones": 4,
    "firstGP": 2008
  },
  {
    "round": 19,
    "date": "19/10/2025",
    "gpName": "MSC Cruises United States Grand Prix",
    "country": "United States",
    "countryFlag": "🇺🇸",
    "city": "Austin",
    "circuit": "Circuit of The Americas",
    "laps": 56,
    "lengthKm": 5.513,
    "raceDistanceKm": 308.405,
    "lapRecord": "1:36.169",
    "recordHolder": "Charles Leclerc",
    "recordYear": 2019,
    "turns": 20,
    "drsZones": 2,
    "firstGP": 2012
  },
  {
    "round": 20,
    "date": "26/10/2025",
    "gpName": "Gran Premio de la Ciudad de México",
    "country": "Mexico",
    "countryFlag": "🇲🇽",
    "city": "Mexico City",
    "circuit": "Autodromo Hermanos Rodriguez",
    "laps": 71,
    "lengthKm": 4.304,
    "raceDistanceKm": 305.354,
    "lapRecord": "1:17.774",
    "recordHolder": "Valtteri Bottas",
    "recordYear": 2021,
    "turns": 17,
    "drsZones": 3,
    "firstGP": 1963
  },
  {
    "round": 21,
    "date": "09/11/2025",
    "gpName": "MSC Cruises Grande Premio de São Paulo",
    "country": "Brazil",
    "countryFlag": "🇧🇷",
    "city": "São Paulo",
    "circuit": "Aurodromo Jose Carlos Pace",
    "laps": 71,
    "lengthKm": 4.309,
    "raceDistanceKm": 305.879,
    "lapRecord": "1:10.540",
    "recordHolder": "Valtteri Bottas",
    "recordYear": 2018,
    "turns": 15,
    "drsZones": 2,
    "firstGP": 1973
  },
  {
    "round": 22,
    "date": "23/11/2025",
    "gpName": "Heineken Las Vegas Grand Prix",
    "country": "United States",
    "countryFlag": "🇺🇸",
    "city": "Las Vegas",
    "circuit": "Las Vegas Strip Circuit",
    "laps": 50,
    "lengthKm": 6.201,
    "raceDistanceKm": 309.958,
    "lapRecord": "1:33.365",
    "recordHolder": "Max Verstappen",
    "recordYear": 2025,
    "turns": 17,
    "drsZones": 2,
    "firstGP": 2023
  },
  {
    "round": 23,
    "date": "30/11/2025",
    "gpName": "Qatar Airways Qatar Grand Prix",
    "country": "Qatar",
    "countryFlag": "🇶🇦",
    "city": "Doha",
    "circuit": "Lusail International Circuit",
    "laps": 57,
    "lengthKm": 5.419,
    "raceDistanceKm": 308.611,
    "lapRecord": "1:22.384",
    "recordHolder": "Lando Norris",
    "recordYear": 2024,
    "turns": 16,
    "drsZones": 1,
    "firstGP": 2021
  },
  {
    "round": 24,
    "date": "07/12/2025",
    "gpName": "Etihad Airways Abu Dhabi Grand Prix",
    "country": "United Arab Emirates",
    "countryFlag": "🇦🇪",
    "city": "Yas Island",
    "circuit": "Yas Marina Circuit",
    "laps": 58,
    "lengthKm": 5.281,
    "raceDistanceKm": 306.183,
    "lapRecord": "1:25.637",
    "recordHolder": "Kevin Magnussen",
    "recordYear": 2024,
    "turns": 16,
    "drsZones": 2,
    "firstGP": 2009
  }
];

export const F1_DRIVER_STANDINGS_2025: F1StandingsDriver[] = [
  {
    "name": "Lando Norris",
    "number": 4,
    "team": "McLaren Mercedes",
    "wins": 7,
    "podiums": 18,
    "points": 394,
    "color": "#FF8000"
  },
  {
    "name": "Max Verstappen",
    "number": 1,
    "team": "Red Bull Racing Honda RBPT",
    "wins": 8,
    "podiums": 15,
    "points": 389,
    "color": "#1E3A8A"
  },
  {
    "name": "Oscar Piastri",
    "number": 81,
    "team": "McLaren Mercedes",
    "wins": 7,
    "podiums": 16,
    "points": 381,
    "color": "#FF8000"
  },
  {
    "name": "George Russell",
    "number": 63,
    "team": "Mercedes",
    "wins": 2,
    "podiums": 9,
    "points": 289,
    "color": "#27F4D2"
  },
  {
    "name": "Charles Leclerc",
    "number": 16,
    "team": "Ferrari",
    "wins": 0,
    "podiums": 7,
    "points": 225,
    "color": "#DC0000"
  },
  {
    "name": "Kimi Antonelli",
    "number": 12,
    "team": "Mercedes",
    "wins": 0,
    "podiums": 3,
    "points": 135,
    "color": "#27F4D2"
  },
  {
    "name": "Lewis Hamilton",
    "number": 44,
    "team": "Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 135,
    "color": "#DC0000"
  },
  {
    "name": "Alexander Albon",
    "number": 23,
    "team": "Williams Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 70,
    "color": "#27F4D2"
  },
  {
    "name": "Carlos Sainz",
    "number": 55,
    "team": "Williams Mercedes",
    "wins": 0,
    "podiums": 2,
    "points": 54,
    "color": "#27F4D2"
  },
  {
    "name": "Nico Hulkenberg",
    "number": 27,
    "team": "Kick Sauber Ferrari",
    "wins": 0,
    "podiums": 1,
    "points": 51,
    "color": "#DC0000"
  },
  {
    "name": "Fernando Alonso",
    "number": 14,
    "team": "Aston Martin Aramco Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 51,
    "color": "#27F4D2"
  },
  {
    "name": "Isack Hadjar",
    "number": 6,
    "team": "Racing Bulls Honda RBPT",
    "wins": 0,
    "podiums": 1,
    "points": 50,
    "color": "#6692FF"
  },
  {
    "name": "Oliver Bearman",
    "number": 87,
    "team": "Haas Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 39,
    "color": "#DC0000"
  },
  {
    "name": "Liam Lawson",
    "number": 30,
    "team": "Red Bull Racing Honda RBPT",
    "wins": 0,
    "podiums": 0,
    "points": 38,
    "color": "#1E3A8A"
  },
  {
    "name": "Esteban Ocon",
    "number": 31,
    "team": "Haas Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 34,
    "color": "#DC0000"
  },
  {
    "name": "Lance Stroll",
    "number": 18,
    "team": "Aston Martin Aramco Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 29,
    "color": "#27F4D2"
  },
  {
    "name": "Yuki Tsunoda",
    "number": 22,
    "team": "Racing Bulls Honda RBPT",
    "wins": 0,
    "podiums": 0,
    "points": 21,
    "color": "#6692FF"
  },
  {
    "name": "Pierre Gasly",
    "number": 10,
    "team": "Alpine Renault",
    "wins": 0,
    "podiums": 0,
    "points": 20,
    "color": "#0093CC"
  },
  {
    "name": "Gabriel Bortoleto",
    "number": 5,
    "team": "Kick Sauber Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 19,
    "color": "#DC0000"
  },
  {
    "name": "Jack Doohan",
    "number": 7,
    "team": "Alpine Renault",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#0093CC"
  },
  {
    "name": "Franco Colapinto",
    "number": 43,
    "team": "Alpine Renault",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#0093CC"
  }
];

export const F1_TEAM_STANDINGS_2025: F1StandingsTeam[] = [
  {
    "name": "McLaren Mercedes",
    "points": 775,
    "wins": 14,
    "color": "#FF8000"
  },
  {
    "name": "Mercedes",
    "points": 424,
    "wins": 2,
    "color": "#27F4D2"
  },
  {
    "name": "Red Bull Racing Honda RBPT",
    "points": 410,
    "wins": 8,
    "color": "#1E3A8A"
  },
  {
    "name": "Ferrari",
    "points": 360,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "Williams Mercedes",
    "points": 124,
    "wins": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Racing Bulls Honda RBPT",
    "points": 88,
    "wins": 0,
    "color": "#6692FF"
  },
  {
    "name": "Aston Martin Aramco Mercedes",
    "points": 80,
    "wins": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Haas Ferrari",
    "points": 73,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "Kick Sauber Ferrari",
    "points": 70,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "Alpine Renault",
    "points": 20,
    "wins": 0,
    "color": "#0093CC"
  }
];

export const F1_LAST_RACE_2025: F1LastRace | null = {
  "track": "Abu Dhabi",
  "podium": [
    {
      "pos": 1,
      "driver": "Max Verstappen",
      "team": "Red Bull Racing Honda RBPT",
      "number": 1,
      "time": "1:26:07.469",
      "points": 25,
      "color": "#1E3A8A"
    },
    {
      "pos": 2,
      "driver": "Oscar Piastri",
      "team": "McLaren Mercedes",
      "number": 81,
      "time": "+12.594",
      "points": 18,
      "color": "#FF8000"
    },
    {
      "pos": 3,
      "driver": "Lando Norris",
      "team": "McLaren Mercedes",
      "number": 4,
      "time": "+16.572",
      "points": 15,
      "color": "#FF8000"
    }
  ]
};

export const F1_DOTD_2025: F1DotdEntry[] = [
  {
    "name": "Max Verstappen",
    "votes": 367.4,
    "races": 20,
    "wins": 8
  },
  {
    "name": "Charles Leclerc",
    "votes": 190,
    "races": 15,
    "wins": 2
  },
  {
    "name": "Lewis Hamilton",
    "votes": 179.5,
    "races": 13,
    "wins": 2
  },
  {
    "name": "Kimi Antonelli",
    "votes": 110.8,
    "races": 7,
    "wins": 2
  },
  {
    "name": "Gabriel Bortoleto",
    "votes": 48.8,
    "races": 2,
    "wins": 2
  },
  {
    "name": "Lando Norris",
    "votes": 214.6,
    "races": 20,
    "wins": 1
  },
  {
    "name": "Oscar Piastri",
    "votes": 157,
    "races": 14,
    "wins": 1
  },
  {
    "name": "Nico Hulkenberg",
    "votes": 66.3,
    "races": 3,
    "wins": 1
  },
  {
    "name": "Carlos Sainz",
    "votes": 64.1,
    "races": 3,
    "wins": 1
  },
  {
    "name": "Isack Hadjar",
    "votes": 62.400000000000006,
    "races": 3,
    "wins": 1
  }
];

export const F1_DRIVERS_2026: F1Driver2026[] = [
  {
    "name": "George Russell",
    "team": "Mercedes",
    "number": 63,
    "color": "#27F4D2"
  },
  {
    "name": "Kimi Antonelli",
    "team": "Mercedes",
    "number": 12,
    "color": "#27F4D2"
  },
  {
    "name": "Charles Leclerc",
    "team": "Ferrari",
    "number": 16,
    "color": "#DC0000"
  },
  {
    "name": "Lewis Hamilton",
    "team": "Ferrari",
    "number": 44,
    "color": "#DC0000"
  },
  {
    "name": "Lando Norris",
    "team": "McLaren Mercedes",
    "number": 1,
    "color": "#FF8000"
  },
  {
    "name": "Max Verstappen",
    "team": "Red Bull Racing Red Bull Ford",
    "number": 3,
    "color": "#1E3A8A"
  },
  {
    "name": "Oliver Bearman",
    "team": "Haas Ferrari",
    "number": 87,
    "color": "#DC0000"
  },
  {
    "name": "Arvid Lindblad",
    "team": "Racing Bulls Red Bull Ford",
    "number": 41,
    "color": "#6692FF"
  },
  {
    "name": "Gabriel Bortoleto",
    "team": "Audi",
    "number": 5,
    "color": "#FFFFFF"
  },
  {
    "name": "Pierre Gasly",
    "team": "Alpine Mercedes",
    "number": 10,
    "color": "#27F4D2"
  },
  {
    "name": "Esteban Ocon",
    "team": "Haas Ferrari",
    "number": 31,
    "color": "#DC0000"
  },
  {
    "name": "Alexander Albon",
    "team": "Williams Mercedes",
    "number": 23,
    "color": "#27F4D2"
  },
  {
    "name": "Liam Lawson",
    "team": "Racing Bulls Red Bull Ford",
    "number": 30,
    "color": "#6692FF"
  },
  {
    "name": "Franco Colapinto",
    "team": "Alpine Mercedes",
    "number": 43,
    "color": "#27F4D2"
  },
  {
    "name": "Carlos Sainz",
    "team": "Williams Mercedes",
    "number": 55,
    "color": "#27F4D2"
  },
  {
    "name": "Sergio Perez",
    "team": "Cadillac Ferrari",
    "number": 11,
    "color": "#DC0000"
  },
  {
    "name": "Lance Stroll",
    "team": "Aston Martin Honda",
    "number": 18,
    "color": "#229971"
  },
  {
    "name": "Fernando Alonso",
    "team": "Aston Martin Honda",
    "number": 14,
    "color": "#229971"
  },
  {
    "name": "Valtteri Bottas",
    "team": "Cadillac Ferrari",
    "number": 77,
    "color": "#DC0000"
  },
  {
    "name": "Isack Hadjar",
    "team": "Red Bull Racing Red Bull Ford",
    "number": 6,
    "color": "#1E3A8A"
  },
  {
    "name": "Oscar Piastri",
    "team": "McLaren Mercedes",
    "number": 81,
    "color": "#FF8000"
  },
  {
    "name": "Nico Hulkenberg",
    "team": "Audi",
    "number": 27,
    "color": "#FFFFFF"
  }
];

export const F1_DRIVER_STANDINGS_2026: F1StandingsDriver[] = [
  {
    "name": "Kimi Antonelli",
    "number": 12,
    "team": "Mercedes",
    "wins": 3,
    "podiums": 4,
    "points": 93,
    "color": "#27F4D2"
  },
  {
    "name": "George Russell",
    "number": 63,
    "team": "Mercedes",
    "wins": 1,
    "podiums": 2,
    "points": 67,
    "color": "#27F4D2"
  },
  {
    "name": "Charles Leclerc",
    "number": 16,
    "team": "Ferrari",
    "wins": 0,
    "podiums": 2,
    "points": 46,
    "color": "#DC0000"
  },
  {
    "name": "Lewis Hamilton",
    "number": 44,
    "team": "Ferrari",
    "wins": 0,
    "podiums": 1,
    "points": 43,
    "color": "#DC0000"
  },
  {
    "name": "Lando Norris",
    "number": 1,
    "team": "McLaren Mercedes",
    "wins": 0,
    "podiums": 1,
    "points": 38,
    "color": "#FF8000"
  },
  {
    "name": "Oscar Piastri",
    "number": 81,
    "team": "McLaren Mercedes",
    "wins": 0,
    "podiums": 2,
    "points": 33,
    "color": "#FF8000"
  },
  {
    "name": "Max Verstappen",
    "number": 3,
    "team": "Red Bull Racing Red Bull Ford",
    "wins": 0,
    "podiums": 0,
    "points": 22,
    "color": "#1E3A8A"
  },
  {
    "name": "Oliver Bearman",
    "number": 87,
    "team": "Haas Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 16,
    "color": "#DC0000"
  },
  {
    "name": "Pierre Gasly",
    "number": 10,
    "team": "Alpine Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 15,
    "color": "#27F4D2"
  },
  {
    "name": "Liam Lawson",
    "number": 30,
    "team": "Racing Bulls Red Bull Ford",
    "wins": 0,
    "podiums": 0,
    "points": 8,
    "color": "#6692FF"
  },
  {
    "name": "Franco Colapinto",
    "number": 43,
    "team": "Alpine Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 7,
    "color": "#27F4D2"
  },
  {
    "name": "Arvid Lindblad",
    "number": 41,
    "team": "Racing Bulls Red Bull Ford",
    "wins": 0,
    "podiums": 0,
    "points": 4,
    "color": "#6692FF"
  },
  {
    "name": "Carlos Sainz",
    "number": 55,
    "team": "Williams Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 4,
    "color": "#27F4D2"
  },
  {
    "name": "Isack Hadjar",
    "number": 6,
    "team": "Red Bull Racing Red Bull Ford",
    "wins": 0,
    "podiums": 0,
    "points": 4,
    "color": "#1E3A8A"
  },
  {
    "name": "Gabriel Bortoleto",
    "number": 5,
    "team": "Audi",
    "wins": 0,
    "podiums": 0,
    "points": 2,
    "color": "#FFFFFF"
  },
  {
    "name": "Esteban Ocon",
    "number": 31,
    "team": "Haas Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 1,
    "color": "#DC0000"
  },
  {
    "name": "Alexander Albon",
    "number": 23,
    "team": "Williams Mercedes",
    "wins": 0,
    "podiums": 0,
    "points": 1,
    "color": "#27F4D2"
  },
  {
    "name": "Sergio Perez",
    "number": 11,
    "team": "Cadillac Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#DC0000"
  },
  {
    "name": "Nico Hulkenberg",
    "number": 27,
    "team": "Audi",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#FFFFFF"
  },
  {
    "name": "Valtteri Bottas",
    "number": 77,
    "team": "Cadillac Ferrari",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#DC0000"
  },
  {
    "name": "Fernando Alonso",
    "number": 14,
    "team": "Aston Martin Honda",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#229971"
  },
  {
    "name": "Lance Stroll",
    "number": 18,
    "team": "Aston Martin Honda",
    "wins": 0,
    "podiums": 0,
    "points": 0,
    "color": "#229971"
  }
];

export const F1_TEAM_STANDINGS_2026: F1StandingsTeam[] = [
  {
    "name": "Mercedes",
    "points": 160,
    "wins": 4,
    "color": "#27F4D2"
  },
  {
    "name": "Ferrari",
    "points": 89,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "McLaren Mercedes",
    "points": 71,
    "wins": 0,
    "color": "#FF8000"
  },
  {
    "name": "Red Bull Racing Red Bull Ford",
    "points": 26,
    "wins": 0,
    "color": "#1E3A8A"
  },
  {
    "name": "Alpine Mercedes",
    "points": 22,
    "wins": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Haas Ferrari",
    "points": 17,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "Racing Bulls Red Bull Ford",
    "points": 12,
    "wins": 0,
    "color": "#6692FF"
  },
  {
    "name": "Williams Mercedes",
    "points": 5,
    "wins": 0,
    "color": "#27F4D2"
  },
  {
    "name": "Audi",
    "points": 2,
    "wins": 0,
    "color": "#FFFFFF"
  },
  {
    "name": "Cadillac Ferrari",
    "points": 0,
    "wins": 0,
    "color": "#DC0000"
  },
  {
    "name": "Aston Martin Honda",
    "points": 0,
    "wins": 0,
    "color": "#229971"
  }
];

export const F1_LAST_RACE_2026: F1LastRace | null = {
  "track": "Miami",
  "podium": [
    {
      "pos": 1,
      "driver": "Kimi Antonelli",
      "team": "Mercedes",
      "number": 12,
      "time": "1:33:19.273",
      "points": 25,
      "color": "#27F4D2"
    },
    {
      "pos": 2,
      "driver": "Lando Norris",
      "team": "McLaren Mercedes",
      "number": 1,
      "time": "+3.264",
      "points": 18,
      "color": "#FF8000"
    },
    {
      "pos": 3,
      "driver": "Oscar Piastri",
      "team": "McLaren Mercedes",
      "number": 81,
      "time": "+27.092",
      "points": 15,
      "color": "#FF8000"
    }
  ]
};

export const F1_CHAMPIONS_HISTORY: F1Champion[] = [
  {
    "year": 2022,
    "driver": "Max Verstappen",
    "driverTeam": "Red Bull Racing RBPT",
    "driverPoints": 433,
    "driverWins": 15,
    "driverColor": "#1E3A8A",
    "constructor": "Red Bull Racing RBPT",
    "constructorPoints": 724,
    "constructorWins": 17,
    "constructorColor": "#1E3A8A"
  },
  {
    "year": 2023,
    "driver": "Max Verstappen",
    "driverTeam": "Red Bull Racing Honda RBPT",
    "driverPoints": 530,
    "driverWins": 19,
    "driverColor": "#1E3A8A",
    "constructor": "Red Bull Racing Honda RBPT",
    "constructorPoints": 790,
    "constructorWins": 21,
    "constructorColor": "#1E3A8A"
  },
  {
    "year": 2024,
    "driver": "Max Verstappen",
    "driverTeam": "Red Bull Racing Honda RBPT",
    "driverPoints": 399,
    "driverWins": 9,
    "driverColor": "#1E3A8A",
    "constructor": "McLaren Mercedes",
    "constructorPoints": 609,
    "constructorWins": 6,
    "constructorColor": "#FF8000"
  }
];
