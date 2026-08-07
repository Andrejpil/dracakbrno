import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Copy, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/pricingIO';
import { emptyRules, profileSettlements, type TagIndex } from '@/lib/availability';
import type { AvailabilityProfile, PriceLocation, PriceLocationType, ProfileRules, SettlementTag } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  profiles: AvailabilityProfile[];
  types: PriceLocationType[];
  tags: SettlementTag[];
  locations: PriceLocation[];
  tagIdx: TagIndex;
  usage: Record<string, number>;
  onReload: () => Promise<void> | void;
}

function TagPicker({ label, tags, value, onChange }: {
  label: string; tags: SettlementTag[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const set = new Set(value);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.length === 0 && <span className="text-xs text-muted-foreground">Žádné tagy.</span>}
        {tags.map(t => (
          <button key={t.id} type="button"
            onClick={() => onChange(set.has(t.code) ? value.filter(c => c !== t.code) : [...value, t.code])}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              set.has(t.code) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:bg-muted/70'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfilesDialog({
  open, onOpenChange, worldId, profiles, types, tags, locations, tagIdx, usage, onReload,
}: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<AvailabilityProfile> | null>(null);
  const [showList, setShowList] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setEditing(null); setShowList(false); } }, [open]);

  const rules: ProfileRules = (editing?.rules as ProfileRules) || emptyRules();
  const setRules = (patch: Partial<ProfileRules>) =>
    setEditing(p => ({ ...(p || {}), rules: { ...rules, ...patch } }));

  const matched = useMemo(
    () => (editing ? profileSettlements(rules, locations, tagIdx) : []),
    [editing, rules, locations, tagIdx]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter(p => !q || `${p.name} ${p.code}`.toLowerCase().includes(q));
  }, [profiles, search]);

  async function save() {
    if (!editing?.name?.trim()) { toast.error('Vyplň název profilu'); return; }
    setBusy(true);
    const payload = {
      world_id: worldId,
      name: editing.name.trim(),
      code: slugify(editing.code?.trim() || editing.name),
      note: editing.note || null,
      rules: rules as any,
    };
    const { error } = editing.id
      ? await supabase.from('price_availability_profiles' as any).update(payload).eq('id', editing.id)
      : await supabase.from('price_availability_profiles' as any).insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Profil uložen');
    setEditing(null);
    await onReload();
  }

  async function remove(p: AvailabilityProfile) {
    if (!confirm(`Smazat profil „${p.name}"? Položky a kategorie, které jej používaly, přejdou na výchozí pravidlo.`)) return;
    const { error } = await supabase.from('price_availability_profiles' as any).delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  function duplicate(p: AvailabilityProfile) {
    setEditing({ name: `${p.name} (kopie)`, code: '', note: p.note, rules: { ...p.rules } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? (editing.id ? 'Upravit profil dostupnosti' : 'Nový profil dostupnosti') : `Profily dostupnosti (${profiles.length})`}</DialogTitle>
        </DialogHeader>

        {!editing ? (
          <>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 h-8 text-sm" placeholder="Hledat profil…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => setEditing({ name: '', code: '', rules: emptyRules() })}>
                <Plus size={14} className="mr-1" />Nový profil
              </Button>
            </div>
            <div className="space-y-1">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">Žádné profily.</p>}
              {filtered.map(p => {
                const m = profileSettlements(p.rules, locations, tagIdx).length;
                return (
                  <div key={p.id} className="flex items-center gap-2 border-b py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.code} · vyhovuje {m} / {locations.length} sídlům · používá {usage[p.id] || 0} položek
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(p)}><Copy size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                );
              })}
            </div>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Zavřít</Button></DialogFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Název</Label>
                <Input value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Kód</Label>
                <Input value={editing.code || ''} placeholder={slugify(editing.name || '')}
                  onChange={e => setEditing(p => ({ ...p!, code: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Typy sídel (prázdné = všechny)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
                {types.map(t => {
                  const on = (rules.type_codes || []).includes(t.code);
                  return (
                    <label key={t.code} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={on} onCheckedChange={v =>
                        setRules({ type_codes: v ? [...(rules.type_codes || []), t.code] : (rules.type_codes || []).filter(c => c !== t.code) })} />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <TagPicker label="Vyžaduje alespoň jeden tag" tags={tags} value={rules.tags_any || []} onChange={v => setRules({ tags_any: v })} />
            <TagPicker label="Vyžaduje všechny tagy" tags={tags} value={rules.tags_all || []} onChange={v => setRules({ tags_all: v })} />
            <TagPicker label="Zakázané tagy" tags={tags} value={rules.tags_none || []} onChange={v => setRules({ tags_none: v })} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['Velikost min', 'size_min'], ['Velikost max', 'size_max'],
                ['Bohatství min', 'wealth_min'], ['Bohatství max', 'wealth_max'],
              ] as const).map(([label, key]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" min={1} max={5} value={(rules as any)[key] ?? ''}
                    onChange={e => setRules({ [key]: e.target.value === '' ? null : Number(e.target.value) } as any)} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Region JE (oddělit čárkou)</Label>
                <Input value={(rules.regions_in || []).join(', ')}
                  onChange={e => setRules({ regions_in: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label className="text-xs">Region NENÍ (oddělit čárkou)</Label>
                <Input value={(rules.regions_not_in || []).join(', ')}
                  onChange={e => setRules({ regions_not_in: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Poznámka</Label>
              <Textarea value={editing.note || ''} onChange={e => setEditing(p => ({ ...p!, note: e.target.value }))} />
            </div>

            <div className="border rounded p-3 bg-muted/40 space-y-2">
              <p className="text-sm">
                Profil aktuálně vyhovuje <strong className="text-primary">{matched.length} / {locations.length}</strong> sídlům.
              </p>
              <Button size="sm" variant="secondary" onClick={() => setShowList(s => !s)}>
                {showList ? 'Skrýt sídla' : 'Zobrazit výsledná sídla'}
              </Button>
              {showList && (
                <div className="max-h-52 overflow-y-auto flex flex-wrap gap-1">
                  {matched.map(l => <span key={l.id} className="text-xs px-2 py-0.5 rounded bg-background border">{l.name}</span>)}
                  {matched.length === 0 && <span className="text-xs text-muted-foreground">Žádné sídlo nevyhovuje.</span>}
                </div>
              )}
              {editing.id && (
                <p className="text-xs text-muted-foreground">Používá {usage[editing.id] || 0} položek (přímo nebo přes kategorii).</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Zpět</Button>
              <Button disabled={busy} onClick={save}>{busy ? 'Ukládám…' : 'Uložit profil'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
