import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@/contexts/GameContext';
import { calculateHP, calculateXP } from '@/lib/gameData';
import { supabase } from '@/integrations/supabase/client';
import HPBar from '@/components/HPBar';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Trash2, Star, ChevronUp, ChevronDown, UserPlus, SkipBack, SkipForward, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUserRole } from '@/hooks/useUserRole';

interface InitiativeEntry {
  id: string;
  name: string;
  value: number;
  source: 'hero' | 'npc' | 'beast';
  hero_id: string | null;
  battle_monster_id: string | null;
}

const INIT_MIN = -20;
const INIT_MAX = 20;
const clampInit = (v: number) => Math.max(INIT_MIN, Math.min(INIT_MAX, v));

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

  // Initiative state
  const [initEntries, setInitEntries] = useState<InitiativeEntry[]>([]);
  const [npcName, setNpcName] = useState('');
  const [npcValue, setNpcValue] = useState(0);
  const [activeInitId, setActiveInitId] = useState<string | null>(null);

  const loadInitiative = useCallback(async () => {
    const { data } = await supabase.from('initiative_entries').select('*');
    setInitEntries((data || []).map((r: any) => ({
      id: r.id, name: r.name, value: r.value, source: r.source,
      hero_id: r.hero_id, battle_monster_id: r.battle_monster_id,
    })));
  }, []);

  useEffect(() => { loadInitiative(); }, [loadInitiative]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('initiative-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'initiative_entries' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new;
          setInitEntries(prev => prev.some(e => e.id === r.id) ? prev : [...prev, { id: r.id, name: r.name, value: r.value, source: r.source, hero_id: r.hero_id, battle_monster_id: r.battle_monster_id }]);
        } else if (payload.eventType === 'UPDATE') {
          const r = payload.new;
          setInitEntries(prev => prev.map(e => e.id === r.id ? { id: r.id, name: r.name, value: r.value, source: r.source, hero_id: r.hero_id, battle_monster_id: r.battle_monster_id } : e));
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old;
          setInitEntries(prev => prev.filter(e => e.id !== r.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Initiative auto-sync is handled by DB triggers; client no longer inserts hero rows.


  const updateInit = async (id: string, value: number) => {
    const v = clampInit(value);
    setInitEntries(prev => prev.map(e => e.id === id ? { ...e, value: v } : e));
    await supabase.from('initiative_entries').update({ value: v }).eq('id', id);
  };
  const deleteInit = async (id: string) => {
    await supabase.from('initiative_entries').delete().eq('id', id);
  };
  const addNpc = async () => {
    if (!npcName.trim()) return;
    await supabase.from('initiative_entries').insert({ name: npcName.trim(), value: clampInit(npcValue), source: 'npc' } as any);
    setNpcName(''); setNpcValue(0);
  };
  const resetInit = async () => {
    await supabase.from('initiative_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('battle_state' as any).update({ active_initiative_id: null, active_battle_id: null, active_hero_id: null }).eq('id', true);
  };

  const sortedInit = [...initEntries].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  // Subscribe to shared active-initiative state
  useEffect(() => {
    let cancelled = false;
    (supabase.from('battle_state' as any).select('active_initiative_id').eq('id', true).maybeSingle() as any)
      .then(({ data }: any) => { if (!cancelled) setActiveInitId(data?.active_initiative_id ?? null); });
    const ch = supabase.channel('battle-state-battle-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_state' }, (payload: any) => {
        const r = payload.new || payload.old;
        setActiveInitId(r?.active_initiative_id ?? null);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  // Map initiative entry → battle_id (for highlighting matching battle card / map token)
  const battleIdForEntry = useCallback((e: InitiativeEntry): string | null => {
    if (!e.battle_monster_id) return null;
    const bm = battleMonsters.find(x => x.id === e.battle_monster_id);
    return bm?.battleId ?? null;
  }, [battleMonsters]);

  const setActiveByEntry = useCallback(async (entry: InitiativeEntry | null) => {
    const battleId = entry ? battleIdForEntry(entry) : null;
    const heroId = entry?.source === 'hero' ? entry.hero_id : null;
    setActiveInitId(entry?.id ?? null);
    await supabase.from('battle_state' as any).update({
      active_initiative_id: entry?.id ?? null,
      active_battle_id: battleId,
      active_hero_id: heroId,
    }).eq('id', true);
  }, [battleIdForEntry]);

  const stepActive = useCallback((dir: 1 | -1) => {
    if (sortedInit.length === 0) return;
    const idx = sortedInit.findIndex(e => e.id === activeInitId);
    let next: number;
    if (idx === -1) next = dir === 1 ? 0 : sortedInit.length - 1;
    else next = (idx + dir + sortedInit.length) % sortedInit.length;
    setActiveByEntry(sortedInit[next]);
  }, [sortedInit, activeInitId, setActiveByEntry]);

  // Active battle_monster (for green highlight on cards)
  const activeBattleMonsterId = (() => {
    const entry = initEntries.find(e => e.id === activeInitId);
    if (!entry) return null;
    return battleIdForEntry(entry);
  })();

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
    setLevelMin(1); setLevelMax(1); setQuantity(1);
  };

  const getDmgState = (battleId: string) => damageInputs[battleId] || { heroId: heroes[0]?.id || '', amount: 0 };
  const setDmgState = (battleId: string, update: Partial<{ heroId: string; amount: number }>) => {
    setDamageInputs(prev => ({ ...prev, [battleId]: { ...getDmgState(battleId), ...update } }));
  };

  const sourceColor = (s: string) =>
    s === 'hero' ? 'text-primary' : s === 'beast' ? 'text-destructive' : 'text-foreground';

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Boj</h2>
        {editable && <Button onClick={() => { setSelectedMonster(''); setLevelMin(1); setLevelMax(1); setQuantity(1); setAddOpen(true); }} size="sm" disabled={monsters.length === 0}>
          <Plus size={16} className="mr-1" /> Přidat bestii
        </Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Initiative panel */}
        <aside className="bg-card rounded-lg p-3 border border-border self-start sticky top-2 max-h-[calc(100vh-6rem)] overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-base text-primary">Iniciativa</h3>
            <div className="flex items-center gap-1">
              {editable && sortedInit.length > 0 && (
                <>
                  <button onClick={() => stepActive(-1)} title="Předchozí" className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"><SkipBack size={14} /></button>
                  <button onClick={() => stepActive(1)} title="Další" className="p-1 rounded text-primary hover:bg-primary/10"><SkipForward size={14} /></button>
                </>
              )}
              {editable && <button onClick={resetInit} title="Resetovat" className="text-xs text-muted-foreground hover:text-destructive p-1"><Trash2 size={12} /></button>}
            </div>
          </div>
          <div className="space-y-1 mb-3">
            {sortedInit.length === 0 && <p className="text-xs text-muted-foreground">Žádné záznamy.</p>}
            {sortedInit.map(e => {
              const isActive = e.id === activeInitId;
              return (
              <div key={e.id}
                className={`flex items-center gap-1 rounded px-1.5 py-1 border transition-colors ${isActive ? 'bg-green-500/20 border-green-500 ring-1 ring-green-500' : 'bg-muted/30 border-border'}`}
                onClick={editable ? () => setActiveByEntry(e) : undefined}
                style={editable ? { cursor: 'pointer' } : undefined}
              >
                <span className={`text-sm font-bold w-9 text-center ${e.value > 0 ? 'text-bonus-positive' : e.value < 0 ? 'text-bonus-negative' : 'text-foreground'}`}>
                  {e.value > 0 ? `+${e.value}` : e.value}
                </span>
                {isActive && <Play size={10} className="text-green-500 shrink-0" />}
                <span className={`flex-1 text-xs truncate ${isActive ? 'text-green-500 font-bold' : sourceColor(e.source)}`} title={e.name}>{e.name}</span>
                {editable && (
                  <>
                    <button onClick={ev => { ev.stopPropagation(); updateInit(e.id, e.value + 1); }} disabled={e.value >= INIT_MAX} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronUp size={12} /></button>
                    <button onClick={ev => { ev.stopPropagation(); updateInit(e.id, e.value - 1); }} disabled={e.value <= INIT_MIN} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronDown size={12} /></button>
                    <Input
                      type="number"
                      min={INIT_MIN}
                      max={INIT_MAX}
                      className="h-6 w-12 text-xs px-1"
                      value={e.value}
                      onClick={ev => ev.stopPropagation()}
                      onChange={ev => updateInit(e.id, parseInt(ev.target.value) || 0)}
                    />
                    {e.source !== 'hero' && (
                      <button onClick={ev => { ev.stopPropagation(); deleteInit(e.id); }} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                    )}
                  </>
                )}
              </div>
              );
            })}
          </div>
          {editable && (
            <div className="border-t border-border pt-2 space-y-1">
              <p className="text-xs font-bold text-muted-foreground">Přidat NPC</p>
              <Input className="h-7 text-xs" placeholder="Jméno NPC" value={npcName} onChange={e => setNpcName(e.target.value)} />
              <div className="flex gap-1">
                <Input type="number" min={INIT_MIN} max={INIT_MAX} className="h-7 text-xs w-16" value={npcValue} onChange={e => setNpcValue(parseInt(e.target.value) || 0)} />
                <Button size="sm" className="h-7 text-xs flex-1" onClick={addNpc}><UserPlus size={12} className="mr-1" />Přidat</Button>
              </div>
            </div>
          )}
        </aside>

        {/* Battle monster cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
        {battleMonsters.map(m => {
          const state = getDmgState(m.battleId);
          const scaledXP = calculateXP(m.xp_reward, m.level);
          const isDead = m.currentHP <= 0;
          return (
            <div key={m.battleId} className={`bg-card rounded-md p-2 border border-border transition-opacity ${isDead ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-1.5 gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className={`h-12 w-12 rounded-md shrink-0 ${isDead ? 'grayscale' : ''}`}>
                    {m.image_url ? <AvatarImage src={m.image_url} alt={m.name} className="object-cover" /> : null}
                    <AvatarFallback className="rounded-md text-xs">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className={`font-display text-sm truncate ${isDead ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{m.name}{isDead ? ' ☠' : ''}</h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      Úr. {m.level} {m.is_unique && <Star size={9} className="text-primary fill-primary" />}
                    </p>
                  </div>
                </div>
                {editable && <button onClick={() => removeFromBattle(m.battleId)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={12} /></button>}
              </div>
              <div className="space-y-1 text-[11px]">
                <div><HPBar current={m.currentHP} max={m.hp} /></div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">MP:</span>
                  <Input type="number" className="w-12 h-5 text-[10px] px-1" value={m.currentMP} min={0} max={m.mp}
                    onChange={e => updateBattleMP(m.battleId, parseInt(e.target.value) || 0)} />
                  <span className="text-muted-foreground">/ {m.mp}</span>
                </div>
                <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                  <BonusBadge label="SÍL" value={m.str} />
                  <BonusBadge label="ODO" value={m.con} />
                  <BonusBadge label="OBR" value={m.dex} />
                  <BonusBadge label="INT" value={m.int} />
                  <BonusBadge label="CHA" value={m.cha} />
                </div>
                <p className="text-muted-foreground text-[10px]">Ú: <span className="text-foreground">{m.attack}</span> | O: <span className="text-foreground">{m.defense}</span> | XP: <span className="text-primary">{scaledXP}</span></p>
                {m.special && <p className="text-muted-foreground italic text-[10px] truncate" title={m.special}>{m.special}</p>}

                {editable && !isDead && <div className="pt-1.5 border-t border-border space-y-1">
                  <Select value={state.heroId} onValueChange={v => setDmgState(m.battleId, { heroId: v })}>
                    <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Hrdina" /></SelectTrigger>
                    <SelectContent>{heroes.map(h => <SelectItem key={h.id} value={h.id}>{h.name}{h.is_admin ? ' (admin)' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Input type="number" placeholder="Pošk." className="h-6 text-[10px] px-1" value={state.amount || ''}
                      onChange={e => setDmgState(m.battleId, { amount: parseInt(e.target.value) || 0 })} />
                    <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                      onClick={() => { dealDamage(m.battleId, state.heroId, state.amount); setDmgState(m.battleId, { amount: 0 }); }}
                      disabled={!state.heroId || state.amount <= 0}
                    >Útok</Button>
                  </div>
                </div>}
              </div>
            </div>
          );
        })}
        </div>

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
