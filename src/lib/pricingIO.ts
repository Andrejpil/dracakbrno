// Import / export helpers for the pricing module.
// Workbook layout (uživatelský formát):
//   list SIDLA — typy sídel:  NÁZEV TYPŮ | KÓD | VÝCHOZÍ %
//   list MESTA — sídla:       Sídlo | KÓD | TYP | Výsledný modifikátor | ZDROJ
//   list ITEM  — předměty:    Název | Kód | Kategorie | Jednotka | Základ | Dostupnost | <sloupec za každé sídlo>
// Buňka sídla v listu ITEM: TRUE / FALSE, nebo číslo = vlastní přepis % pro dané sídlo.
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { copperToParts, partsToCopper, formatCopper } from '@/lib/pricing';

export type AvailabilityMode = 'EVERYWHERE' | 'ONLY_SELECTED' | 'EXCEPT_SELECTED' | 'NOWHERE';

export const AVAILABILITY_MODES: AvailabilityMode[] = ['EVERYWHERE', 'ONLY_SELECTED', 'EXCEPT_SELECTED', 'NOWHERE'];

export const AVAILABILITY_LABELS: Record<AvailabilityMode, string> = {
  EVERYWHERE: 'Dostupné všude',
  ONLY_SELECTED: 'Dostupné pouze ve vybraných sídlech',
  EXCEPT_SELECTED: 'Dostupné všude kromě vybraných sídel',
  NOWHERE: 'Nedostupné nikde',
};

export const SHEET_TYPES = 'SIDLA';
export const SHEET_SETTLEMENTS = 'MESTA';
export const SHEET_ITEMS = 'ITEM';

export const SOURCE_OWN = 'Vlastní hodnota';
export const SOURCE_TYPE = 'Výchozí typu';

// ---------------- shared shapes ----------------

export interface ExportType {
  code: string;
  label: string;
  default_modifier_pct: number;
}

export interface ExportSettlement {
  code: string;
  name: string;
  type_code: string;
  type_label: string;
  effective_pct: number;
  uses_type_default: boolean;
}

export interface ExportItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  base_price_copper: number;
  availability_mode: AvailabilityMode;
  /** klíč = kód sídla, hodnota = true / false / číslo (přepis %) */
  cells: Record<string, boolean | number>;
}

export interface PricingExportData {
  types: ExportType[];
  settlements: ExportSettlement[];
  items: ExportItem[];
}

// ---------------- currency text ----------------

/** 123 md -> "1 zl 2 st 3 md" */
export function copperToText(copper: number): string {
  return formatCopper(copper);
}

/** "4 st", "1 zl 2 st", "35" (= md) -> počet měďáků */
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

// ---------------- writers ----------------

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function typeRows(data: PricingExportData): Record<string, any>[] {
  return data.types.map(t => ({
    'NÁZEV TYPŮ': t.label,
    'KÓD': t.code,
    'VÝCHOZÍ %': t.default_modifier_pct,
  }));
}

export function settlementRows(data: PricingExportData): Record<string, any>[] {
  return data.settlements.map(s => ({
    'Sídlo': s.name,
    'KÓD': s.code,
    'TYP': s.type_label || s.type_code,
    'Výsledný modifikátor': s.effective_pct,
    'ZDROJ': s.uses_type_default ? SOURCE_TYPE : SOURCE_OWN,
  }));
}

export function itemRows(data: PricingExportData): Record<string, any>[] {
  return data.items.map(it => {
    const row: Record<string, any> = {
      'Název': it.name,
      'Kód': it.code,
      'Kategorie': it.category,
      'Jednotka': it.unit,
      'Základ': copperToText(it.base_price_copper),
      'Dostupnost': AVAILABILITY_LABELS[it.availability_mode],
    };
    for (const s of data.settlements) {
      const v = it.cells[s.code];
      row[s.name] = typeof v === 'number' ? v : v === true;
    }
    return row;
  });
}

export function downloadXlsx(data: PricingExportData, filename = 'cenik.xlsx') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settlementRows(data)), SHEET_SETTLEMENTS);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(typeRows(data)), SHEET_TYPES);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows(data)), SHEET_ITEMS);
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
  zip.file('MESTA.csv', rowsToCsv(settlementRows(data)));
  zip.file('SIDLA.csv', rowsToCsv(typeRows(data)));
  zip.file('ITEM.csv', rowsToCsv(itemRows(data)));
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, filename);
}

