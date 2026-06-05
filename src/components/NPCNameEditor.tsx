import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { NPC_RACES, type NPCRace, invalidateNameCache, type NamePartRow } from '@/lib/npcNames';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function NPCNameEditor({ open, onOpenChange }: Props) {
  const [race, setRace] = useState<NPCRace>('Člověk');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [part, setPart] = useState<'first' | 'last'>('first');
  const [newValue, setNewValue] = useState('');
  const [rows, setRows] = useState<NamePartRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('npc_name_parts')
      .select('*')
      .eq('race', race)
      .eq('gender', gender)
      .eq('part', part)
      .order('value');
    setRows((data || []) as NamePartRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
  }, [open, race, gender, part]);

  async function handleAdd() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    // split multiple by comma or newline
    const values = trimmed.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
    const payload = values.map(v => ({ race, gender, part, value: v }));
    const { error } = await supabase.from('npc_name_parts').insert(payload);
    if (error) {
      toast({ title: 'Chyba při ukládání', description: error.message, variant: 'destructive' });
      return;
    }
    setNewValue('');
    invalidateNameCache();
    load();
    toast({ title: `Přidáno ${values.length} ${values.length === 1 ? 'jméno' : 'jmen'}` });
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('npc_name_parts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Chyba při mazání', variant: 'destructive' });
      return;
    }
    invalidateNameCache();
    setRows(prev => prev.filter(r => r.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BookOpen size={20} /> Editor jmen NPC
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Rasa</label>
            <Select value={race} onValueChange={v => setRace(v as NPCRace)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NPC_RACES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Pohlaví</label>
            <Select value={gender} onValueChange={v => setGender(v as 'male' | 'female')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Muž</SelectItem>
                <SelectItem value="female">Žena</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Typ</label>
            <Select value={part} onValueChange={v => setPart(v as 'first' | 'last')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">Jméno</SelectItem>
                <SelectItem value="last">Příjmení</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Nové jméno (nebo více oddělených čárkou)"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <Button onClick={handleAdd} disabled={!newValue.trim()}>
            <Plus size={16} className="mr-1" /> Přidat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border border-border rounded-md mt-2">
          {loading ? (
            <p className="p-4 text-muted-foreground text-sm">Načítání...</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-muted-foreground text-sm">
              Žádné záznamy pro {race} / {gender === 'male' ? 'muž' : 'žena'} / {part === 'first' ? 'jméno' : 'příjmení'}.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-1 px-2 py-1 rounded bg-muted/40 hover:bg-muted text-sm">
                  <span className="truncate">{r.value}</span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Smazat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Celkem: <strong>{rows.length}</strong>. Generátor NPC skládá jméno + (volitelně) příjmení z této databáze.
        </p>
      </DialogContent>
    </Dialog>
  );
}
