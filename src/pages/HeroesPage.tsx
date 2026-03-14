import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { RACES, RACIAL_ABILITIES, Race, Hero, getHeroLevel, getXPForNextLevel, XP_THRESHOLDS } from '@/lib/gameData';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function HeroesPage() {
  const { heroes, addHero, editHero, deleteHero } = useGame();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', race: 'Barbar' as Race, profession: '', specialization: '', experience: 0 });
  const [abilityOpen, setAbilityOpen] = useState<Race | null>(null);

  const openNew = () => { setEditId(null); setForm({ name: '', race: 'Barbar', profession: '', specialization: '', experience: 0 }); setOpen(true); };
  const openEdit = (h: Hero) => { setEditId(h.id); setForm({ name: h.name, race: h.race, profession: h.profession, specialization: h.specialization, experience: h.experience }); setOpen(true); };

  const handleSave = () => {
    if (!form.name || !form.profession) return;
    if (editId) editHero(editId, form);
    else addHero(form);
    setOpen(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Hrdinové</h2>
        <Button onClick={openNew} size="sm"><Plus size={16} className="mr-1" /> Nový hrdina</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {heroes.map(h => {
          const ability = RACIAL_ABILITIES[h.race];
          return (
            <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-display text-lg text-foreground">{h.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(h)} className="p-1 text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => deleteHero(h.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Rasa: <span className="text-foreground">{h.race}</span></p>
              <p className="text-sm text-muted-foreground">Povolání: <span className="text-foreground">{h.profession}</span></p>
              {h.specialization && <p className="text-sm text-muted-foreground">Specializace: <span className="text-foreground">{h.specialization}</span></p>}
              <p className="text-sm text-muted-foreground">Úroveň: <span className="text-primary font-bold text-base">{getHeroLevel(h.experience)}</span></p>
              <p className="text-sm text-muted-foreground">XP: <span className="text-primary font-semibold">{h.experience}</span>
                {(() => { const next = getXPForNextLevel(h.experience); return next ? <span className="text-xs text-muted-foreground"> / {next.next} (další úr.)</span> : null; })()}
              </p>
              {ability && (
                <button
                  onClick={() => setAbilityOpen(h.race)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Shield size={12} />
                  {ability.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit dialog */}
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
            {form.race && RACIAL_ABILITIES[form.race] && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-semibold text-primary">{RACIAL_ABILITIES[form.race].name}</p>
                <p className="text-muted-foreground text-xs mt-1">{RACIAL_ABILITIES[form.race].description}</p>
              </div>
            )}
            <Button onClick={handleSave} className="w-full">{editId ? 'Uložit změny' : 'Přidat hrdinu'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ability detail dialog */}
      <Dialog open={!!abilityOpen} onOpenChange={() => setAbilityOpen(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">{abilityOpen && RACIAL_ABILITIES[abilityOpen]?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{abilityOpen && RACIAL_ABILITIES[abilityOpen]?.description}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
