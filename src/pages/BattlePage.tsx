import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { calculateHP, calculateXP } from '@/lib/gameData';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Trash2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUserRole } from '@/hooks/useUserRole';

export default function BattlePage() {
  const { heroes, monsters, battleMonsters, addToBattle, dealDamage, removeFromBattle, updateBattleMP } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('battle');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState('');
  const [levelMin, setLevelMin] = useState(1);
  const [levelMax, setLevelMax] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [damageInputs, setDamageInputs] = useState<Record<string, { heroId: string; amount: number }>>({});

  const selectedM = monsters.find(m => m.id === selectedMonster);
  const conLo = selectedM ? (selectedM.con_min ?? selectedM.con) : 0;
  const conHi = selectedM ? (selectedM.con_max ?? selectedM.con) : 0;
  const hpMul = selectedM?.hp_multiplier ?? 1.0;
  const previewHPMin = selectedM ? calculateHP(conLo, levelMin, selectedM.is_unique, hpMul) : 0;
  const previewHPMax = selectedM ? calculateHP(conHi, levelMax, selectedM.is_unique, hpMul) : 0;
  const previewXPMin = selectedM ? calculateXP(selectedM.xp_reward, levelMin) : 0;
  const previewXPMax = selectedM ? calculateXP(selectedM.xp_reward, levelMax) : 0;

  const handleAdd = async () => {
    if (!selectedMonster) return;
    const min = Math.min(levelMin, levelMax);
    const max = Math.max(levelMin, levelMax);
    for (let i = 0; i < quantity; i++) {
      const level = min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;
      await addToBattle(selectedMonster, level);
    }
    setAddOpen(false);
    setLevelMin(1);
    setLevelMax(1);
    setQuantity(1);
  };

  const getDmgState = (battleId: string) => damageInputs[battleId] || { heroId: heroes[0]?.id || '', amount: 0 };
  const setDmgState = (battleId: string, update: Partial<{ heroId: string; amount: number }>) => {
    setDamageInputs(prev => ({ ...prev, [battleId]: { ...getDmgState(battleId), ...update } }));
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Boj</h2>
        {editable && <Button onClick={() => { setSelectedMonster(''); setLevelMin(1); setLevelMax(1); setQuantity(1); setAddOpen(true); }} size="sm" disabled={monsters.length === 0}>
          <Plus size={16} className="mr-1" /> Přidat bestii
        </Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {battleMonsters.map(m => {
          const state = getDmgState(m.battleId);
          const scaledXP = calculateXP(m.xp_reward, m.level);
          const isDead = m.currentHP <= 0;
          return (
            <div key={m.battleId} className={`bg-card rounded-lg p-4 border border-border transition-opacity ${isDead ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className={`h-[150px] w-[150px] rounded-md ${isDead ? 'grayscale' : ''}`}>
                    {m.image_url ? <AvatarImage src={m.image_url} alt={m.name} className="object-cover" /> : null}
                    <AvatarFallback className="rounded-md text-sm">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <h3 className={`font-display text-lg ${isDead ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{m.name}{isDead ? ' ☠' : ''}</h3>
                  {m.is_unique && <Star size={14} className="text-primary fill-primary" />}
                  <span className="text-xs text-muted-foreground">Úr. {m.level}</span>
                </div>
                {editable && <button onClick={() => removeFromBattle(m.battleId)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>}
              </div>
              <div className="space-y-2">
                <div><span className="text-sm text-muted-foreground">HP: </span><HPBar current={m.currentHP} max={m.hp} /></div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">MP:</span>
                  <Input type="number" className="w-20 h-7 text-xs" value={m.currentMP} min={0} max={m.mp}
                    onChange={e => updateBattleMP(m.battleId, parseInt(e.target.value) || 0)} />
                  <span className="text-muted-foreground">/ {m.mp}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <BonusBadge label="SÍL" value={m.str} />
                  <BonusBadge label="ODO" value={m.con} />
                  <BonusBadge label="OBR" value={m.dex} />
                  <BonusBadge label="INT" value={m.int} />
                  <BonusBadge label="CHA" value={m.cha} />
                </div>
                <p className="text-sm text-muted-foreground">Útok: <span className="text-foreground">{m.attack}</span> | Obrana: <span className="text-foreground">{m.defense}</span></p>
                <p className="text-sm text-muted-foreground">XP: <span className="text-primary">{scaledXP}</span> <span className="text-xs">(základ {m.xp_reward} × {(1 + (m.level - 1) * 0.1).toFixed(1)})</span></p>
                {m.special && <p className="text-xs text-muted-foreground">{m.special}</p>}

                {editable && <div className="pt-2 border-t border-border space-y-2">
                  <Select value={state.heroId} onValueChange={v => setDmgState(m.battleId, { heroId: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vyber hrdinu" /></SelectTrigger>
                    <SelectContent>{heroes.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Poškození" className="h-8 text-xs" value={state.amount || ''}
                      onChange={e => setDmgState(m.battleId, { amount: parseInt(e.target.value) || 0 })} />
                    <Button size="sm" variant="destructive" className="h-8 text-xs"
                      onClick={() => { dealDamage(m.battleId, state.heroId, state.amount); setDmgState(m.battleId, { amount: 0 }); }}
                      disabled={!state.heroId || state.amount <= 0 || m.currentHP <= 0}
                    >Útok</Button>
                  </div>
                </div>}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">Přidat bestii do boje</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={selectedMonster} onValueChange={setSelectedMonster}>
              <SelectTrigger><SelectValue placeholder="Vyber bestii" /></SelectTrigger>
              <SelectContent>{monsters.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} {m.is_unique ? '⭐' : ''}
                </SelectItem>
              ))}</SelectContent>
            </Select>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-bold mb-1 block">Úroveň od</label>
                <Input type="number" min={1} value={levelMin} onChange={e => setLevelMin(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-bold mb-1 block">Úroveň do</label>
                <Input type="number" min={1} value={levelMax} onChange={e => setLevelMax(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-bold mb-1 block">Počet</label>
                <Input type="number" min={1} max={20} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} />
              </div>
            </div>
            {selectedM && (
              <div className="p-2 rounded-md border border-border bg-muted/30 text-sm space-y-1">
                <p className="text-muted-foreground">
                  HP: <span className="text-foreground font-bold">{previewHPMin}</span>
                  {levelMin !== levelMax && <> – <span className="text-foreground font-bold">{previewHPMax}</span></>}
                  <span className="ml-2 text-xs">({selectedM.is_unique ? 'unikátní' : 'obyčejná'})</span>
                </p>
                <p className="text-muted-foreground">
                  XP: <span className="text-primary font-bold">{previewXPMin}</span>
                  {levelMin !== levelMax && <> – <span className="text-primary font-bold">{previewXPMax}</span></>}
                </p>
                {levelMin !== levelMax && (
                  <p className="text-xs text-muted-foreground">Úroveň se zvolí náhodně z rozmezí {Math.min(levelMin, levelMax)}–{Math.max(levelMin, levelMax)}</p>
                )}
              </div>
            )}
            <Button onClick={handleAdd} disabled={!selectedMonster} className="w-full">
              Přidat {quantity > 1 ? `${quantity}× ` : ''}do boje
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
