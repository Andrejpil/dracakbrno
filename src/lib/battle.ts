export function clampHP(value: number, max: number) {
  return Math.max(0, Math.min(Math.max(0, max), Number.isFinite(value) ? Math.floor(value) : 0));
}
export function actualDamage(amount: number, hp: number) {
  return Math.min(Math.max(0, Math.floor(amount || 0)), Math.max(0, hp));
}
export function hpStatus(current: number, max: number) {
  const ratio = max > 0 ? current / max : 0;
  return current <= 0 ? 'dead' : ratio <= .15 ? 'critical' : ratio <= .5 ? 'warning' : 'healthy';
}