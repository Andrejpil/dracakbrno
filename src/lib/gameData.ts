// === TYPES ===
export interface Hero {
  id: string;
  name: string;
  race: Race;
  profession: string;
  specialization: string;
  experience: number;
  kills: number;
  totalDamage: number;
}

export interface Monster {
  id: string;
  name: string;
  str: number;
  con: number;
  dex: number;
  int: number;
  cha: number;
  hp: number;
  mp: number;
  attack: number;
  defense: number;
  xp_reward: number;
  special: string;
  is_unique: boolean;
}

export function calculateHP(con: number, level: number, isUnique: boolean): number {
  const bonus = getAttributeBonus(con);
  if (isUnique) {
    return (bonus + 10) * level;
  }
  return (bonus + 5) * level + 5;
}

export function calculateXP(baseXP: number, level: number): number {
  const multiplier = 1 + (level - 1) * 0.1;
  return Math.floor(baseXP * multiplier);
}

export interface BattleMonster extends Monster {
  battleId: string;
  currentHP: number;
  currentMP: number;
  killedBy?: string; // hero id
  level: number;
}

export interface XPRecord {
  id?: string;
  amount: number;
  note: string;
}

export type Race = 'Barbar' | 'Člověk' | 'Elf' | 'Gnom' | 'Obr' | 'Půlčík' | 'Trpaslík';

export const RACES: Race[] = ['Barbar', 'Člověk', 'Elf', 'Gnom', 'Obr', 'Půlčík', 'Trpaslík'];

// === RACIAL ABILITIES ===
export const RACIAL_ABILITIES: Record<Race, { name: string; description: string }> = {
  'Barbar': {
    name: 'Houževnatost',
    description: 'Při každém léčení získává barbar 2 životy navíc. Tvrdý život učinil barbary velmi odolnými – jejich tělo se naučilo lépe hojit a regenerovat.',
  },
  'Člověk': {
    name: 'Všestrannost',
    description: 'Na začátku hry a při každém přestupu na další úroveň získává o 2 dovednostní body navíc za každou dosaženou úroveň. Lidé jsou známí svou přirozenou zvídavostí.',
  },
  'Elf': {
    name: 'Orlí zrak',
    description: 'Vidí ostře na dvakrát větší vzdálenost. Bonus +2 ke všem hodům vyžadujícím ostrý zrak (Stopování, Postřeh apod.). Bonus se nevztahuje k útoku ani k obraně.',
  },
  'Gnom': {
    name: 'Zručnost',
    description: 'Bonus +2 ke všem akcím založeným na jemné práci rukou (Řemesla, Umění, Alchymie, Mechanika, Otevírání zámků apod.). Nevztahuje se na akce celého těla.',
  },
  'Obr': {
    name: 'Hroší kůže',
    description: 'Zvláštní bonus +2 k Základní obraně. Kůže obrů je tvrdá a rohovitá – trny, střepy ani špičaté větve jí nedokáží proniknout.',
  },
  'Půlčík': {
    name: 'Tichošlápek',
    description: 'Bonus +2 ke všem akcím vyžadujícím nenápadné přesuny (plížení, tichý pohyb). Platí pouze bez bot a bez nezajištěných zdrojů hluku.',
  },
  'Trpaslík': {
    name: 'Vidění ve tmě',
    description: 'Vidí ve tmě až na vzdálenost 30 sáhů. Nerozeznají barvy, ale vidí vše v různých odstínech šedi. Následek odvěkého života v podzemí.',
  },
};

// === ATTRIBUTE BONUS CALCULATOR ===
export function getAttributeBonus(value: number): number {
  if (value <= 1) return -5;
  if (value <= 3) return -4;
  if (value <= 5) return -3;
  if (value <= 7) return -2;
  if (value <= 9) return -1;
  if (value <= 11) return 0;
  if (value <= 13) return 1;
  if (value <= 15) return 2;
  if (value <= 17) return 3;
  if (value <= 19) return 4;
  if (value <= 21) return 5;
  return 6;
}

export function formatBonus(bonus: number): string {
  if (bonus > 0) return `+${bonus}`;
  return `${bonus}`;
}

// === LOCAL STORAGE ===
function generateId(): string {
  return crypto.randomUUID();
}

const KEYS = {
  heroes: 'dd_heroes',
  monsters: 'dd_monsters',
  battleMonsters: 'dd_battleMonsters',
  monsterKills: 'dd_monsterKills',
  xpArchive: 'dd_xpArchive',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Heroes
export function loadHeroes(): Hero[] { return load<Hero[]>(KEYS.heroes, []); }
export function saveHeroes(h: Hero[]) { save(KEYS.heroes, h); }
export function createHero(data: Omit<Hero, 'id' | 'kills' | 'totalDamage'>): Hero {
  return { ...data, id: generateId(), kills: 0, totalDamage: 0 };
}

// Monsters
export function loadMonsters(): Monster[] { return load<Monster[]>(KEYS.monsters, []); }
export function saveMonsters(m: Monster[]) { save(KEYS.monsters, m); }
export function createMonster(data: Omit<Monster, 'id'>): Monster {
  return { ...data, id: generateId() };
}

// Battle
export function loadBattleMonsters(): BattleMonster[] { return load<BattleMonster[]>(KEYS.battleMonsters, []); }
export function saveBattleMonsters(b: BattleMonster[]) { save(KEYS.battleMonsters, b); }

// Kills
export function loadMonsterKills(): Record<string, number> { return load(KEYS.monsterKills, {}); }
export function saveMonsterKills(k: Record<string, number>) { save(KEYS.monsterKills, k); }

// XP Archive
export function loadXPArchive(): Record<string, XPRecord[]> { return load(KEYS.xpArchive, {}); }
export function saveXPArchive(x: Record<string, XPRecord[]>) { save(KEYS.xpArchive, x); }

// Export CSV
export function exportCSV(heroes: Hero[], monsters: Monster[], battleMonsters: BattleMonster[]): string {
  let csv = "type,name,race,profession,specialization,experience,str,con,dex,int,cha,hp,mp,attack,defense,xp_reward,special,currentHP,currentMP,kills,totalDamage\n";
  heroes.forEach(h => csv += `hero,${h.name},${h.race},${h.profession},${h.specialization},${h.experience},,,,,,,,,,,,,,${h.kills},${h.totalDamage}\n`);
  monsters.forEach(m => csv += `monster,${m.name},,,,,,${m.str},${m.con},${m.dex},${m.int},${m.cha},${m.hp},${m.mp},${m.attack},${m.defense},${m.xp_reward},${m.special},,\n`);
  battleMonsters.forEach(m => csv += `battleMonster,${m.name},,,,,,${m.str},${m.con},${m.dex},${m.int},${m.cha},${m.hp},${m.mp},${m.attack},${m.defense},${m.xp_reward},${m.special},${m.currentHP},${m.currentMP}\n`);
  return csv;
}
