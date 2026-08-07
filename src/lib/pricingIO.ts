// Import / export helpers for the pricing module.
// Sešit je normalizovaný (žádná matice předmět × sídlo):
//   ITEMS                 — item_code | name | category | subcategory | unit | base_price | availability_mode | availability_profile
//   ITEM_EXCEPTIONS       — item_code | settlement_code | action (ALLOW/DENY)
//   SETTLEMENTS           — settlement_code | name | type | size | wealth | region | modifier_pct | uses_type_default
//   SETTLEMENT_TAGS       — settlement_code | tag
//   AVAILABILITY_PROFILES — profile_code | name | note
//   PROFILE_RULES         — profile_code | rule | value
//   SETTLEMENT_TYPES      — type_code | label | default_modifier_pct
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { partsToCopper, formatCopper } from '@/lib/pricing';
import { AVAILABILITY_LABELS, AVAILABILITY_MODES, type AvailabilityMode } from '@/lib/availability';
import type { ProfileRules } from '@/components/pricing/types';

export { AVAILABILITY_LABELS, AVAILABILITY_MODES };
export type { AvailabilityMode };

export const SHEET_ITEMS = 'ITEMS';
export const SHEET_EXCEPTIONS = 'ITEM_EXCEPTIONS';
export const SHEET_SETTLEMENTS = 'SETTLEMENTS';
export const SHEET_SETTLEMENT_TAGS = 'SETTLEMENT_TAGS';
export const SHEET_PROFILES = 'AVAILABILITY_PROFILES';
export const SHEET_PROFILE_RULES = 'PROFILE_RULES';
export const SHEET_TYPES = 'SETTLEMENT_TYPES';

export const RULE_KEYS = [
  'type_codes', 'tags_any', 'tags_all', 'tags_none',
  'size_min', 'size_max', 'wealth_min', 'wealth_max',
  'regions_in', 'regions_not_in',
] as const;
const LIST_RULES = new Set(['type_codes', 'tags_any', 'tags_all', 'tags_none', 'regions_in', 'regions_not_in']);

// ---------------- export shapes ----------------

export interface ExportType { code: string; label: string; default_modifier_pct: number }
export interface ExportSettlement {
  code: string; name: string; type_code: string; type_label: string;
  size: number | null; wealth: number | null; region: string | null;
  price_modifier_pct: number; uses_type_default: boolean; effective_pct: number;
}
export interface ExportItem {
  code: string; name: string; category: string; subcategory: string; unit: string;
  base_price_copper: number; availability_mode: AvailabilityMode; profile_code: string;
}
export interface ExportProfile { code: string; name: string; note: string; rules: ProfileRules }

export interface PricingExportData {
  types: ExportType[];
  settlements: ExportSettlement[];
  settlementTags: { settlement_code: string; tag: string }[];
  items: ExportItem[];
  exceptions: { item_code: string; settlement_code: string; action: string }[];
  profiles: ExportProfile[];
}

// ---------------- currency text ----------------

export function copperToText(copper: number): string { return formatCopper(copper); }

