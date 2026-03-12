import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BattlePage() {
  const { heroes, monsters, battleMonsters, addToBattle, dealDamage, removeFromBattle, updateBattleMP } = useGame();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState('');
  const [damageInputs, setDamageInputs] = useState<Record<string, { heroId: string; amount: number }>>({});

  const handleAdd = () => {
    if (selectedMonster) { addToBattle(selectedMonster); setAddOpen(false); }
  };

  const getDmgState = (battleId: string) => damageInputs[battleId] || { heroId: heroes[0]?.id || '', amount: 0 };
  const setDmgState = (battleId: string, update: Partial<{ heroId: string; amount: number }>) => {
    setDamageInputs(prev => ({ ...prev, [battleId]: { ...getDmgState(battleId), ...update } }));
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Boj</h2>
        <Button onClick={() => setAddOpen(true)} size="sm" disabled={monsters.length === 0}>
          <Plus size={16} className="mr-1" /> Přidat bestii
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {battleMonsters.map(m => {
          const state = getDmgState(m.battleId);
          return (
            <div key={m.battleId} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-display text-lg text-foreground">{m.name}</h3>
                <button onClick={() => removeFromBattle(m.battleId)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
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
                  <BonusBadge label="OBR" value={m.dex} />
                  <BonusBadge label="INT" value={m.int} />
                  <BonusBadge label="CHA" value={m.cha} />
                </div>
                <p className="text-sm text-muted-foreground">Útok: <span className="text-foreground">{m.attack}</span> | Obrana: <span className="text-foreground">{m.defense}</span></p>
                <p className="text-sm text-muted-foreground">XP: <span className="text-primary">{m.xp_reward}</span></p>
                {m.special && <p className="text-xs text-muted-foreground">{m.special}</p>}

                <div className="pt-2 border-t border-border space-y-2">
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">Přidat bestii do boje</DialogTitle></DialogHeader>
          <Select value={selectedMonster} onValueChange={setSelectedMonster}>
            <SelectTrigger><SelectValue placeholder="Vyber bestii" /></SelectTrigger>
            <SelectContent>{monsters.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selectedMonster}>Přidat do boje</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
