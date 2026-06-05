import { supabase } from '@/integrations/supabase/client';

export const NPC_RACES = ['Člověk', 'Elf', 'Trpaslík', 'Barbar', 'Gnóm', 'Hobit', 'Obr'] as const;
export type NPCRace = typeof NPC_RACES[number];
export type NPCGender = 'male' | 'female' | 'random';
export type NamePart = 'first' | 'last';

export interface NamePartRow {
  id: string;
  race: string;
  gender: 'male' | 'female';
  part: NamePart;
  value: string;
}

let cache: NamePartRow[] | null = null;
let cachePromise: Promise<NamePartRow[]> | null = null;

export async function loadNameParts(force = false): Promise<NamePartRow[]> {
  if (!force && cache) return cache;
  if (!force && cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data } = await supabase.from('npc_name_parts').select('*').order('value');
    cache = (data || []) as NamePartRow[];
    cachePromise = null;
    return cache;
  })();
  return cachePromise;
}

export function invalidateNameCache() {
  cache = null;
  cachePromise = null;
}

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateRandomName(race: NPCRace, gender: NPCGender = 'random'): Promise<string> {
  const all = await loadNameParts();
  const g: 'male' | 'female' = gender === 'random' ? (Math.random() < 0.5 ? 'male' : 'female') : gender;
  const firsts = all.filter(r => r.race === race && r.gender === g && r.part === 'first');
  const lasts = all.filter(r => r.race === race && r.part === 'last' && (r.gender === g || true));
  // last name: prefer same gender if exists, otherwise any
  const sameGenderLasts = lasts.filter(r => r.gender === g);
  const lastsPool = sameGenderLasts.length ? sameGenderLasts : lasts;

  const first = pick(firsts)?.value;
  if (!first) return '???';
  const last = pick(lastsPool)?.value;
  return last ? `${first} ${last}` : first;
}