export function textToCopper(txt: string | number): number {
  if (typeof txt === 'number') return Math.round(txt);
  const s = String(txt || '').trim().toLowerCase().replace(',', '.');
  if (!s) return 0;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  let zl = 0, st = 0, md = 0;
  const re = /(-?\d+(?:\.\d+)?)\s*(zl|z|st|s|md|m)\b/g;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = re.exec(s))) {
    matched = true;
    const v = Number(m[1]) || 0;
    if (m[2][0] === 'z') zl += v;
    else if (m[2][0] === 's') st += v;
    else md += v;
  }
  if (!matched) {
    const n = Number(s.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return partsToCopper(zl, st, md);
}

export function slugify(txt: string): string {
  return (txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kod';
}

// ---------------- row builders ----------------

export function itemRows(d: PricingExportData) {
  return d.items.map(i => ({
    item_code: i.code, name: i.name, category: i.category, subcategory: i.subcategory,
    unit: i.unit, base_price: copperToText(i.base_price_copper),
    base_price_copper: i.base_price_copper,
    availability_mode: i.availability_mode, availability_profile: i.profile_code,
  }));
}
export function exceptionRows(d: PricingExportData) {
  return d.exceptions.map(e => ({ item_code: e.item_code, settlement_code: e.settlement_code, action: e.action }));
}
export function settlementRows(d: PricingExportData) {
  return d.settlements.map(s => ({
    settlement_code: s.code, name: s.name, type: s.type_code, type_label: s.type_label,
    size: s.size ?? '', wealth: s.wealth ?? '', region: s.region ?? '',
    modifier_pct: s.price_modifier_pct, uses_type_default: s.uses_type_default,
    effective_pct: s.effective_pct,
  }));
}
export function settlementTagRows(d: PricingExportData) {
  return d.settlementTags.map(t => ({ settlement_code: t.settlement_code, tag: t.tag }));
}
export function profileRows(d: PricingExportData) {
  return d.profiles.map(p => ({ profile_code: p.code, name: p.name, note: p.note }));
}
export function profileRuleRows(d: PricingExportData) {
  const out: Record<string, any>[] = [];
  for (const p of d.profiles) {
    for (const key of RULE_KEYS) {
      const v = (p.rules as any)?.[key];
      if (v == null) continue;
      if (Array.isArray(v)) { if (!v.length) continue; out.push({ profile_code: p.code, rule: key, value: v.join(';') }); }
      else out.push({ profile_code: p.code, rule: key, value: String(v) });
    }
  }
  return out;
}
export function typeRows(d: PricingExportData) {
  return d.types.map(t => ({ type_code: t.code, label: t.label, default_modifier_pct: t.default_modifier_pct }));
}

// ---------------- writers ----------------

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function downloadXlsx(data: PricingExportData, filename = 'cenik.xlsx') {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, any>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
  add(SHEET_ITEMS, itemRows(data));
  add(SHEET_EXCEPTIONS, exceptionRows(data));
  add(SHEET_SETTLEMENTS, settlementRows(data));
  add(SHEET_SETTLEMENT_TAGS, settlementTagRows(data));
  add(SHEET_PROFILES, profileRows(data));
  add(SHEET_PROFILE_RULES, profileRuleRows(data));
  add(SHEET_TYPES, typeRows(data));
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(new Blob([out], { type: 'application/octet-stream' }), filename);
}

export function rowsToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '\uFEFF';
  const header = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
}

export function downloadCsv(rows: Record<string, any>[], filename: string) {
  download(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function downloadZip(data: PricingExportData, filename = 'cenik-csv.zip') {
  const zip = new JSZip();
  zip.file('ITEMS.csv', rowsToCsv(itemRows(data)));
  zip.file('ITEM_EXCEPTIONS.csv', rowsToCsv(exceptionRows(data)));
  zip.file('SETTLEMENTS.csv', rowsToCsv(settlementRows(data)));
  zip.file('SETTLEMENT_TAGS.csv', rowsToCsv(settlementTagRows(data)));
  zip.file('AVAILABILITY_PROFILES.csv', rowsToCsv(profileRows(data)));
  zip.file('PROFILE_RULES.csv', rowsToCsv(profileRuleRows(data)));
  zip.file('SETTLEMENT_TYPES.csv', rowsToCsv(typeRows(data)));
  download(await zip.generateAsync({ type: 'blob' }), filename);
}

// ---------------- parsing ----------------

export interface ParsedSheets {
  items: Record<string, any>[];
  exceptions: Record<string, any>[];
  settlements: Record<string, any>[];
  settlementTags: Record<string, any>[];
  profiles: Record<string, any>[];
  profileRules: Record<string, any>[];
  types: Record<string, any>[];
}

const emptySheets = (): ParsedSheets => ({
  items: [], exceptions: [], settlements: [], settlementTags: [], profiles: [], profileRules: [], types: [],
});

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const SHEET_ALIASES: Record<keyof ParsedSheets, string[]> = {
  items: ['items', 'item', 'polozky'],
  exceptions: ['itemexceptions', 'exceptions', 'vyjimky'],
  settlements: ['settlements', 'mesta', 'sidla2'],
  settlementTags: ['settlementtags', 'tags', 'tagy'],
  profiles: ['availabilityprofiles', 'profiles', 'profily'],
  profileRules: ['profilerules', 'rules', 'pravidla'],
  types: ['settlementtypes', 'types', 'typysidel', 'sidla'],
};

function csvToRows(text: string): Record<string, any>[] {
  const wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) as Record<string, any>[];
}

export async function parseImportFile(file: File): Promise<ParsedSheets> {
  const lower = file.name.toLowerCase();
  const out = emptySheets();

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    for (const key of Object.keys(SHEET_ALIASES) as (keyof ParsedSheets)[]) {
      const name = Object.keys(zip.files).find(n => SHEET_ALIASES[key].includes(norm(n.replace(/\.csv$/i, ''))));
      if (name) out[key] = csvToRows(await zip.files[name].async('string'));
    }
    return out;
  }

  if (lower.endsWith('.csv')) {
    const rows = csvToRows(await file.text());
    const h = Object.keys(rows[0] || {}).map(norm);
    if (h.includes('action')) out.exceptions = rows;
    else if (h.includes('tag')) out.settlementTags = rows;
    else if (h.includes('rule')) out.profileRules = rows;
    else if (h.includes('profilecode')) out.profiles = rows;
    else if (h.includes('typecode')) out.types = rows;
    else if (h.includes('settlementcode')) out.settlements = rows;
    else out.items = rows;
    return out;
  }

  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  for (const key of Object.keys(SHEET_ALIASES) as (keyof ParsedSheets)[]) {
    const name = wb.SheetNames.find(n => SHEET_ALIASES[key].includes(norm(n)));
    if (name) out[key] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) as Record<string, any>[];
  }
  return out;
}

