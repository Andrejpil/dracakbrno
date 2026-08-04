// Import / export helpers for the pricing module (XLSX, CSV, ZIP).
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { copperToParts, partsToCopper } from '@/lib/pricing';

export type AvailabilityMode = 'EVERYWHERE' | 'ONLY_SELECTED' | 'EXCEPT_SELECTED' | 'NOWHERE';

export const AVAILABILITY_MODES: AvailabilityMode[] = ['EVERYWHERE', 'ONLY_SELECTED', 'EXCEPT_SELECTED', 'NOWHERE'];

export const AVAILABILITY_LABELS: Record<AvailabilityMode, string> = {
  EVERYWHERE: 'Dostupné všude',
  ONLY_SELECTED: 'Dostupné pouze ve vybraných sídlech',
  EXCEPT_SELECTED: 'Dostupné všude kromě vybraných sídel',
  NOWHERE: 'Nedostupné nikde',
};

export interface ExportItem {
  item_id: string;
  item_code: string;
  name: string;
  category: string;
  unit: string;
  base_gold: number;
  base_silver: number;
  base_copper: number;
  availability_mode: AvailabilityMode;
  note: string;
}

export interface ExportSettlement {
  settlement_id: string;
  settlement_code: string;
  name: string;
  settlement_type: string;
  price_modifier_percent: number;
  uses_type_default: boolean | string;
  note: string;
}

export interface ExportAvailability {
  item_code: string;
  settlement_code: string;
  override_percent: number | '';
}

export interface ExportTypeRow {
  type_code: string;
  label: string;
  default_modifier_percent: number;
}

export interface PricingExportData {
  items: ExportItem[];
  settlements: ExportSettlement[];
  availability: ExportAvailability[];
  types: ExportTypeRow[];
}

export function itemToExport(it: {
  id: string; code: string | null; name: string; category: string | null;
  unit: string | null; note: string | null; base_price_copper: number; availability_mode: string;
}): ExportItem {
  const p = copperToParts(it.base_price_copper);
  return {
    item_id: it.id,
    item_code: it.code || '',
    name: it.name,
    category: it.category || '',
    unit: it.unit || '',
    base_gold: p.zl,
    base_silver: p.st,
    base_copper: p.md,
    availability_mode: (it.availability_mode as AvailabilityMode) || 'EVERYWHERE',
    note: it.note || '',
  };
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items), 'Polozky');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.settlements), 'Sidla');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.availability), 'Dostupnost');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.types), 'TypySidel');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(new Blob([out], { type: 'application/octet-stream' }), filename);
}

export function rowsToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '\uFEFF';
  const header = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
}

export function downloadCsv(rows: Record<string, any>[], filename: string) {
  download(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function downloadZip(data: PricingExportData, filename = 'cenik-csv.zip') {
  const zip = new JSZip();
  zip.file('items.csv', rowsToCsv(data.items));
  zip.file('settlements.csv', rowsToCsv(data.settlements));
  zip.file('availability.csv', rowsToCsv(data.availability));
  zip.file('settlement_types.csv', rowsToCsv(data.types));
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, filename);
}

// ---------------- parsing ----------------

export interface ParsedSheets {
  items: Record<string, any>[];
  settlements: Record<string, any>[];
  availability: Record<string, any>[];
  types: Record<string, any>[];
}

function csvToRows(text: string): Record<string, any>[] {
  const wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
}

function pickSheet(wb: XLSX.WorkBook, keys: string[]): Record<string, any>[] {
  const name = wb.SheetNames.find(n => {
    const s = n.toLowerCase().replace(/[^a-z]/g, '');
    return keys.some(k => s.includes(k));
  });
  if (!name) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) as Record<string, any>[];
}

export async function parseImportFile(file: File): Promise<ParsedSheets> {
  const lower = file.name.toLowerCase();
  const empty: ParsedSheets = { items: [], settlements: [], availability: [], types: [] };

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const read = async (match: string[]) => {
      const name = Object.keys(zip.files).find(n => match.some(m => n.toLowerCase().includes(m)));
      if (!name) return [];
      return csvToRows(await zip.files[name].async('string'));
    };
    return {
      items: await read(['item', 'polozk']),
      settlements: await read(['settlement', 'sidl']),
      availability: await read(['availab', 'dostupn']),
      types: await read(['type', 'typy']),
    };
  }

  if (lower.endsWith('.csv')) {
    const rows = csvToRows(await file.text());
    const h = Object.keys(rows[0] || {}).map(k => k.toLowerCase());
    if (h.includes('settlement_code') && h.includes('item_code')) return { ...empty, availability: rows };
    if (h.includes('settlement_code')) return { ...empty, settlements: rows };
    if (h.includes('type_code')) return { ...empty, types: rows };
    return { ...empty, items: rows };
  }

  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return {
    items: pickSheet(wb, ['polozk', 'item']),
    settlements: pickSheet(wb, ['sidl', 'settlement']),
    availability: pickSheet(wb, ['dostupnost', 'availability']),
    types: pickSheet(wb, ['typysidel', 'types']),
  };
}

