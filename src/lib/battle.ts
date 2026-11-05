export function clampHP(value: number, max: number) {
  return Math.max(0, Math.min(Math.max(0, max), Number.isFinite(value) ? Math.floor(value) : 0));
}
export function actualDamage(amount: number, hp: number) {
  return Math.min(Math.max(0, Math.floor(amount || 0)), Math.max(0, hp));
}
export function hpStatus(current: number, max: number) {
  const ratio = max > 0 ? current / max : 0;
  return current <= 0 ? 'dead' : ratio <= .15 ? 'critical' : ratio <= .5 ? 'warning' : 'healthy';
}export function parseAttack(text: string) {
  const nums = (text.match(/[+-]?\s*\d+/g) || []).map(s => Number(s.replace(/\s/g, '')));
  return nums.length ? { roll: nums[0], bonus: nums.slice(1).reduce((a, b) => a + b, 0) } : { roll: 0, bonus: 0 };
}
export function num(v: string | number) { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; }
export function combatResult(zco: number, defenseRolls: number[], attackRoll: number, attackBonus: number, weapon: number) {
  const defense = num(zco) + defenseRolls.reduce((a, b) => a + b, 0);
  const attack = num(attackRoll) + num(attackBonus);
  const diff = attack - defense;
  const damage = diff <= 0 ? 0 : Math.max(0, diff + num(weapon));
  return { defense, attack, diff, damage };
}