// ---------------- validation ----------------

export interface ValidatedItem {
  code: string; name: string; category: string | null; subcategory: string | null;
  unit: string | null; base_price_copper: number;
  availability_mode: AvailabilityMode; profile_code: string | null;
}
export interface ValidatedSettlement {
  code: string; name: string; type_code: string; price_modifier_pct: number;
  uses_type_default: boolean; size: number | null; wealth: number | null; region: string | null;
}
export interface ValidatedProfile { code: string; name: string; note: string | null; rules: ProfileRules }

export interface ValidationResult {
  items: ValidatedItem[];
  settlements: ValidatedSettlement[];
  types: { code: string; label: string; default_modifier_pct: number }[];
  tags: { code: string; label: string }[];
  tagLinks: { settlement_code: string; tag_code: string }[];
  profiles: ValidatedProfile[];
  exceptions: { item_code: string; settlement_code: string; action: 'ALLOW' | 'DENY' }[];
  errors: string[];
  warnings: string[];
}

const get = (r: Record<string, any>, ...keys: string[]) => {
  const map = new Map(Object.keys(r).map(k => [norm(k), r[k]]));
  for (const k of keys) {
    const v = map.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};
const num = (v: string) => {
  const n = Number(String(v).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
};
const intOrNull = (v: string) => (v === '' ? null : Math.round(num(v)));
const truthy = (v: string) => ['true', '1', 'ano', 'yes', 'x'].includes(v.toLowerCase());

export interface KnownData {
  itemCodes: Set<string>;
  settlementCodes: Set<string>;
  typeCodes: Set<string>;
  tagCodes: Set<string>;
  profileCodes: Set<string>;
}

export function validateImport(sheets: ParsedSheets, known: KnownData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- types ---
  const types = sheets.types.map(r => {
    const label = get(r, 'label', 'nazev', 'nazev typu');
    const code = get(r, 'type_code', 'code', 'kod') || slugify(label);
    return { code, label: label || code, default_modifier_pct: num(get(r, 'default_modifier_pct', 'vychozi', 'pct')) };
  }).filter(t => t.code);
  const typeCodes = new Set([...known.typeCodes, ...types.map(t => t.code)]);

  // --- settlements ---
  const settlements: ValidatedSettlement[] = [];
  const seenSet = new Set<string>();
  sheets.settlements.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'name', 'nazev', 'sidlo');
    const code = get(r, 'settlement_code', 'code', 'kod') || slugify(name);
    if (!name && !code) { errors.push(`SETTLEMENTS ř.${row}: chybí název i kód.`); return; }
    if (seenSet.has(code)) { errors.push(`SETTLEMENTS ř.${row}: duplicitní kód „${code}".`); return; }
    seenSet.add(code);
    const typeRaw = get(r, 'type', 'type_code', 'typ');
    const type_code = typeCodes.has(typeRaw) ? typeRaw : slugify(typeRaw) || 'village';
    if (typeRaw && !typeCodes.has(type_code)) warnings.push(`SETTLEMENTS ř.${row}: neznámý typ „${typeRaw}" — vytvoří se nový.`);
    const size = intOrNull(get(r, 'size', 'velikost'));
    const wealth = intOrNull(get(r, 'wealth', 'bohatstvi'));
    if (size != null && (size < 1 || size > 5)) warnings.push(`SETTLEMENTS ř.${row}: velikost mimo 1–5.`);
    if (wealth != null && (wealth < 1 || wealth > 5)) warnings.push(`SETTLEMENTS ř.${row}: bohatství mimo 1–5.`);
    settlements.push({
      code, name: name || code, type_code,
      price_modifier_pct: num(get(r, 'modifier_pct', 'price_modifier_pct', 'modifikator')),
      uses_type_default: truthy(get(r, 'uses_type_default', 'vychozi typu')),
      size, wealth, region: get(r, 'region') || null,
    });
  });
  const settlementCodes = new Set([...known.settlementCodes, ...settlements.map(s => s.code)]);

  // --- tags ---
  const tagLabels = new Map<string, string>();
  const tagLinks: ValidationResult['tagLinks'] = [];
  sheets.settlementTags.forEach((r, i) => {
    const row = i + 2;
    const sc = get(r, 'settlement_code', 'code', 'sidlo');
    const label = get(r, 'tag', 'label');
    if (!sc || !label) { errors.push(`SETTLEMENT_TAGS ř.${row}: chybí sídlo nebo tag.`); return; }
    if (!settlementCodes.has(sc)) { errors.push(`SETTLEMENT_TAGS ř.${row}: neexistující sídlo „${sc}".`); return; }
    const code = slugify(label);
    if (!known.tagCodes.has(code) && !tagLabels.has(code)) warnings.push(`SETTLEMENT_TAGS: tag „${label}" bude vytvořen.`);
    tagLabels.set(code, label);
    tagLinks.push({ settlement_code: sc, tag_code: code });
  });
  const tags = Array.from(tagLabels, ([code, label]) => ({ code, label }));
  const tagCodes = new Set([...known.tagCodes, ...tags.map(t => t.code)]);

  // --- profiles ---
  const profiles: ValidatedProfile[] = sheets.profiles.map(r => {
    const name = get(r, 'name', 'nazev');
    const code = get(r, 'profile_code', 'code', 'kod') || slugify(name);
    return { code, name: name || code, note: get(r, 'note', 'poznamka') || null, rules: {} as ProfileRules };
  }).filter(p => p.code);
  const profByCode = new Map(profiles.map(p => [p.code, p]));

  sheets.profileRules.forEach((r, i) => {
    const row = i + 2;
    const pc = get(r, 'profile_code', 'profile', 'kod');
    const rule = norm(get(r, 'rule', 'pravidlo'));
    const raw = get(r, 'value', 'hodnota');
    const p = profByCode.get(pc);
    if (!p) { errors.push(`PROFILE_RULES ř.${row}: neznámý profil „${pc}".`); return; }
    const key = (RULE_KEYS as readonly string[]).find(k => norm(k) === rule);
    if (!key) { errors.push(`PROFILE_RULES ř.${row}: neznámé pravidlo „${rule}".`); return; }
    if (LIST_RULES.has(key)) {
      const vals = raw.split(/[;|,]/).map(s => s.trim()).filter(Boolean);
      if (key.startsWith('tags')) vals.forEach(v => { if (!tagCodes.has(v)) warnings.push(`PROFILE_RULES ř.${row}: neznámý tag „${v}".`); });
      if (key === 'type_codes') vals.forEach(v => { if (!typeCodes.has(v)) warnings.push(`PROFILE_RULES ř.${row}: neznámý typ sídla „${v}".`); });
      (p.rules as any)[key] = vals;
    } else {
      (p.rules as any)[key] = raw === '' ? null : Math.round(num(raw));
    }
  });
  const profileCodes = new Set([...known.profileCodes, ...profiles.map(p => p.code)]);

  // --- items ---
  const items: ValidatedItem[] = [];
  const seenItem = new Set<string>();
  sheets.items.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'name', 'nazev');
    const code = get(r, 'item_code', 'code', 'kod') || slugify(name);
    if (!name && !code) { errors.push(`ITEMS ř.${row}: chybí název i kód.`); return; }
    if (seenItem.has(code)) { errors.push(`ITEMS ř.${row}: duplicitní kód „${code}".`); return; }
    seenItem.add(code);

    const modeRaw = get(r, 'availability_mode', 'dostupnost').toUpperCase();
    const mode: AvailabilityMode = (AVAILABILITY_MODES as string[]).includes(modeRaw)
      ? modeRaw as AvailabilityMode : 'INHERIT';
    if (modeRaw && !(AVAILABILITY_MODES as string[]).includes(modeRaw))
      warnings.push(`ITEMS ř.${row}: neznámý režim „${modeRaw}" — použije se INHERIT.`);

    let profile_code: string | null = get(r, 'availability_profile', 'profile_code') || null;
    if (profile_code && !profileCodes.has(profile_code)) {
      const bySlug = slugify(profile_code);
      if (profileCodes.has(bySlug)) profile_code = bySlug;
      else { errors.push(`ITEMS ř.${row}: neexistující profil „${profile_code}".`); profile_code = null; }
    }

    const baseTxt = get(r, 'base_price', 'base_price_copper', 'zaklad', 'cena');
    items.push({
      code, name: name || code,
      category: get(r, 'category', 'kategorie') || null,
      subcategory: get(r, 'subcategory', 'podkategorie') || null,
      unit: get(r, 'unit', 'jednotka') || null,
      base_price_copper: textToCopper(baseTxt),
      availability_mode: mode,
      profile_code,
    });
  });
  const itemCodes = new Set([...known.itemCodes, ...items.map(i => i.code)]);

  // --- exceptions ---
  const exceptions: ValidationResult['exceptions'] = [];
  const seenEx = new Set<string>();
  sheets.exceptions.forEach((r, i) => {
    const row = i + 2;
    const ic = get(r, 'item_code', 'item', 'kod');
    const sc = get(r, 'settlement_code', 'settlement', 'sidlo');
    const action = get(r, 'action', 'akce').toUpperCase();
    if (!ic || !sc) { errors.push(`ITEM_EXCEPTIONS ř.${row}: chybí item_code nebo settlement_code.`); return; }
    if (!itemCodes.has(ic)) { errors.push(`ITEM_EXCEPTIONS ř.${row}: neexistující položka „${ic}".`); return; }
    if (!settlementCodes.has(sc)) { errors.push(`ITEM_EXCEPTIONS ř.${row}: neexistující sídlo „${sc}".`); return; }
    if (action !== 'ALLOW' && action !== 'DENY') { errors.push(`ITEM_EXCEPTIONS ř.${row}: akce musí být ALLOW nebo DENY.`); return; }
    const key = `${ic}|${sc}`;
    if (seenEx.has(key)) { errors.push(`ITEM_EXCEPTIONS ř.${row}: duplicitní výjimka „${key}".`); return; }
    seenEx.add(key);
    exceptions.push({ item_code: ic, settlement_code: sc, action });
  });

  return { items, settlements, types, tags, tagLinks, profiles, exceptions, errors, warnings };
}
