import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useWorld } from '@/contexts/WorldContext';
import { calculateHP, calculateXP } from '@/lib/gameData';
import { actualDamage } from '@/lib/battle';
import { supabase } from '@/integrations/supabase/client';
import HPBar from '@/components/HPBar';
import MonsterDetail from '@/components/battle/MonsterDetail';
import { Plus, Trash2, Copy, Skull, ChevronLeft, ChevronRight, UserPlus, Play, Swords, Sparkles, Eye, EyeOff, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface InitiativeEntry { id: string; name: string; value: number; source: string; hero_id: string | null; battle_monster_id: string | null; }
export default function BattlePage() {
  const { heroes, monsters, battleMonsters, addToBattle, applyBattleAction, copyBattleMonster, removeFromBattle, updateBattleMP } = useGame();
  const { activeWorldId, activeWorld } = useWorld();
  const { canEdit, canView } = useUserRole();
  const editable = canEdit('battle');
  const [entries,setEntries] = useState<InitiativeEntry[]>([]);
  const [active,setActive] = useState<string|null>(null);
  const [selected,setSelected] = useState<string|null>(null);
  const [attacker,setAttacker] = useState('');
  const [hideDead,setHideDead] = useState(false);
  const [area,setArea] = useState(false);
  const [targets,setTargets] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const pending = useRef<{signature:string;id:string}|null>(null);
  const [addOpen,setAddOpen] = useState(false);
  const [selectedMonster,setSelectedMonster] = useState('');
  const [levelMin,setLevelMin] = useState(1);
  const [levelMax,setLevelMax] = useState(1);
  const [quantity,setQuantity] = useState(1);
  const [copyId,setCopyId] = useState<string|null>(null);
  const [npcOpen,setNpcOpen] = useState(false);
  const [npcName,setNpcName] = useState('');
  const [npcValue,setNpcValue] = useState(0);

  const loadInitiative = useCallback(async () => {
    if(!activeWorldId) return;
    const {data,error} = await supabase.from('initiative_entries').select('*').eq('world_id',activeWorldId);
    if(error) toast.error('Nepodařilo se načíst iniciativu'); else setEntries(data || []);
  },[activeWorldId]);
  useEffect(() => {
    setEntries([]);setActive(null);setSelected(null);setTargets({});setAttacker('');pending.current=null;
    void loadInitiative();
    if(!activeWorldId) return;
    const loadState = async () => { const {data} = await supabase.from('battle_state').select('*').eq('world_id',activeWorldId).maybeSingle(); setActive(data?.active_initiative_id ?? null); };
    void loadState();
    const ch = supabase.channel(`battle-panel-${activeWorldId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'initiative_entries',filter:`world_id=eq.${activeWorldId}`},() => void loadInitiative())
      .on('postgres_changes',{event:'*',schema:'public',table:'battle_state',filter:`world_id=eq.${activeWorldId}`},() => void loadState()).subscribe();
    return () => {void supabase.removeChannel(ch);};
  },[activeWorldId,loadInitiative]);
  useEffect(() => {if(!attacker && heroes.length) setAttacker(heroes[0].id);},[heroes,attacker]);
  const sorted = [...entries].sort((a,b) => b.value-a.value || a.name.localeCompare(b.name));
  const current = battleMonsters.find(m => m.id===selected);
  const live = battleMonsters.filter(m => m.currentHP>0);
  const attackerName = heroes.find(h => h.id===attacker)?.name || (attacker==='spell'?'Kouzlo':'Jiný');
  const visible = battleMonsters.filter(m => !hideDead || m.currentHP>0).sort((a,b) => (entries.find(e => e.battle_monster_id===b.id)?.value ?? -21)-(entries.find(e => e.battle_monster_id===a.id)?.value ?? -21) || a.name.localeCompare(b.name));
  const turn = async (e: InitiativeEntry) => {
    if(!editable || !activeWorldId) return;
    const {error} = await supabase.from('battle_state').upsert({id:true,world_id:activeWorldId,active_initiative_id:e.id,active_battle_id:battleMonsters.find(m=>m.id===e.battle_monster_id)?.battleId ?? null,active_hero_id:e.hero_id},{onConflict:'world_id'});
    if(error) toast.error('Tah se nepodařilo uložit'); else setActive(e.id);
  };
  const step = (dir:number) => {const idx=sorted.findIndex(e=>e.id===active);const e=sorted[(idx+dir+sorted.length)%sorted.length];if(e) void turn(e);};
  const updateInit = async (id:string,value:number) => {
    if(!activeWorldId) return;
    const v=Math.max(-20,Math.min(20,Math.floor(value||0)));
    const {error}=await supabase.from('initiative_entries').update({value:v}).eq('id',id).eq('world_id',activeWorldId);
    if(error) toast.error('Iniciativu se nepodařilo uložit'); else setEntries(prev=>prev.map(e=>e.id===id?{...e,value:v}:e));
  };
  const run = async (operation:()=>Promise<void>) => {if(lock.current) return; lock.current=true;setBusy(true);try{await operation();}catch{toast.error('Změna se nepodařila uložit. Zkuste ji znovu.');}finally{lock.current=false;setBusy(false);}};
  const act = async (kind:'attack'|'heal'|'correct', items:{id:string;amount:number}[]) => {
    await run(async () => {
      if(items.some(t=>!Number.isInteger(t.amount)||t.amount<0)) throw new Error('Neplatná hodnota');
      const heroId=heroes.some(h=>h.id===attacker)?attacker:null;
      const signature=JSON.stringify([activeWorldId,kind,heroId,items]);
      if(pending.current?.signature!==signature) pending.current={signature,id:crypto.randomUUID()};
      const id=pending.current?.id;
      if(!id) return;
      await applyBattleAction(kind,items,heroId,id);
      pending.current=null;
      if(kind==='attack') {setTargets({});toast.success('Útok byl zaznamenán');}else toast.success('Životy byly upraveny');
      await loadInitiative();
    });
  };
  const selectedM=monsters.find(m=>m.id===selectedMonster);
  const handleAdd = () => void run(async () => {
    if(copyId) await copyBattleMonster(copyId,quantity);
    else for(let i=0;i<quantity;i++) await addToBattle(selectedMonster,Math.min(levelMin,levelMax)+Math.floor(Math.random()*(Math.abs(levelMax-levelMin)+1)));
    await loadInitiative();setAddOpen(false);toast.success('Bestie přidány');
  });
  const picked=live.filter(m=>targets[m.id]!==undefined);
  const sum=picked.reduce((n,m)=>n+Math.max(0,Number(targets[m.id])||0),0);
  const real=picked.reduce((n,m)=>n+actualDamage(Number(targets[m.id]),m.currentHP),0);
  if(!canView('battle')) return <p className="text-muted-foreground">Přístup odepřen.</p>;
  return <div className="space-y-4 animate-fade-in min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div><h2 className="font-display text-2xl text-primary">Souboj</h2><p className="text-sm text-muted-foreground">{activeWorld?.name}</p></div>{editable && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>step(-1)} disabled={!sorted.length || busy}><ChevronLeft size={16}/>Předchozí tah</Button><Button size="sm" onClick={()=>step(1)} disabled={!sorted.length || busy}>Další tah<ChevronRight size={16}/></Button></div>}</header>
    {editable && <section aria-label="Útočníci" className="flex items-center gap-3 border-b pb-4 min-w-0"><span className="text-xs font-semibold uppercase text-muted-foreground shrink-0">Útočník</span><div className="flex gap-2 overflow-x-auto py-1 min-w-0">{[...heroes.map(h=>({id:h.id,name:h.name})),{id:'spell',name:'Kouzlo'},{id:'other',name:'Jiný'}].map(h=><Button key={h.id} variant="outline" aria-pressed={attacker===h.id} onClick={()=>setAttacker(h.id)} className={`h-20 min-w-20 max-w-36 px-3 flex-col gap-1.5 shrink-0 ${attacker===h.id?'border-hp-healthy ring-2 ring-hp-healthy bg-hp-healthy/10':''}`}><span className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center font-semibold">{h.id==='spell'?<Sparkles size={20}/>:h.id==='other'?<Swords size={20}/>:h.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</span><span className="truncate max-w-full text-xs">{h.name}</span></Button>)}</div></section>}
    <div className={`grid gap-4 min-w-0 ${current?'xl:grid-cols-[minmax(0,1fr)_370px]':''}`}>
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 className="text-lg font-display">Iniciativa <span className="text-muted-foreground text-sm">({entries.length})</span></h3><div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={()=>setHideDead(!hideDead)}>{hideDead?<Eye size={16}/>:<EyeOff size={16}/>}<span className="ml-1">{hideDead?'Zobrazit padlé':'Skrýt padlé'}</span></Button>{editable && <><Button variant="outline" size="sm" onClick={()=>setNpcOpen(true)}><UserPlus size={16} className="mr-1"/>NPC</Button><Button size="sm" disabled={!monsters.length || busy} onClick={()=>{setCopyId(null);setQuantity(1);setSelectedMonster('');setAddOpen(true);}}><Plus size={16} className="mr-1"/>Přidat bestii</Button></>}</div></div>
        <div className="border-y divide-y max-h-[600px] overflow-y-auto">
          {sorted.filter(e=>e.source!=='beast').map(e=><div key={e.id} className={`flex items-center gap-2 px-2 py-2 ${e.id===active?'bg-hp-healthy/10':''}`}><Button variant="ghost" size="icon" title={`Zahájit tah: ${e.name}`} disabled={!editable} onClick={()=>void turn(e)} className="h-8 w-8 shrink-0"><Play size={14} className={e.id===active?'text-hp-healthy':'text-muted-foreground'}/></Button><Input aria-label={`Iniciativa ${e.name}`} className="h-8 w-16 shrink-0" type="number" min={-20} max={20} disabled={!editable || busy} value={e.value} onChange={v=>void updateInit(e.id,Number(v.target.value))}/><Shield size={16} className="text-primary shrink-0"/><span className="text-sm flex-1 break-words">{e.name}</span>{editable && e.source==='npc' && <Button variant="ghost" size="icon" title={`Odebrat iniciativu ${e.name}`} onClick={()=>void run(async()=>{const {error}=await supabase.from('initiative_entries').delete().eq('id',e.id).eq('world_id',activeWorldId ?? '');if(error)throw error;await loadInitiative();})}><Trash2 size={14}/></Button>}</div>)}
          {visible.map((m)=>{const e=entries.find(e=>e.battle_monster_id===m.id);const dead=m.currentHP<=0;return <div key={m.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-2 px-2 py-2 min-h-14 ${selected===m.id?'bg-primary/10 ring-1 ring-inset ring-primary':''} ${dead?'text-muted-foreground':''}`}>
            <Button size="icon" variant="ghost" title={`Zahájit tah: ${m.name}`} className="h-8 w-8 shrink-0" disabled={!editable || !e || dead} onClick={()=>{if(e)void turn(e);}}><Play size={14} className={e?.id===active?'text-hp-healthy':'text-muted-foreground'}/></Button>
            <Input aria-label={`Iniciativa ${m.name}`} className="h-8 w-16 shrink-0" type="number" min={-20} max={20} value={e?.value ?? 0} disabled={!editable || !e || busy} onChange={v=>{if(e)void updateInit(e.id,Number(v.target.value));}}/>
            <Button variant="ghost" className="flex-1 justify-start h-auto py-1 min-w-20 whitespace-normal text-left gap-2" onClick={()=>setSelected(m.id)} aria-label={`Detail ${m.name}`}><Skull size={18} className={`shrink-0 ${dead?'text-hp-dead':'text-muted-foreground'}`}/><span className={dead?'line-through':''}>{m.name}</span></Button>
            <HPBar current={m.currentHP} max={m.hp}/>{dead && <span className="text-xs">Padl</span>}
            {editable && <Button variant="ghost" size="icon" className="h-8 w-8" title={`Kopírovat ${m.name}`} disabled={busy} onClick={()=>{setCopyId(m.id);setQuantity(1);setAddOpen(true);}}><Copy size={15}/></Button>}
            {editable && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={`Odebrat ${m.name}`} disabled={busy} onClick={()=>{if(window.confirm(`Odebrat ${m.name} z boje?`))void run(async()=>{await removeFromBattle(m.battleId);await loadInitiative();});}}><Trash2 size={14}/></Button>}
            <Button variant="ghost" size="icon" className="h-8 w-8" title={`Otevřít ${m.name}`} onClick={()=>setSelected(m.id)}><ChevronRight size={16}/></Button>
          </div>;})}
          {!battleMonsters.length && <div className="py-12 text-center text-muted-foreground"><Swords className="mx-auto mb-3" size={30}/><p>V boji nejsou žádné bestie.</p></div>}
          {hideDead && battleMonsters.length>0 && !live.length && <p className="p-6 text-center text-muted-foreground">Všechny bestie padly.</p>}
        </div>
      </section>
      {current && <MonsterDetail monster={current} attacker={attackerName} editable={editable} busy={busy} act={(kind,amount)=>act(kind,[{id:current.id,amount}])} updateMP={v=>void updateBattleMP(current.battleId,v)} close={()=>setSelected(null)}/>}
    </div>
    {editable && <section className="border-t pt-4"><Button variant={area?'secondary':'outline'} onClick={()=>setArea(!area)} aria-expanded={area}><Sparkles size={18} className="mr-2"/>Plošný útok</Button>{area && <div className="mt-4 space-y-4"><p className="text-sm text-primary">Útočník: {attackerName}</p><div className="grid md:grid-cols-2 gap-x-6">{live.map(m=><div key={m.id} className="flex items-center gap-2 py-2 border-b min-w-0"><Checkbox aria-label={`Zasáhnout ${m.name}`} checked={targets[m.id]!==undefined} disabled={busy} onCheckedChange={v=>setTargets(prev=>{const next={...prev};if(v)next[m.id]='';else delete next[m.id];return next;})}/><span className="text-sm flex-1 break-words">{m.name}</span><span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{m.currentHP}/{m.hp}</span><Input aria-label={`Poškození ${m.name}`} type="number" min={0} step={1} className="w-20 h-8 shrink-0" disabled={busy || targets[m.id]===undefined} value={targets[m.id] ?? ''} onChange={e=>setTargets(prev=>({...prev,[m.id]:e.target.value}))}/></div>)}</div><div className="flex flex-wrap justify-between gap-3 items-center"><p className="text-sm">Celkové poškození: <strong className="text-hp-critical">{sum} HP</strong><span className="text-muted-foreground ml-2">Započítá se {real} HP</span></p><Button disabled={busy || !picked.length || !real || picked.some(m=>!Number.isInteger(Number(targets[m.id])) || Number(targets[m.id])<0)} onClick={()=>void act('attack',picked.map(m=>({id:m.id,amount:Number(targets[m.id])}))) }><Sparkles size={16} className="mr-2"/>{busy?'Ukládání…':'Provést plošný útok'}</Button></div></div>}</section>}
    <Dialog open={addOpen} onOpenChange={v=>{if(!busy)setAddOpen(v);}}><DialogContent><DialogHeader><DialogTitle>{copyId?'Kopie bestie':'Přidat bestii do boje'}</DialogTitle></DialogHeader><div className="space-y-4">{!copyId && <><Select value={selectedMonster} onValueChange={setSelectedMonster}><SelectTrigger><SelectValue placeholder="Vyber bestii"/></SelectTrigger><SelectContent>{monsters.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><label className="text-sm">Úroveň od<Input type="number" min={1} value={levelMin} onChange={e=>setLevelMin(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label><label className="text-sm">Úroveň do<Input type="number" min={1} value={levelMax} onChange={e=>setLevelMax(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label></div>{selectedM && <p className="text-sm text-muted-foreground">HP {calculateHP(selectedM.con_min ?? selectedM.con,Math.min(levelMin,levelMax),selectedM.is_unique,selectedM.hp_multiplier)}–{calculateHP(selectedM.con_max ?? selectedM.con,Math.max(levelMin,levelMax),selectedM.is_unique,selectedM.hp_multiplier)} · XP {calculateXP(selectedM.xp_reward,levelMin)}–{calculateXP(selectedM.xp_reward,levelMax)}</p>}</>}<label className="block text-sm">Počet<Input type="number" min={1} max={20} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(20,Math.floor(Number(e.target.value)||1))))}/></label><Button className="w-full" disabled={busy || (!copyId && !selectedMonster)} onClick={handleAdd}>{busy?'Ukládání…':`Přidat ${quantity}× do boje`}</Button></div></DialogContent></Dialog>
    <Dialog open={npcOpen} onOpenChange={setNpcOpen}><DialogContent><DialogHeader><DialogTitle>Přidat NPC do iniciativy</DialogTitle></DialogHeader><Input aria-label="Jméno NPC" placeholder="Jméno NPC" value={npcName} onChange={e=>setNpcName(e.target.value)}/><Input aria-label="Iniciativa NPC" type="number" min={-20} max={20} value={npcValue} onChange={e=>setNpcValue(Number(e.target.value))}/><Button disabled={!npcName.trim() || busy} onClick={()=>void run(async()=>{const {error}=await supabase.from('initiative_entries').insert({name:npcName.trim(),value:Math.max(-20,Math.min(20,npcValue)),source:'npc',world_id:activeWorldId ?? undefined});if(error)throw error;await loadInitiative();setNpcOpen(false);setNpcName('');})}>Přidat NPC</Button></DialogContent></Dialog>
  </div>;
}
