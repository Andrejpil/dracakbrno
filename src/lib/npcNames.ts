import { supabase } from '@/integrations/supabase/client';

export type NPCGender = 'male' | 'female' | 'random';
export type NameGender = 'male' | 'female' | 'unisex';
export type NamePart = 'first' | 'last';

export interface RaceRow {
  id: string;
  code: string;
  label: string;
  sort_order: number;
}

export interface NameRow {
  id: string;
  value: string;
  part: NamePart;
  gender: NameGender;
  race_ids: string[];
}

// Legacy alias for code that imports NPCRace (now string from DB)
export type NPCRace = string;

let racesCache: RaceRow[] | null = null;
let namesCache: NameRow[] | null = null;
let racesPromise: Promise<RaceRow[]> | null = null;
let namesPromise: Promise<NameRow[]> | null = null;

export async function loadRaces(force = false): Promise<RaceRow[]> {
  if (!force && racesCache) return racesCache;
  if (!force && racesPromise) return racesPromise;
  racesPromise = (async () => {
    const { data } = await supabase
      .from('npc_races')
      .select('*')
      .order('sort_order');
    racesCache = (data || []) as RaceRow[];
    racesPromise = null;
    return racesCache;
  })();
  return racesPromise;
}

export async function loadNames(force = false): Promise<NameRow[]> {
  if (!force && namesCache) return namesCache;
  if (!force && namesPromise) return namesPromise;
  namesPromise = (async () => {
    const { data: names } = await supabase
      .from('npc_names')
      .select('id, value, part, gender')
      .order('value');
    const { data: links } = await supabase
      .from('npc_name_races')
      .select('name_id, race_id');
    const byName: Record<string, string[]> = {};
    (links || []).forEach((l: any) => {
      (byName[l.name_id] ||= []).push(l.race_id);
    });
    namesCache = (names || []).map((n: any) => ({
      id: n.id,
      value: n.value,
      part: n.part as NamePart,
      gender: n.gender as NameGender,
      race_ids: byName[n.id] || [],
    }));
    namesPromise = null;
    return namesCache;
  })();
  return namesPromise;
}

export function invalidateNameCache() {
  racesCache = null;
  namesCache = null;
  racesPromise = null;
  namesPromise = null;
}

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GenerateOptions {
  raceCode: string;
  gender?: NPCGender;
  useSurname?: boolean;
}

export async function generateRandomName(opts: GenerateOptions): Promise<string> {
  const races = await loadRaces();
  const race = races.find(r => r.code === opts.raceCode);
  if (!race) return '???';
  const all = await loadNames();
  const gender = opts.gender ?? 'random';
  const g: 'male' | 'female' = gender === 'random' ? (Math.random() < 0.5 ? 'male' : 'female') : gender;

  const matches = (n: NameRow, part: NamePart) =>
    n.part === part &&
    (n.gender === g || n.gender === 'unisex') &&
    n.race_ids.includes(race.id);

  const firsts = all.filter(n => matches(n, 'first'));
  const first = pick(firsts)?.value;
  if (!first) return '???';

  if (!opts.useSurname) return first;

  const lasts = all.filter(n => matches(n, 'last'));
  const last = pick(lasts)?.value;
  return last ? `${first} ${last}` : first;
}
