import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import {
  loadRaces, loadNames, invalidateNameCache,
  type RaceRow, type NameRow, type NamePart, type NameGender,
} from '@/lib/npcNames';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function NPCNameEditor({ open, onOpenChange }: Props) {
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [names, setNames] = useState<NameRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter
  const [filterRaceId, setFilterRaceId] = useState<string>('all');
  const [filterPart, setFilterPart] = useState<NamePart>('first');
  const [filterGender, setFilterGender] = useState<'all' | NameGender>('all');

  // New entry form
  const [newValue, setNewValue] = useState('');
  const [newPart, setNewPart] = useState<NamePart>('first');
  const [newGender, setNewGender] = useState<NameGender>('male');
  const [newRaceIds, setNewRaceIds] = useState<Set<string>>(new Set());

  async function refresh() {
    setLoading(true);
    invalidateNameCache();
    const [r, n] = await Promise.all([loadRaces(true), loadNames(true)]);
    setRaces(r);
    setNames(n);
    setLoading(false);
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const filtered = useMemo(() => {
    return names.filter(n =>
      n.part === filterPart &&
      (filterGender === 'all' || n.gender === filterGender) &&
      (filterRaceId === 'all' || n.race_ids.includes(filterRaceId))
    );
  }, [names, filterPart, filterGender, filterRaceId]);

  function toggleNewRace(id: string) {
    setNewRaceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const values = newValue.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
    if (!values.length) return;
    if (newRaceIds.size === 0) {
      toast({ title: 'Vyber alespoň jednu rasu', variant: 'destructive' });
      return;
    }

    for (const value of values) {
      // upsert name
      const { data: existing } = await supabase
        .from('npc_names')
        .select('id')
        .eq('value', value)
        .eq('part', newPart)
        .eq('gender', newGender)
        .maybeSingle();

      let nameId = existing?.id;
      if (!nameId) {
        const { data: ins, error } = await supabase
          .from('npc_names')
          .insert({ value, part: newPart, gender: newGender })
          .select('id')
          .single();
        if (error) {
          toast({ title: `Chyba u "${value}"`, description: error.message, variant: 'destructive' });
          continue;
        }
        nameId = ins.id;
      }

      // link races (ignore conflicts)
      const links = Array.from(newRaceIds).map(race_id => ({ name_id: nameId!, race_id }));
      await supabase.from('npc_name_races').upsert(links, { onConflict: 'name_id,race_id' });
    }

    setNewValue('');
    toast({ title: `Přidáno ${values.length} ${values.length === 1 ? 'jméno' : 'záznamů'}` });
    refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('npc_names').delete().eq('id', id);
    if (error) {
      toast({ title: 'Chyba při mazání', variant: 'destructive' });
      return;
    }
    setNames(prev => prev.filter(n => n.id !== id));
    invalidateNameCache();
  }

  async function toggleRaceForName(name: NameRow, raceId: string) {
    if (name.race_ids.includes(raceId)) {
      await supabase
        .from('npc_name_races')
        .delete()
        .eq('name_id', name.id)
        .eq('race_id', raceId);
    } else {
      await supabase
        .from('npc_name_races')
        .insert({ name_id: name.id, race_id: raceId });
    }
    invalidateNameCache();
    const updated = await loadNames(true);
    setNames(updated);
  }

  function labelFor(id: string) {
    return races.find(r => r.id === id)?.label ?? '?';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BookOpen size={20} /> Editor jmen NPC
          </DialogTitle>
        </DialogHeader>

        {/* Add new */}
        <div className="border border-border rounded-md p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-3">
              <label className="text-sm font-medium">Nové jméno / příjmení (více oddělte čárkou)</label>
              <Input
                placeholder="např. Korik, Irena"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Typ</label>
              <Select value={newPart} onValueChange={v => setNewPart(v as NamePart)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Jméno</SelectItem>
                  <SelectItem value="last">Příjmení</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Pohlaví</label>
              <Select value={newGender} onValueChange={v => setNewGender(v as NameGender)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Muž</SelectItem>
                  <SelectItem value="female">Žena</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={!newValue.trim()} className="w-full">
                <Plus size={16} className="mr-1" /> Přidat
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Vhodné pro rasy</label>
            <div className="flex flex-wrap gap-3">
              {races.map(r => (
                <label key={r.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={newRaceIds.has(r.id)}
                    onCheckedChange={() => toggleNewRace(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div>
            <label className="text-xs text-muted-foreground">Filtr rasa</label>
            <Select value={filterRaceId} onValueChange={setFilterRaceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny rasy</SelectItem>
                {races.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Filtr typ</label>
            <Select value={filterPart} onValueChange={v => setFilterPart(v as NamePart)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">Jména</SelectItem>
                <SelectItem value="last">Příjmení</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Filtr pohlaví</label>
            <Select value={filterGender} onValueChange={v => setFilterGender(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechna</SelectItem>
                <SelectItem value="male">Muž</SelectItem>
                <SelectItem value="female">Žena</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto border border-border rounded-md mt-2">
          {loading ? (
            <p className="p-4 text-muted-foreground text-sm">Načítání...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-muted-foreground text-sm">Žádné záznamy.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(n => (
                <div key={n.id} className="p-2 flex items-center gap-3 hover:bg-muted/40">
                  <div className="w-40 shrink-0">
                    <div className="font-medium text-sm">{n.value}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.gender === 'male' ? 'muž' : n.gender === 'female' ? 'žena' : 'unisex'}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {races.map(r => (
                      <label key={r.id} className="flex items-center gap-1 text-xs cursor-pointer">
                        <Checkbox
                          checked={n.race_ids.includes(r.id)}
                          onCheckedChange={() => toggleRaceForName(n, r.id)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                    title="Smazat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Celkem v seznamu: <strong>{filtered.length}</strong>. Generátor NPC skládá jméno + (volitelně) příjmení z této databáze.
        </p>
      </DialogContent>
    </Dialog>
  );
}
