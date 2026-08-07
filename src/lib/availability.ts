// Availability engine (client mirror of the SQL functions).
// Priority: item+settlement exception > item own mode > item profile > (sub)category profile > global default (available).
import type {
  AvailabilityProfile, ItemException, PriceCategory, PriceItem, PriceLocation, ProfileRules,
} from '@/components/pricing/types';

export type AvailabilityMode =
  | 'INHERIT' | 'PROFILE' | 'EVERYWHERE' | 'NOWHERE' | 'ONLY_SELECTED' | 'EXCEPT_SELECTED';

export const AVAILABILITY_MODES: AvailabilityMode[] = [
  'INHERIT', 'PROFILE', 'EVERYWHERE', 'NOWHERE', 'ONLY_SELECTED', 'EXCEPT_SELECTED',
];

export const AVAILABILITY_LABELS: Record<string, string> = {
  INHERIT: 'Zdědit z kategorie',
  PROFILE: 'Použít profil',
  EVERYWHERE: 'Dostupné všude',
  NOWHERE: 'Nedostupné nikde',
  ONLY_SELECTED: 'Pouze ve vybraných sídlech',
  EXCEPT_SELECTED: 'Všude kromě vybraných sídel',
};

/** tag codes per location id */
export type TagIndex = Map<string, Set<string>>;

export function buildTagIndex(
  links: { location_id: string; tag_id: string }[],
  tags: { id: string; code: string }[],
): TagIndex {
  const codeById = new Map(tags.map(t => [t.id, t.code]));
  const idx: TagIndex = new Map();
  for (const l of links) {
    const code = codeById.get(l.tag_id);
    if (!code) continue;
    const s = idx.get(l.location_id) || new Set<string>();
    s.add(code);
    idx.set(l.location_id, s);
  }
  return idx;
}

const arr = (v?: string[] | null) => (Array.isArray(v) ? v.filter(Boolean) : []);

export function locationMatchesProfile(loc: PriceLocation, rules: ProfileRules, tagIdx: TagIndex): boolean {
  const r = rules || {};
  const types = arr(r.type_codes);
  if (types.length && !types.includes(loc.type_code || loc.type)) return false;

  const size = loc.size ?? 0;
  const wealth = loc.wealth ?? 0;
  if (r.size_min != null && size < r.size_min) return false;
  if (r.size_max != null && size > r.size_max) return false;
  if (r.wealth_min != null && wealth < r.wealth_min) return false;
  if (r.wealth_max != null && wealth > r.wealth_max) return false;

  const region = loc.region || '';
  const rin = arr(r.regions_in);
  if (rin.length && !rin.includes(region)) return false;
  const rnot = arr(r.regions_not_in);
  if (rnot.length && rnot.includes(region)) return false;

  const tags = tagIdx.get(loc.id) || new Set<string>();
  const any = arr(r.tags_any);
  if (any.length && !any.some(t => tags.has(t))) return false;
  const all = arr(r.tags_all);
  if (all.length && !all.every(t => tags.has(t))) return false;
  const none = arr(r.tags_none);
  if (none.length && none.some(t => tags.has(t))) return false;

  return true;
}

export function profileSettlements(
  rules: ProfileRules, locations: PriceLocation[], tagIdx: TagIndex,
): PriceLocation[] {
  return locations.filter(l => locationMatchesProfile(l, rules, tagIdx));
}

export interface ResolvedProfile {
  profile: AvailabilityProfile | null;
  source: string;
}

/** Walks item -> category -> parent categories to find the effective profile. */
export function resolveItemProfile(
  item: Pick<PriceItem, 'availability_mode' | 'availability_profile_id' | 'category_id'>,
  categories: PriceCategory[],
  profiles: AvailabilityProfile[],
): ResolvedProfile {
  const profById = new Map(profiles.map(p => [p.id, p]));
  if (item.availability_mode === 'PROFILE' && item.availability_profile_id) {
    return { profile: profById.get(item.availability_profile_id) || null, source: 'Vlastní profil položky' };
  }
  const catById = new Map(categories.map(c => [c.id, c]));
  let cur = item.category_id ? catById.get(item.category_id) : undefined;
  let guard = 0;
  while (cur && guard++ < 20) {
    if (cur.default_profile_id) {
      return { profile: profById.get(cur.default_profile_id) || null, source: `Kategorie „${cur.name}"` };
    }
    cur = cur.parent_id ? catById.get(cur.parent_id) : undefined;
  }
  return { profile: null, source: 'Bez profilu' };
}

export interface AvailabilityAnswer {
  available: boolean;
  source: string;
}

export function itemAvailableAt(
  item: PriceItem,
  loc: PriceLocation,
  ctx: {
    exceptions: ItemException[];
    itemLocations: { item_id: string; location_id: string }[];
    categories: PriceCategory[];
    profiles: AvailabilityProfile[];
    tagIdx: TagIndex;
  },
): AvailabilityAnswer {
  const ex = ctx.exceptions.find(e => e.item_id === item.id && e.location_id === loc.id);
  if (ex) return { available: ex.action === 'ALLOW', source: 'Ruční výjimka' };

  const linked = ctx.itemLocations.some(l => l.item_id === item.id && l.location_id === loc.id);
  switch (item.availability_mode) {
    case 'EVERYWHERE': return { available: true, source: 'Nastavení položky: dostupné všude' };
    case 'NOWHERE': return { available: false, source: 'Nastavení položky: nedostupné nikde' };
    case 'ONLY_SELECTED': return { available: linked, source: 'Nastavení položky: pouze vybraná sídla' };
    case 'EXCEPT_SELECTED': return { available: !linked, source: 'Nastavení položky: všude kromě vybraných' };
  }

  const { profile, source } = resolveItemProfile(item, ctx.categories, ctx.profiles);
  if (!profile) return { available: true, source: 'Výchozí pravidlo (bez profilu): dostupné všude' };
  return {
    available: locationMatchesProfile(loc, profile.rules, ctx.tagIdx),
    source: `Profil „${profile.name}" (${source})`,
  };
}

export function itemSettlements(
  item: PriceItem,
  locations: PriceLocation[],
  ctx: Parameters<typeof itemAvailableAt>[2],
): { loc: PriceLocation; source: string }[] {
  return locations
    .map(loc => ({ loc, ...itemAvailableAt(item, loc, ctx) }))
    .filter(x => x.available)
    .map(({ loc, source }) => ({ loc, source }));
}

export function emptyRules(): ProfileRules {
  return {
    type_codes: [], tags_any: [], tags_all: [], tags_none: [],
    size_min: null, size_max: null, wealth_min: null, wealth_max: null,
    regions_in: [], regions_not_in: [],
  };
}
