import { useState } from 'react';
import { combatResult, num, parseAttack } from '@/lib/battle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sword, RotateCcw } from 'lucide-react';

interface Props {
  zco: number; dead: boolean; busy: boolean;
  heroes: { id: string; name: string }[]; attacker: string; setAttacker: (id: string) => void;
  apply: (damage: number) => Promise<boolean>;
}
export default function CombatCalculator({ zco, dead, busy, heroes, attacker, setAttacker, apply }: Props) {
  const [rolls, setRolls] = useState<number[]>([]);
  const [quick, setQuick] = useState('');
  const [roll, setRoll] = useState('');
  const [bonus, setBonus] = useState('');
  const [weapon, setWeapon] = useState('');
  const r = combatResult(zco, rolls, num(roll), num(bonus), num(weapon));
  const defRoll = rolls.reduce((a, b) => a + b, 0);
  const hasAttack = roll !== '' || bonus !== '';
  const onQuick = (v: string) => { setQuick(v); const p = parseAttack(v); setRoll(v.trim() ? String(p.roll) : ''); setBonus(v.trim() ? String(p.bonus) : ''); };
  const submit = async () => {
    if (!r.damage || busy) return;
    if (await apply(r.damage)) { setRolls([]); setQuick(''); setRoll(''); setBonus(''); }
  };
  return <div className="border-t pt-4 space-y-4">
    <h4 className="font-semibold">Bojová kalkulačka</h4>
    <div>
      <p className="text-sm mb-2">Útočník</p>
      <div className="flex flex-wrap gap-1">{heroes.map(h => <Button key={h.id} size="sm" variant={attacker === h.id ? 'default' : 'outline'} aria-pressed={attacker === h.id} onClick={() => setAttacker(h.id)}>{h.name}</Button>)}</div>
    </div>
    <div className="rounded-md bg-muted/40 p-3 space-y-2">
      <p className="text-sm">Hod obrany (ZČO {zco})</p>
      <div className="grid grid-cols-6 gap-2">{[1, 2, 3, 4, 5, 6].map(n => <Button key={n} variant="outline" className="h-12 text-lg font-bold" disabled={busy} onClick={() => setRolls(p => [...p, n])}>{n}</Button>)}</div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground truncate">{rolls.length ? rolls.join(' + ') : 'Žádný hod'}</span>
        <Button variant="ghost" size="sm" disabled={!rolls.length} onClick={() => setRolls([])}><RotateCcw size={14} className="mr-1" />Vymazat hod</Button>
      </div>
      <p className="text-sm">Základní obrana: <b>{zco}</b> · Hod obrany: <b>+{defRoll}</b> · Výsledná obrana: <b className="text-primary">{r.defense}</b></p>
    </div>
    <div className="space-y-2">
      <Input aria-label="Rychlý útok" placeholder="Útok, např. 15 +3" value={quick} onChange={e => onQuick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit(); }} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">Hod útoku<Input type="number" value={roll} onChange={e => { setRoll(e.target.value); setQuick(''); }} /></label>
        <label className="text-xs">Bonus útoku<Input type="number" value={bonus} onChange={e => { setBonus(e.target.value); setQuick(''); }} /></label>
        <label className="text-xs">Modifikátor zbraně<Input type="number" value={weapon} onChange={e => setWeapon(e.target.value)} /></label>
      </div>
    </div>
    <div className="rounded-md border p-3 text-sm space-y-1">
      <p>Výsledný útok: <b>{r.attack}</b> · Rozdíl: <b>{r.attack} − {r.defense} = {r.diff}</b></p>
      <p className="text-lg">Zranění: <b className={r.damage ? 'text-hp-critical' : 'text-muted-foreground'}>{r.damage}</b>{hasAttack && !r.damage && <span className="text-muted-foreground text-sm ml-2">Útok neprošel obranou</span>}</p>
    </div>
    <Button variant="destructive" className="w-full h-12 text-base" disabled={busy || dead || !r.damage || !attacker} onClick={() => void submit()}><Sword size={18} className="mr-2" />{busy ? 'Ukládání…' : `Aplikovat zranění ${r.damage}`}</Button>
  </div>;
}
