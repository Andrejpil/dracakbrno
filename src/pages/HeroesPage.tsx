import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { RACES, RACIAL_ABILITIES, Race, Hero, getHeroLevel, getXPForNextLevel, traitKey } from '@/lib/gameData';
import { Plus, Pencil, Trash2, Shield, Sparkles, Settings } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useTraits } from '@/hooks/useTraits';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function HeroesPage() {
  const { heroes, addHero, editHero, deleteHero } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const { traits, findTrait, updateTrait } = useTraits();
  const editable = canEditPage('heroes');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', race: 'Barbar' as Race, profession: '', specialization: '', experience: 0, good_trait: 0, bad_trait: 0 });
  const [abilityOpen, setAbilityOpen] = useState<Race | null>(null);
  const [traitDetail, setTraitDetail] = useState<{ kind: 'good' | 'bad'; number: number } | null>(null);
  const [traitsEditorOpen, setTraitsEditorOpen] = useState(false);
  const [traitsTab, setTraitsTab] = useState<'good' | 'bad'>('good');
  const [traitEditValues, setTraitEditValues] = useState<Record<string, { name: string; description: string }>>({});

  const openNew = () => { setEditId(null); setForm({ name: '', race: 'Barbar', profession: '', specialization: '', experience: 0, good_trait: 0, bad_trait: 0 }); setOpen(true); };
  const openEdit = (h: Hero) => { setEditId(h.id); setForm({ name: h.name, race: h.race, profession: h.profession, specialization: h.specialization, experience: h.experience, good_trait: h.good_trait ?? 0, bad_trait: h.bad_trait ?? 0 }); setOpen(true); };

  const handleSave = () => {
    if (!form.name || !form.profession) return;
    const data = { ...form, good_trait: form.good_trait || null, bad_trait: form.bad_trait || null };
    if (editId) editHero(editId, data as any);
    else addHero(data as any);
    setOpen(false);
  };

  const traitDetailObj = traitDetail ? findTrait(traitDetail.kind, traitDetail.number) : null;

  // Build full numbered list (1-99 odd entries) for editor
  const traitsList = Array.from({ length: 50 }, (_, i) => {
    const n = i * 2 + 1;
    const t = traits.find(x => x.kind === traitsTab && x.number === n);
    return { number: n, range: `${n}-${n + 1}`, name: t?.name || '', description: t?.description || '' };
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Hrdinové</h2>
        <div className="flex gap-2">
          {editable && <Button variant="outline" size="sm" onClick={() => setTraitsEditorOpen(true)}><Settings size={16} className="mr-1" /> Vlastnosti</Button>}
          {editable && <Button onClick={openNew} size="sm"><Plus size={16} className="mr-1" /> Nový hrdina</Button>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {heroes.map(h => {
          const ability = RACIAL_ABILITIES[h.race];
          const goodT = findTrait('good', h.good_trait);
          const badT = findTrait('bad', h.bad_trait);
          return (
            <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-display text-lg text-foreground">{h.name}</h3>
                {editable && <div className="flex gap-1">
                  <button onClick={() => openEdit(h)} className="p-1 text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => deleteHero(h.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </div>}
              </div>
              <p className="text-sm text-muted-foreground">Rasa: <span className="text-foreground">{h.race}</span></p>
              <p className="text-sm text-muted-foreground">Povolání: <span className="text-foreground">{h.profession}</span></p>
              {h.specialization && <p className="text-sm text-muted-foreground">Specializace: <span className="text-foreground">{h.specialization}</span></p>}
              <p className="text-sm text-muted-foreground">Úroveň: <span className="text-primary font-bold text-base">{getHeroLevel(h.experience)}</span></p>
              <p className="text-sm text-muted-foreground">XP: <span className="text-primary font-semibold">{h.experience}</span>
                {(() => { const next = getXPForNextLevel(h.experience); return next ? <span className="text-xs text-muted-foreground"> / {next.next}</span> : null; })()}
              </p>
              {ability && (
                <button onClick={() => setAbilityOpen(h.race)} className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                  <Shield size={12} /> {ability.name}
                </button>
              )}
              {h.good_trait ? (
                <button onClick={() => setTraitDetail({ kind: 'good', number: h.good_trait! })} className="mt-1 flex items-center gap-1.5 text-xs text-bonus-positive hover:opacity-80 transition-opacity">
                  <Sparkles size={12} /> +{h.good_trait}: {goodT?.name || '— bez názvu —'}
                </button>
              ) : null}
              {h.bad_trait ? (
                <button onClick={() => setTraitDetail({ kind: 'bad', number: h.bad_trait! })} className="mt-1 flex items-center gap-1.5 text-xs text-bonus-negative hover:opacity-80 transition-opacity">
                  <Sparkles size={12} /> -{h.bad_trait}: {badT?.name || '— bez názvu —'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Add/Edit hero dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">{editId ? 'Upravit hrdinu' : 'Nový hrdina'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Jméno" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Select value={form.race} onValueChange={v => setForm({ ...form, race: v as Race })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RACES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Povolání" value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} />
            <Input placeholder="Specializace" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
            <Input type="number" placeholder="Zkušenosti" value={form.experience} onChange={e => setForm({ ...form, experience: parseInt(e.target.value) || 0 })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground font-bold">Dobrá vlastnost (1-100)</label>
                <Input type="number" min={0} max={100} value={form.good_trait} onChange={e => setForm({ ...form, good_trait: parseInt(e.target.value) || 0 })} />
                <p className="text-xs text-bonus-positive mt-1">{form.good_trait ? findTrait('good', form.good_trait)?.name || '—' : ''}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-bold">Špatná vlastnost (1-100)</label>
                <Input type="number" min={0} max={100} value={form.bad_trait} onChange={e => setForm({ ...form, bad_trait: parseInt(e.target.value) || 0 })} />
                <p className="text-xs text-bonus-negative mt-1">{form.bad_trait ? findTrait('bad', form.bad_trait)?.name || '—' : ''}</p>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editId ? 'Uložit změny' : 'Přidat hrdinu'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Race ability detail */}
      <Dialog open={!!abilityOpen} onOpenChange={() => setAbilityOpen(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">{abilityOpen && RACIAL_ABILITIES[abilityOpen]?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{abilityOpen && RACIAL_ABILITIES[abilityOpen]?.description}</p>
        </DialogContent>
      </Dialog>

      {/* Trait detail popup */}
      <Dialog open={!!traitDetail} onOpenChange={() => setTraitDetail(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">
            {traitDetail?.number} — {traitDetailObj?.name || 'Bez názvu'}
          </DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{traitDetailObj?.description || 'Bez popisku.'}</p>
        </DialogContent>
      </Dialog>

      {/* Traits editor */}
      <Dialog open={traitsEditorOpen} onOpenChange={setTraitsEditorOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="font-display">Editor vlastností</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant={traitsTab === 'good' ? 'default' : 'outline'} onClick={() => setTraitsTab('good')}>Dobré</Button>
            <Button size="sm" variant={traitsTab === 'bad' ? 'default' : 'outline'} onClick={() => setTraitsTab('bad')}>Špatné</Button>
          </div>
          <div className="overflow-auto flex-1 space-y-2">
            {traitsList.map(t => {
              const k = `${traitsTab}-${t.number}`;
              const cur = traitEditValues[k] ?? { name: t.name, description: t.description };
              return (
                <div key={k} className="border border-border rounded p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary w-12 shrink-0">{t.range}</span>
                    <Input className="h-7 text-xs" placeholder="Název vlastnosti" value={cur.name}
                      onChange={e => setTraitEditValues(p => ({ ...p, [k]: { ...cur, name: e.target.value } }))} />
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => updateTrait(traitsTab, t.number, cur.name, cur.description)}>Uložit</Button>
                  </div>
                  <Textarea className="text-xs min-h-[40px]" placeholder="Popisek (co dělá)" value={cur.description}
                    onChange={e => setTraitEditValues(p => ({ ...p, [k]: { ...cur, description: e.target.value } }))} />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