// ---------------- parsing ----------------

export interface ParsedSheets {
  types: Record<string, any>[];
  settlements: Record<string, any>[];
  items: Record<string, any>[];
}

function csvToRows(text: string): Record<string, any>[] {
  const wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function pickSheet(wb: XLSX.WorkBook, keys: string[]): Record<string, any>[] {
  const name = wb.SheetNames.find(n => keys.includes(norm(n)));
  if (!name) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) as Record<string, any>[];
}

export async function parseImportFile(file: File): Promise<ParsedSheets> {
  const lower = file.name.toLowerCase();
  const empty: ParsedSheets = { types: [], settlements: [], items: [] };

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const read = async (match: string[]) => {
      const name = Object.keys(zip.files).find(n => match.includes(norm(n.replace(/\.csv$/i, ''))));
      if (!name) return [];
      return csvToRows(await zip.files[name].async('string'));
    };
    return {
      settlements: await read(['mesta', 'settlements', 'sidla']),
      types: await read(['sidla', 'typysidel', 'types']),
      items: await read(['item', 'items', 'polozky']),
    };
  }

  if (lower.endsWith('.csv')) {
    const rows = csvToRows(await file.text());
    const h = Object.keys(rows[0] || {}).map(norm);
    if (h.includes('nazevtypu')) return { ...empty, types: rows };
    if (h.includes('sidlo')) return { ...empty, settlements: rows };
    return { ...empty, items: rows };
  }

  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return {
    settlements: pickSheet(wb, ['mesta', 'settlements']),
    types: pickSheet(wb, ['sidla', 'typysidel', 'types']),
    items: pickSheet(wb, ['item', 'items', 'polozky']),
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

export function slugify(txt: string): string {
  return (txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kod';
}

const TRUE_WORDS = ['true', '1', 'ano', 'yes', 'x', 'ok', 'a'];
const FALSE_WORDS = ['false', '0', 'ne', 'no', ''];

/** Vrátí true/false/číslo (přepis %) nebo null pokud buňka nic neříká. */
function readCell(v: any): boolean | number | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (TRUE_WORDS.includes(s)) return true;
  if (FALSE_WORDS.includes(s)) return false;
  const n = Number(s.replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const ITEM_FIXED = ['nazev', 'kod', 'kategorie', 'jednotka', 'zaklad', 'dostupnost', 'poznamka'];

export function validateImport(
  sheets: ParsedSheets,
  known: {
    itemCodes: Set<string>;
    settlementCodes: Set<string>;
    typeCodes: Set<string>;
    /** existující sídla ve světě: název -> kód (pro párování sloupců v listu ITEM) */
    settlementCodeByName?: Map<string, string>;
    /** existující typy: label -> kód */
    typeCodeByLabel?: Map<string, string>;
  }
): ValidationResult {
  const errors: string[] = [];
  const types: ValidatedType[] = [];
  const settlements: ValidatedSettlement[] = [];
  const items: ValidatedItem[] = [];
  const availability: ValidationResult['availability'] = [];

  // --- SIDLA: typy ---
  sheets.types.forEach(r => {
    const label = get(r, 'NÁZEV TYPŮ', 'nazev typu', 'label', 'nazev');
    const code = get(r, 'KÓD', 'kod', 'code') || slugify(label);
    if (!label && !code) return;
    types.push({ code, label: label || code, default_modifier_pct: num(get(r, 'VÝCHOZÍ %', 'vychozi', 'default_modifier_percent', 'pct')) });
  });

  const typeCodeByLabel = new Map<string, string>(known.typeCodeByLabel || []);
  types.forEach(t => typeCodeByLabel.set(norm(t.label), t.code));
  const typeCodes = new Set([...known.typeCodes, ...types.map(t => t.code)]);

  // --- MESTA: sídla ---
  sheets.settlements.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'Sídlo', 'sidlo', 'nazev', 'name');
    const code = get(r, 'KÓD', 'kod', 'code') || slugify(name);
    if (!name && !code) { errors.push(`MESTA, řádek ${row}: chybí název i kód — přeskočeno.`); return; }
    const typeRaw = get(r, 'TYP', 'typ', 'type');
    const type_code = typeCodes.has(typeRaw) ? typeRaw : (typeCodeByLabel.get(norm(typeRaw)) || slugify(typeRaw) || 'village');
    if (!typeCodes.has(type_code)) errors.push(`MESTA, řádek ${row}: neznámý typ „${typeRaw}" — vytvoří se nový typ.`);
    const src = norm(get(r, 'ZDROJ', 'zdroj'));
    settlements.push({
      code,
      name: name || code,
      type_code,
      price_modifier_pct: num(get(r, 'Výsledný modifikátor', 'vysledny modifikator', 'modifikator', 'price_modifier_percent')),
      uses_type_default: src.includes('vychozi') || src.includes('typ'),
      note: get(r, 'poznamka', 'note') || null,
    });
  });

  // Sídlo: název -> kód (nová i existující)
  const codeByName = new Map<string, string>(known.settlementCodeByName || []);
  settlements.forEach(s => codeByName.set(norm(s.name), s.code));
  const settlementCodes = new Set([...known.settlementCodes, ...settlements.map(s => s.code)]);

  // --- ITEM: položky + matice dostupnosti ---
  const seenItem = new Set<string>();
  const unknownCols = new Set<string>();

  sheets.items.forEach((r, i) => {
    const row = i + 2;
    const name = get(r, 'Název', 'nazev', 'name');
    const code = get(r, 'Kód', 'kod', 'code') || slugify(name);
    if (!name && !code) { errors.push(`ITEM, řádek ${row}: chybí název i kód — přeskočeno.`); return; }
    if (seenItem.has(code)) { errors.push(`ITEM, řádek ${row}: duplicitní kód „${code}" — přeskočeno.`); return; }
    seenItem.add(code);

    // matice sídel
    const trueCells: { code: string; override: number | null }[] = [];
    const falseCells: string[] = [];
    let anyOverride = false;
    let anyCell = false;

    for (const key of Object.keys(r)) {
      const nk = norm(key);
      if (ITEM_FIXED.includes(nk)) continue;
      const sc = settlementCodes.has(key.trim()) ? key.trim() : codeByName.get(nk);
      if (!sc) { if (String(r[key] ?? '').trim() !== '') unknownCols.add(key); continue; }
      const val = readCell(r[key]);
      if (val === null) continue;
      anyCell = true;
      if (val === false) falseCells.push(sc);
      else if (val === true) trueCells.push({ code: sc, override: null });
      else { trueCells.push({ code: sc, override: val }); anyOverride = true; }
    }

    let mode: AvailabilityMode;
    if (!anyCell) {
      const declared = norm(get(r, 'Dostupnost', 'dostupnost', 'availability_mode'));
      mode = declared.includes('nikde') ? 'NOWHERE'
        : declared.includes('krome') ? 'EXCEPT_SELECTED'
          : declared.includes('pouze') ? 'ONLY_SELECTED'
            : (AVAILABILITY_MODES.includes(declared.toUpperCase() as AvailabilityMode) ? declared.toUpperCase() as AvailabilityMode : 'EVERYWHERE');
    } else if (trueCells.length === 0) {
      mode = 'NOWHERE';
    } else if (falseCells.length === 0 && !anyOverride) {
      mode = 'EVERYWHERE';
    } else if (anyOverride || trueCells.length <= falseCells.length) {
      mode = 'ONLY_SELECTED';
      trueCells.forEach(t => availability.push({ item_code: code, settlement_code: t.code, override: t.override }));
    } else {
      mode = 'EXCEPT_SELECTED';
      falseCells.forEach(sc => availability.push({ item_code: code, settlement_code: sc, override: null }));
    }

    items.push({
      code,
      name: name || code,
      category: get(r, 'Kategorie', 'kategorie', 'category') || null,
      unit: get(r, 'Jednotka', 'jednotka', 'unit') || null,
      note: get(r, 'poznamka', 'note') || null,
      base_price_copper: textToCopper(get(r, 'Základ', 'zaklad', 'base', 'cena')),
      availability_mode: mode,
    });
  });

  unknownCols.forEach(c => errors.push(`ITEM: sloupec „${c}" neodpovídá žádnému sídlu — ignorováno.`));

  return { items, settlements, types, availability, errors };
}
