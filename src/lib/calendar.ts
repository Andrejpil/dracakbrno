export const MONTH_NAMES = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
];

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function formatGameDate(day: number, month: number, year: number, era: string) {
  return `${day}. ${MONTH_NAMES[month - 1]} ${year} rok ${era}`;
}

export function shiftDate(day: number, month: number, year: number, delta: number) {
  let d = day, m = month, y = year;
  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      d++;
      if (d > DAYS_IN_MONTH[m - 1]) { d = 1; m++; if (m > 12) { m = 1; y++; } }
    }
  } else {
    for (let i = 0; i < -delta; i++) {
      d--;
      if (d < 1) { m--; if (m < 1) { m = 12; y--; } d = DAYS_IN_MONTH[m - 1]; }
    }
  }
  return { day: d, month: m, year: y };
}

export function isDateInRange(
  day: number, month: number, year: number,
  sd: number, sm: number, ed: number, em: number, ey: number | null
) {
  if (ey && ey !== year) return false;
  const cur = month * 100 + day;
  const start = sm * 100 + sd;
  const end = em * 100 + ed;
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end;
}
