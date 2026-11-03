import { BattleMonster, calculateXP } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Copy, Skull, Sword, Trash2 } from 'lucide-react';

interface Props {
  monster: BattleMonster;
  selected: boolean;
  active: boolean;
  editable: boolean;
  busy: boolean;
  open: () => void;
  copy: () => void;
  remove: () => void;
}

export default function MonsterCard({ monster: m, selected, active, editable, busy, open, copy, remove }: Props) {
  const dead = m.currentHP <= 0;
  return <article aria-label={`Karta ${m.name}`} className={`min-w-0 rounded-md border bg-card p-3 space-y-3 ${selected ? 'border-primary ring-1 ring-primary' : active ? 'border-hp-healthy' : 'border-border'}`}>
    <div className="flex items-start justify-between gap-2">
      <h4 className={`font-display text-lg break-words min-w-0 ${dead ? 'line-through text-muted-foreground' : ''}`}>{m.name}</h4>
      {editable && <div className="flex shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" title={`Kopírovat ${m.name}`} disabled={busy} onClick={copy}><Copy size={15}/></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={`Odebrat ${m.name}`} disabled={busy} onClick={remove}><Trash2 size={15}/></Button></div>}
    </div>
    <div className="flex flex-wrap gap-3 items-center">
      {m.image_url ? <img src={m.image_url} alt={m.name} width={150} height={150} className="h-[150px] w-[150px] shrink-0 rounded-md object-cover"/> : <div className="h-[150px] w-[150px] shrink-0 rounded-md bg-muted flex items-center justify-center"><Skull size={40} className="text-muted-foreground"/></div>}
      <div className="space-y-2 text-sm"><p className="text-muted-foreground">Úroveň {m.level}</p><HPBar current={m.currentHP} max={m.hp}/><p>MP {m.currentMP}/{m.mp}</p><p>Útok {m.attack} · Obrana {m.defense}</p><p className="text-muted-foreground">XP {calculateXP(m.xp_reward, m.level)}</p>{dead && <p className="text-hp-dead">Padl</p>}</div>
    </div>
    <div className="flex flex-wrap gap-2"><BonusBadge label="SÍL" value={m.str}/><BonusBadge label="ODO" value={m.con}/><BonusBadge label="OBR" value={m.dex}/><BonusBadge label="INT" value={m.int}/><BonusBadge label="CHA" value={m.cha}/></div>
    {m.special && <p className="text-sm text-muted-foreground break-words">{m.special}</p>}
    <Button variant={selected ? 'secondary' : 'outline'} className="w-full" aria-label={`Detail ${m.name}`} onClick={open}><Sword size={16} className="mr-2"/>{editable ? 'Poškození a životy' : 'Detail bestie'}</Button>
  </article>;
}