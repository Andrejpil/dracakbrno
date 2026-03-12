import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Monster } from '@/lib/gameData';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const defaultMonster = { name: '', str: 0, con: 0, dex: 0, int: 0, cha: 0, hp: 0, mp: 0, attack: 0, defense: 0, xp_reward: 0, special: '' };

export default function BestiaryPage() {
  const { monsters, addMonster, editMonster, deleteMonster } = useGame();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultMonster);

  const openNew = () => { setEditId(null); setForm(defaultMonster); setOpen(true); };
  const openEdit = (m: Monster) => {
    setEditId(m.id);
    setForm({ name: m.name, str: m.str, con: m.con, dex: m.dex, int: m.int, cha: m.cha, hp: m.hp, mp: m.mp, attack: m.attack, defense: m.defense, xp_reward: m.xp_reward, special: m.special });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    if (editId) editMonster(editId, form);
    else addMonster(form);
    setOpen(false);
  };

  const setField = (field: string, value: string) => {
    if (field === 'name' || field === 'special') setForm(f => ({ ...f, [field]: value }));
    else setForm(f => ({ ...f, [field]: parseInt(value) || 0 }));
  };

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
              <h3 className="font-display text-lg text-foreground">{m.name}</h3>
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
              <p className="text-sm text-muted-foreground">HP: <span className="text-foreground">{m.hp}</span> | MP: <span className="text-foreground">{m.mp}</span></p>
              <p className="text-sm text-muted-foreground">Útok: <span className="text-foreground">{m.attack}</span> | Obrana: <span className="text-foreground">{m.defense}</span></p>
              <p className="text-sm text-muted-foreground">XP za zabití: <span className="text-primary">{m.xp_reward}</span></p>
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
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Síla" value={form.str} onChange={e => setField('str', e.target.value)} />
              <Input type="number" placeholder="Odolnost" value={form.con} onChange={e => setField('con', e.target.value)} />
              <Input type="number" placeholder="Obratnost" value={form.dex} onChange={e => setField('dex', e.target.value)} />
              <Input type="number" placeholder="Inteligence" value={form.int} onChange={e => setField('int', e.target.value)} />
              <Input type="number" placeholder="Charisma" value={form.cha} onChange={e => setField('cha', e.target.value)} />
              <Input type="number" placeholder="Životy (HP)" value={form.hp} onChange={e => setField('hp', e.target.value)} />
              <Input type="number" placeholder="Mana (MP)" value={form.mp} onChange={e => setField('mp', e.target.value)} />
              <Input type="number" placeholder="Útok" value={form.attack} onChange={e => setField('attack', e.target.value)} />
              <Input type="number" placeholder="Obrana" value={form.defense} onChange={e => setField('defense', e.target.value)} />
              <Input type="number" placeholder="XP za zabití" value={form.xp_reward} onChange={e => setField('xp_reward', e.target.value)} />
            </div>
            <Input placeholder="Speciální schopnosti" value={form.special} onChange={e => setField('special', e.target.value)} />
            <Button onClick={handleSave} className="w-full">{editId ? 'Uložit změny' : 'Přidat bestii'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
