import { useEffect, useState } from 'react';
import { BattleMonster, calculateXP } from '@/lib/gameData';
import { clampHP } from '@/lib/battle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Heart, Sword, Skull, X } from 'lucide-react';

interface Props {
  monster: BattleMonster; attacker: string; editable: boolean; busy: boolean;
  act: (kind: 'attack' | 'heal' | 'correct', amount: number) => Promise<void>;
  updateMP: (value: number) => void; close: () => void;
}
export default function MonsterDetail({ monster: m, attacker, editable, busy, act, updateMP, close }: Props) {
  const [hp, setHP] = useState(m.currentHP);
  const [amount, setAmount] = useState('');
  useEffect(() => { setHP(m.currentHP); setAmount(''); }, [m.id, m.currentHP]);
  const submit = async (kind: 'attack' | 'heal') => { await act(kind, Number(amount)); setAmount(''); };
  return <section className="border border-border rounded-md bg-card p-4 self-start min-w-0">
    <div className="flex justify-between gap-2 mb-3"><h3 className="text-lg font-display break-words">{m.name}</h3><Button variant="ghost" size="icon" title="Zavřít detail" onClick={close}><X size={18}/></Button></div>
    <div className="flex flex-wrap gap-4 items-center mb-4">
      {m.image_url ? <img src={m.image_url} alt={m.name} width={150} height={150} className="h-[150px] w-[150px] object-cover rounded-md shrink-0"/> : <div className="h-[150px] w-[150px] bg-muted flex items-center justify-center rounded-md"><Skull size={48} className="text-muted-foreground"/></div>}
      <div className="space-y-2"><p className="text-sm text-muted-foreground">Úroveň {m.level}{m.is_unique ? ' · Unikátní' : ''}</p><HPBar current={m.currentHP} max={m.hp}/><p className="text-xs text-muted-foreground">Útok {m.attack} · Obrana {m.defense} · XP {calculateXP(m.xp_reward, m.level)}</p>{m.currentHP <= 0 && <p className="text-hp-dead flex gap-1 items-center"><Skull size={16}/>Padl</p>}</div>
    </div>
    <div className="flex flex-wrap gap-2 mb-3"><BonusBadge label="SÍL" value={m.str}/><BonusBadge label="ODO" value={m.con}/><BonusBadge label="OBR" value={m.dex}/><BonusBadge label="INT" value={m.int}/><BonusBadge label="CHA" value={m.cha}/></div>
    {m.special && <p className="text-sm text-muted-foreground mb-3 break-words">{m.special}</p>}
    <label className="flex items-center gap-2 text-sm mb-4">MP<Input aria-label="Aktuální MP" type="number" min={0} max={m.mp} disabled={!editable || busy} className="w-20" value={m.currentMP} onChange={e => updateMP(Number(e.target.value))}/> / {m.mp}</label>
    {editable && <>
      <div className="border-t pt-4 space-y-3"><h4 className="font-semibold">Zaznamenat poškození</h4><p className="text-sm text-primary break-words">Útočník: {attacker}</p>
        <Input aria-label="Poškození HP" type="number" min={1} step={1} value={amount} placeholder="Poškození (HP)" disabled={busy} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && Number(amount)>0 && !busy) void submit('attack'); }}/>
        <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy || Number(amount)<=0 || !Number.isInteger(Number(amount)) || m.currentHP<=0} onClick={() => void submit('attack')}><Sword size={16} className="mr-2"/>Odečíst poškození</Button><Button variant="secondary" disabled={busy || Number(amount)<=0 || !Number.isInteger(Number(amount))} onClick={() => void submit('heal')}><Heart size={16} className="mr-2"/>Přičíst HP</Button></div>
      </div>
      <div className="border-t mt-4 pt-4 space-y-4"><h4 className="font-semibold">Ruční korekce HP</h4><Slider aria-label="Aktuální HP" min={0} max={Math.max(1,m.hp)} step={1} value={[hp]} disabled={busy} onValueChange={v => setHP(v[0])} onValueCommit={v => void act('correct', clampHP(v[0],m.hp))}/><div className="flex gap-2"><Input aria-label="Nová hodnota HP" type="number" min={0} max={m.hp} step={1} value={hp} disabled={busy} onChange={e => setHP(clampHP(Number(e.target.value),m.hp))}/><Button variant="outline" disabled={busy || hp===m.currentHP} onClick={() => void act('correct',hp)}>Nastavit HP</Button></div></div>
    </>}
  </section>;
}