// ---------------- validation ----------------

export interface ValidatedItem {
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  note: string | null;
  base_price_copper: number;
  availability_mode: AvailabilityMode;
}
export interface ValidatedSettlement {
  code: string;
  name: string;
  type_code: string;
  price_modifier_pct: number;
  uses_type_default: boolean;
  note: string | null;
}
export interface ValidatedType {
  code: string;
  label: string;
  default_modifier_pct: number;
}
export interface ValidationResult {
  items: ValidatedItem[];
  settlements: ValidatedSettlement[];
  types: ValidatedType[];
  availability: { item_code: string; settlement_code: string; override: number | null }[];
  errors: string[];
}

const get = (r: Record<string, any>, ...keys: string[]) => {
  const map = new Map(Object.keys(r).map(k => [k.toLowerCase().trim(), r[k]]));
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const num = (v: string) => {
  const n = Number(String(v).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
};

export function slugify(txt: string): string {
  return (txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kod';
}

export function validateImport(
  sheets: ParsedSheets,
  known: { itemCodes: Set<string>; settlementCodes: Set<string>; typeCodes: Set<string> }
): ValidationResult {
  const errors: string[] = [];
  const types: ValidatedType[] = [];
  const settlements: ValidatedSettlement[] = [];
  const items: ValidatedItem[] = [];
  const availability: ValidationResult['availability'] = [];

  sheets.types.forEach((r, i) => {
    const code = get(r, 'type_code', 'kod', 'code');
    const label = get(r, 'label', 'nazev', 'name');
    if (!code && !label) return;
    const c = code || slugify(label);
    types.push({ code: c, label: label || c, default_modifier_pct: num(get(r, 'default_modifier_percent', 'modifikator', 'pct')) });
  });
  const typeCodes = new Set([...known.typeCodes, ...types.map(t => t.code)]);

  sheets.settlements.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'name', 'nazev', 'název');
    const code = get(r, 'settlement_code', 'kod', 'code') || slugify(name);
    if (!name && !code) { errors.push(`Sídla, řádek ${row}: chybí název i kód — přeskočeno.`); return; }
    const type_code = get(r, 'settlement_type', 'typ', 'type_code') || 'village';
    if (!typeCodes.has(type_code)) errors.push(`Sídla, řádek ${row}: neznámý typ „${type_code}" — vytvoří se nový typ.`);
    const usesRaw = get(r, 'uses_type_default', 'vychozi', 'výchozí').toLowerCase();
    settlements.push({
      code,
      name: name || code,
      type_code,
      price_modifier_pct: num(get(r, 'price_modifier_percent', 'modifikator', 'modifikátor')),
      uses_type_default: ['1', 'true', 'ano', 'yes', 'x'].includes(usesRaw),
      note: get(r, 'note', 'poznamka', 'poznámka') || null,
    });
  });

  const seenItem = new Set<string>();
  sheets.items.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'name', 'nazev', 'název');
    const code = get(r, 'item_code', 'kod', 'code') || slugify(name);
    if (!name && !code) { errors.push(`Položky, řádek ${row}: chybí název i kód — přeskočeno.`); return; }
    if (seenItem.has(code)) { errors.push(`Položky, řádek ${row}: duplicitní kód „${code}" — přeskočeno.`); return; }
    seenItem.add(code);
    let mode = (get(r, 'availability_mode', 'dostupnost') || 'EVERYWHERE').toUpperCase() as AvailabilityMode;
    if (!AVAILABILITY_MODES.includes(mode)) {
      errors.push(`Položky, řádek ${row}: neznámý režim dostupnosti „${mode}" — použije se EVERYWHERE.`);
      mode = 'EVERYWHERE';
    }
    items.push({
      code,
      name: name || code,
      category: get(r, 'category', 'kategorie') || null,
      unit: get(r, 'unit', 'jednotka') || null,
      note: get(r, 'note', 'poznamka', 'poznámka') || null,
      base_price_copper: partsToCopper(num(get(r, 'base_gold', 'zl')), num(get(r, 'base_silver', 'st')), num(get(r, 'base_copper', 'md'))),
      availability_mode: mode,
    });
  });

  const itemCodes = new Set([...known.itemCodes, ...items.map(i => i.code)]);
  const settlementCodes = new Set([...known.settlementCodes, ...settlements.map(s => s.code)]);

  sheets.availability.forEach((r, i) => {
    const row = i + 2;
    const ic = get(r, 'item_code', 'kod_polozky');
    const sc = get(r, 'settlement_code', 'kod_sidla');
    if (!ic && !sc) return;
    if (!itemCodes.has(ic)) { errors.push(`Dostupnost, řádek ${row}: neexistující item_code „${ic}".`); return; }
    if (!settlementCodes.has(sc)) { errors.push(`Dostupnost, řádek ${row}: neexistující settlement_code „${sc}".`); return; }
    const ov = get(r, 'override_percent', 'prepis');
    availability.push({ item_code: ic, settlement_code: sc, override: ov === '' ? null : num(ov) });
  });

  return { items, settlements, types, availability, errors };
}
