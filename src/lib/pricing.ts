// Currency & pricing helpers.
// 1 zl = 10 st = 100 md.  All stored in copper (md).

export const ECONOMY_PRESETS: Record<string, number> = {
  normal: 0,
  mobilization: 15,
  war: 40,
  famine: 60,
  plague: 80,
  festival: -10,
  trade_boom: -20,
  embargo: 50,
  custom: 0,
};

export const ECONOMY_LABELS: Record<string, string> = {
  normal: 'Normální stav',
  mobilization: 'Mobilizace',
  war: 'Válka',
  famine: 'Hladomor',
  plague: 'Mor',
  festival: 'Slavnost',
  trade_boom: 'Obchodní boom',
  embargo: 'Embargo',
  custom: 'Vlastní',
};

export const LOCATION_LABELS: Record<string, string> = {
  city: 'Město',
  town: 'Městečko',
  village: 'Vesnice',
  hamlet: 'Osada',
  fortress: 'Pevnost',
  market: 'Trh',
};

export function economyModifier(state: string, customPct: number): number {
  if (state === 'custom') return customPct || 0;
  return ECONOMY_PRESETS[state] ?? 0;
}

export function copperToParts(copper: number) {
  const sign = copper < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(copper));
  const zl = Math.floor(abs / 100);
  const st = Math.floor((abs % 100) / 10);
  const md = abs % 10;
  return { zl: sign * zl, st, md, sign };
}

export function partsToCopper(zl: number, st: number, md: number): number {
  return (Number(zl) || 0) * 100 + (Number(st) || 0) * 10 + (Number(md) || 0);
}

export function formatCopper(copper: number): string {
  if (!Number.isFinite(copper)) return '—';
  const { zl, st, md, sign } = copperToParts(copper);
  const parts: string[] = [];
  const azl = Math.abs(zl);
  if (azl) parts.push(`${azl} zl`);
  if (st) parts.push(`${st} st`);
  if (md || parts.length === 0) parts.push(`${md} md`);
  return (sign < 0 ? '−' : '') + parts.join(' ');
}

export interface PriceCalcInput {
  basePriceCopper: number;
  locationModifierPct: number; // effective location mod (override ?? location.default)
  economyModifierPct: number;
}
export interface PriceCalcResult {
  final: number;
  base: number;
  locMod: number;
  econMod: number;
}

export function computePrice({ basePriceCopper, locationModifierPct, economyModifierPct }: PriceCalcInput): PriceCalcResult {
  const final = Math.round(
    basePriceCopper * (1 + (locationModifierPct || 0) / 100) * (1 + (economyModifierPct || 0) / 100)
  );
  return { final, base: basePriceCopper, locMod: locationModifierPct || 0, econMod: economyModifierPct || 0 };
}

// ---------------- CSV helpers ----------------

export interface CsvItemRow {
  name: string;
  category: string;
  unit: string;
  note: string;
  base_copper: number;
  locations: { name: string; override: number | null }[];
}

function csvEscape(v: string) {
  const s = v ?? '';
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildItemsCsv(rows: CsvItemRow[]): string {
  const header = ['nazev', 'kategorie', 'jednotka', 'zl', 'st', 'md', 'poznamka', 'sidla'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const p = copperToParts(r.base_copper);
    const locs = r.locations
      .map(l => (l.override == null ? l.name : `${l.name}=${l.override}`))
      .join('|');
    lines.push([
      csvEscape(r.name), csvEscape(r.category), csvEscape(r.unit),
      String(p.zl), String(p.st), String(p.md),
      csvEscape(r.note), csvEscape(locs),
    ].join(','));
  }
  return '\uFEFF' + lines.join('\n');
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseItemsCsv(text: string): { rows: CsvItemRow[]; errors: string[] } {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
  const lines = clean.split('\n').filter(l => l.trim() !== '');
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ['Soubor je prázdný nebo chybí data.'] };
  const delim = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const header = splitCsvLine(lines[0], delim).map(h => h.toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  const iName = idx('nazev') >= 0 ? idx('nazev') : idx('název');
  if (iName < 0) return { rows: [], errors: ['Chybí sloupec "nazev".'] };
  const iCat = idx('kategorie'), iUnit = idx('jednotka'), iNote = idx('poznamka') >= 0 ? idx('poznamka') : idx('poznámka');
  const iZl = idx('zl'), iSt = idx('st'), iMd = idx('md'), iLocs = idx('sidla') >= 0 ? idx('sidla') : idx('sídla');

  const rows: CsvItemRow[] = [];
  lines.slice(1).forEach((line, n) => {
    const c = splitCsvLine(line, delim);
    const name = (c[iName] || '').trim();
    if (!name) { errors.push(`Řádek ${n + 2}: chybí název — přeskočeno.`); return; }
    const num = (i: number) => (i >= 0 ? Number(c[i]) || 0 : 0);
    const locs: CsvItemRow['locations'] = [];
    if (iLocs >= 0 && c[iLocs]) {
      c[iLocs].split('|').map(s => s.trim()).filter(Boolean).forEach(part => {
        const eq = part.lastIndexOf('=');
        if (eq > 0) {
          const ln = part.slice(0, eq).trim();
          const ov = Number(part.slice(eq + 1).trim());
          locs.push({ name: ln, override: Number.isFinite(ov) ? ov : null });
        } else locs.push({ name: part, override: null });
      });
    }
    rows.push({
      name,
      category: iCat >= 0 ? (c[iCat] || '') : '',
      unit: iUnit >= 0 ? (c[iUnit] || '') : '',
      note: iNote >= 0 ? (c[iNote] || '') : '',
      base_copper: partsToCopper(num(iZl), num(iSt), num(iMd)),
      locations: locs,
    });
  });
  return { rows, errors };
}

// ---------------- settlement type inheritance ----------------

export interface LocLike {
  price_modifier_pct: number;
  type_code?: string | null;
  uses_type_default?: boolean | null;
}

/** Effective settlement modifier: own value, or the default of its settlement type. */
export function effectiveLocationPct(
  loc: LocLike,
  typesByCode: Record<string, { default_modifier_pct: number }>
): number {
  if (loc.uses_type_default) return typesByCode[loc.type_code || '']?.default_modifier_pct ?? 0;
  return loc.price_modifier_pct || 0;
}

/** Short human summary of an item's availability. */
export function availabilitySummary(mode: string, count: number): string {
  switch (mode) {
    case 'ONLY_SELECTED': return count === 0 ? 'Žádná sídla nevybrána' : `Pouze v ${count} sídlech`;
    case 'EXCEPT_SELECTED': return count === 0 ? 'Dostupné všude' : `Nedostupné v ${count} sídlech`;
    case 'NOWHERE': return 'Nedostupné nikde';
    default: return 'Dostupné všude';
  }
}
