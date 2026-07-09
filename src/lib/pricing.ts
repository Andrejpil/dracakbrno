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
