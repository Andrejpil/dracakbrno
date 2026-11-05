import { describe, expect, it } from 'vitest';
import { actualDamage, clampHP, hpStatus } from './battle';
describe('Pravidla boje', () => {
  it('zásah 23 do 40 HP odebere 23 HP', () => expect(40 - actualDamage(23, 40)).toBe(17));
  it('plošný zásah 8 + 15 + 23 připíše 46 HP', () => expect([8, 15, 23].reduce((n, v) => n + actualDamage(v, 40), 0)).toBe(46));
  it('nezapočítává přebytečné poškození', () => expect(actualDamage(23, 8)).toBe(8));
  it('HP nejsou záporná', () => expect(clampHP(-5, 40)).toBe(0));
  it('HP nepřekročí maximum', () => expect(clampHP(50, 40)).toBe(40));
  it('korekce po jednom HP', () => expect(clampHP(23.7, 40)).toBe(23));
  it('mrtvá bestie je šedá', () => expect(hpStatus(0, 40)).toBe('dead'));
  it('kritický stav do 15 procent', () => expect(hpStatus(6, 40)).toBe('critical'));
  it('nízký stav do 50 procent', () => expect(hpStatus(20, 40)).toBe('warning'));
  it('zdravá bestie nad 50 procent', () => expect(hpStatus(21, 40)).toBe('healthy'));
});import { combatResult, parseAttack } from './battle';
describe('Bojová kalkulačka', () => {
  it('hod obrany 6+6+6+2 se ZČO 8 dá obranu 28', () => expect(combatResult(8, [6, 6, 6, 2], 0, 0, 0).defense).toBe(28));
  it('bez hodu obrany platí jen ZČO', () => expect(combatResult(8, [], 0, 0, 0).defense).toBe(8));
  it('útok „15 +3“ je 18', () => { const a = parseAttack('15 +3'); expect(a.roll + a.bonus).toBe(18); });
  it('vzorový příklad dá zranění 5', () => expect(combatResult(8, [6, 2], 15, 3, 3).damage).toBe(5));
  it('rozdíl 0 nebo méně = žádné zranění i se zbraní', () => expect(combatResult(8, [6, 2], 10, 6, 5).damage).toBe(0));
  it('záporný modifikátor nesníží zranění pod 0', () => expect(combatResult(8, [], 10, 0, -5).damage).toBe(0));
});
