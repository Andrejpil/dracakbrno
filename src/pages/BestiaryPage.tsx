import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Monster, getAttributeBonus, formatBonus, calculateHP } from '@/lib/gameData';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Pencil, Trash2, Shield, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const defaultMonster = { name: '', str: 0, con: 0, dex: 0, int: 0, cha: 0, mp: 0, attack: 0, defense: 0, xp_reward: 0, special: '', is_unique: false };

export default function BestiaryPage() {
  const { monsters, addMonster, editMonster, deleteMonster } = useGame();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultMonster);

  const openNew = () => { setEditId(null); setForm(defaultMonster); setOpen(true); };
  const openEdit = (m: Monster) => {
    setEditId(m.id);
    setForm({ name: m.name, str: m.str, con: m.con, dex: m.dex, int: m.int, cha: m.cha, mp: m.mp, attack: m.attack, defense: m.defense, xp_reward: m.xp_reward, special: m.special, is_unique: m.is_unique });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    // HP is calculated at battle time, store 0 as placeholder
    const data = { ...form, hp: 0 };
    if (editId) editMonster(editId, data);
    else addMonster(data);
    setOpen(false);
  };

  const setField = (field: string, value: string) => {
    if (field === 'name' || field === 'special') setForm(f => ({ ...f, [field]: value }));
    else setForm(f => ({ ...f, [field]: parseInt(value) || 0 }));
  };

  // Preview HP for levels 1, 5, 10
  const previewHP = (level: number) => calculateHP(form.con, level, form.is_unique);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Bestiář</h2>
        <Button onClick={openNew} size="sm"><Plus size={16} className="mr-1" /> Nová bestie</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monsters.map(m => (
          <div key={m.id} className="bg-card rounded-lg p-4 border border-border">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-foreground">{m.name}</h3>
                {m.is_unique && <Star size={14} className="text-primary fill-primary" />}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(m)} className="p-1 text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                <button onClick={() => deleteMonster(m.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <BonusBadge label="SÍL" value={m.str} />
                <BonusBadge label="ODO" value={m.con} />
                <BonusBadge label="OBR" value={m.dex} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <BonusBadge label="INT" value={m.int} />
                <BonusBadge label="CHA" value={m.cha} />
              </div>
              <p className="text-sm text-muted-foreground">
                HP (úr.1): <span className="text-foreground">{calculateHP(m.con, 1, m.is_unique)}</span> | MP: <span className="text-foreground">{m.mp}</span>
              </p>
              <p className="text-sm text-muted-foreground">Útok: <span className="text-foreground">{m.attack}</span> | Obrana: <span className="text-foreground">{m.defense}</span></p>
              <p className="text-sm text-muted-foreground">XP za zabití: <span className="text-primary">{m.xp_reward}</span></p>
              <p className="text-sm text-muted-foreground">Typ: <span className="text-foreground">{m.is_unique ? 'Unikátní' : 'Obyčejná'}</span></p>
              {m.special && <p className="text-sm text-muted-foreground">Speciální: <span className="text-foreground">{m.special}</span></p>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">{editId ? 'Upravit bestii' : 'Nová bestie'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            <Input placeholder="Jméno" value={form.name} onChange={e => setField('name', e.target.value)} />
            
            {/* Unique toggle */}
            <div className="flex items-center justify-between p-2 rounded-md border border-border">
              <div className="flex items-center gap-2">
                <Star size={16} className={form.is_unique ? 'text-primary fill-primary' : 'text-muted-foreground'} />
                <span className="text-sm font-bold text-foreground">{form.is_unique ? 'Unikátní bestie' : 'Obyčejná bestie'}</span>
              </div>
              <Switch checked={form.is_unique} onCheckedChange={v => setForm(f => ({ ...f, is_unique: v }))} />
            </div>

            {/* Attribute rows with bonus display */}
            {([
              ['SÍL', 'str'],
              ['ODO', 'con'],
              ['OBR', 'dex'],
              ['INT', 'int'],
              ['CHA', 'cha'],
            ] as const).map(([label, field]) => {
              const val = form[field as keyof typeof form] as number;
              const bonus = getAttributeBonus(val);
              const bonusColor = bonus > 0 ? 'text-bonus-positive' : bonus < 0 ? 'text-bonus-negative' : 'text-muted-foreground';
              return (
                <div key={field} className="flex items-center gap-2">
                  <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">{label}</span>
                  <Input type="number" min={1} max={23} className="flex-1" value={form[field as keyof typeof form] as number} onChange={e => setField(field, e.target.value)} />
                  <span className={`w-12 text-center text-sm font-bold shrink-0 ${bonusColor}`}>
                    {formatBonus(bonus)}
                  </span>
                </div>
              );
            })}
            {/* ÚT and OČ with MP */}
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">ÚT</span>
              <Input type="number" min={0} className="flex-1" value={form.attack} onChange={e => setField('attack', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">OČ</span>
              <Input type="number" min={0} className="flex-1" value={form.defense} onChange={e => setField('defense', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">MP</span>
              <Input type="number" min={0} className="flex-1" value={form.mp} onChange={e => setField('mp', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">XP</span>
              <Input type="number" min={0} placeholder="XP za zabití" value={form.xp_reward} onChange={e => setField('xp_reward', e.target.value)} />
            </div>
            
            {/* HP Preview */}
            <div className="p-2 rounded-md border border-border bg-muted/30">
              <p className="text-xs font-bold text-muted-foreground mb-1">Náhled HP ({form.is_unique ? 'unikátní' : 'obyčejná'}):</p>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Úr.1: <span className="text-foreground font-bold">{previewHP(1)}</span></span>
                <span className="text-muted-foreground">Úr.5: <span className="text-foreground font-bold">{previewHP(5)}</span></span>
                <span className="text-muted-foreground">Úr.10: <span className="text-foreground font-bold">{previewHP(10)}</span></span>
              </div>
            </div>

            <Input placeholder="Speciální schopnosti" value={form.special} onChange={e => setField('special', e.target.value)} />
            <Button onClick={handleSave} className="w-full">{editId ? 'Uložit změny' : 'Přidat bestii'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
