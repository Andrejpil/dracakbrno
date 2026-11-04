import { useState } from 'react';
import { BattleMonster, calculateXP } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Copy, Skull, Sword, Trash2 } from 'lucide-react';

interface Props {
  monster: BattleMonster;
  label?: string;
  heroes: { id: string; name: string }[];
  selected: boolean;
  active: boolean;
  editable: boolean;
  busy: boolean;
  open: () => void;
  copy: () => void;
  remove: () => void;
  hit: (heroId: string, amount: number) => Promise<boolean>;
}

const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

export default function MonsterCard({ monster: m, label, heroes, selected, active, editable, busy, open, copy, remove, hit }: Props) {
  const dead = m.currentHP <= 0;
  const name = label ?? m.name;
  const [hero, setHero] = useState('');
  const [amount, setAmount] = useState('');
  const valid = !!hero && Number.isInteger(Number(amount)) && Number(amount) > 0;
  const submit = async () => { if (valid && !busy && !dead && await hit(hero, Number(amount))) setAmount(''); };
  return <article aria-label={`Karta ${name}`} className={`min-w-0 rounded-md border bg-card p-2 space-y-2 ${selected ? 'border-primary ring-1 ring-primary' : active ? 'border-hp-healthy ring-1 ring-hp-healthy' : 'border-border'}`}>
    <div className="flex items-start justify-between gap-1">
      <h4 className={`font-display text-sm break-words min-w-0 ${dead ? 'line-through text-muted-foreground' : ''}`}>{name}</h4>
      {editable && <div className="flex shrink-0"><Button variant="ghost" size="icon" className="h-7 w-7" title={`Kopírovat ${m.name}`} disabled={busy} onClick={copy}><Copy size={14}/></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title={`Odebrat ${m.name}`} disabled={busy} onClick={remove}><Trash2 size={14}/></Button></div>}
    </div>
    <div className="flex gap-2 items-start">
      <button type="button" onClick={open} title={`Detail ${m.name}`} className="shrink-0">
        {m.image_url ? <img src={m.image_url} alt={m.name} width={150} height={150} className="h-[150px] w-[150px] rounded-md object-cover"/> : <div className="h-[150px] w-[150px] rounded-md bg-muted flex items-center justify-center"><Skull size={36} className="text-muted-foreground"/></div>}
      </button>
      <div className="space-y-1 text-xs min-w-0 flex-1"><p className="text-muted-foreground">Úr. {m.level}</p><HPBar current={m.currentHP} max={m.hp}/><p>MP {m.currentMP}/{m.mp}</p><p>Út {m.attack} · Ob {m.defense}</p><p className="text-muted-foreground">XP {calculateXP(m.xp_reward, m.level)}</p>{dead && <p className="text-hp-dead">Padl</p>}</div>
    </div>
    <div className="flex flex-wrap gap-1"><BonusBadge label="SÍL" value={m.str}/><BonusBadge label="ODO" value={m.con}/><BonusBadge label="OBR" value={m.dex}/><BonusBadge label="INT" value={m.int}/><BonusBadge label="CHA" value={m.cha}/></div>
    {m.special && <p className="text-xs text-muted-foreground break-words line-clamp-2" title={m.special}>{m.special}</p>}
    {editable && !dead && <div className="border-t pt-2 space-y-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label={`Kdo zranil ${m.name}`}>
        {heroes.map(h => <button key={h.id} type="button" title={h.name} aria-pressed={hero === h.id} disabled={busy} onClick={() => setHero(h.id)} className={`h-8 w-8 rounded-full text-[11px] font-semibold border transition-colors ${hero === h.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-primary border-border hover:border-primary'}`}>{initials(h.name)}</button>)}
      </div>
      <div className="flex gap-1">
        <Input aria-label={`Poškození ${m.name}`} type="number" min={1} step={1} placeholder={hero ? 'HP' : 'Vyber token'} className="h-8 text-sm" value={amount} disabled={busy || !hero} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit(); }}/>
        <Button size="sm" variant="destructive" className="h-8 px-2 shrink-0" title="Odečíst poškození" disabled={busy || !valid} onClick={() => void submit()}><Sword size={14}/></Button>
      </div>
    </div>}
    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" aria-label={`Detail ${m.name}`} onClick={open}>{editable ? 'Detail, léčení a korekce HP' : 'Detail bestie'}</Button>
  </article>;
}
