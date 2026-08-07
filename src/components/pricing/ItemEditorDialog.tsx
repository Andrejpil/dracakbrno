import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { computePrice, copperToParts, partsToCopper, formatCopper, effectiveLocationPct } from '@/lib/pricing';
import { slugify } from '@/lib/pricingIO';
import {
  AVAILABILITY_LABELS, AVAILABILITY_MODES, type AvailabilityMode,
  itemAvailableAt, itemSettlements, resolveItemProfile, type TagIndex,
} from '@/lib/availability';
import SettlementPickerDialog from './SettlementPickerDialog';
import type {
  AvailabilityProfile, ItemException, PriceCategory, PriceItem, PriceLocation, PriceLocationType,
} from './types';

const NONE = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  item: PriceItem | null;
  locations: PriceLocation[];
  types: PriceLocationType[];
  categories: PriceCategory[];
  profiles: AvailabilityProfile[];
  tagIdx: TagIndex;
  econMod: number;
  onSaved: () => Promise<void> | void;
}

export default function ItemEditorDialog({
  open, onOpenChange, worldId, item, locations, types, categories, profiles, tagIdx, econMod, onSaved,
}: Props) {
  const [draft, setDraft] = useState<Partial<PriceItem>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [exceptions, setExceptions] = useState<Pick<ItemException, 'location_id' | 'action'>[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [exAction, setExAction] = useState<'ALLOW' | 'DENY'>('DENY');
  const [showList, setShowList] = useState(false);
  const [busy, setBusy] = useState(false);

  const typesByCode = useMemo(
    () => Object.fromEntries(types.map(t => [t.code, t])) as Record<string, PriceLocationType>,
    [types]
  );

  useEffect(() => {
    if (!open) return;
    setShowList(false);
    if (item) {
      setDraft(item);
      supabase.from('price_item_locations' as any).select('*').eq('item_id', item.id)
        .then(({ data }) => setSelected(((data as any[]) || []).map(r => r.location_id)));
      supabase.from('price_item_exceptions' as any).select('location_id, action').eq('item_id', item.id)
        .then(({ data }) => setExceptions(((data as any[]) || []) as any));
    } else {
      setDraft({
        name: '', code: '', category: '', category_id: null, unit: '', note: '',
        base_price_copper: 0, availability_mode: 'INHERIT', availability_profile_id: null,
      });
      setSelected([]);
      setExceptions([]);
    }
  }, [open, item]);

  const mode = (draft.availability_mode || 'INHERIT') as AvailabilityMode;
  const needsPicker = mode === 'ONLY_SELECTED' || mode === 'EXCEPT_SELECTED';
  const parts = copperToParts(Number(draft.base_price_copper) || 0);

  const resolved = useMemo(
    () => resolveItemProfile(
      { availability_mode: mode, availability_profile_id: draft.availability_profile_id ?? null, category_id: draft.category_id ?? null },
      categories, profiles
    ),
    [mode, draft.availability_profile_id, draft.category_id, categories, profiles]
  );

  const previewItem = useMemo(() => ({
    ...(draft as PriceItem),
    id: draft.id || '__new__',
    availability_mode: mode,
  }) as PriceItem, [draft, mode]);

  const ctx = useMemo(() => ({
    exceptions: exceptions.map(e => ({ ...e, id: '', world_id: worldId, item_id: previewItem.id })) as ItemException[],
    itemLocations: selected.map(location_id => ({ item_id: previewItem.id, location_id })),
    categories, profiles, tagIdx,
  }), [exceptions, selected, categories, profiles, tagIdx, worldId, previewItem.id]);

  const available = useMemo(() => itemSettlements(previewItem, locations, ctx), [previewItem, locations, ctx]);

  function setParts(z: number, s: number, m: number) {
    setDraft(p => ({ ...p, base_price_copper: partsToCopper(z, s, m) }));
  }

  function addExceptions(ids: string[]) {
    setExceptions(prev => {
      const map = new Map(prev.map(e => [e.location_id, e]));
      ids.forEach(id => map.set(id, { location_id: id, action: exAction }));
      return Array.from(map.values());
    });
  }

  async function save() {
    if (!draft.name?.trim()) { toast.error('Vyplň název'); return; }
    setBusy(true);
    try {
      const code = slugify(draft.code?.trim() || draft.name);
      const cat = categories.find(c => c.id === draft.category_id);
      const payload = {
        world_id: worldId,
        name: draft.name.trim(),
        code,
        category: cat ? cat.name : (draft.category || null),
        category_id: draft.category_id || null,
        unit: draft.unit || null,
        note: draft.note || null,
        base_price_copper: Number(draft.base_price_copper) || 0,
        availability_mode: mode,
        availability_profile_id: mode === 'PROFILE' ? (draft.availability_profile_id || null) : null,
      };
      let itemId = draft.id;
      if (itemId) {
        const { error } = await supabase.from('price_items' as any).update(payload).eq('id', itemId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('price_items' as any).insert(payload).select('id').single();
        if (error) throw error;
        itemId = (data as any).id;
      }

      await supabase.from('price_item_locations' as any).delete().eq('item_id', itemId);
      if (needsPicker && selected.length) {
        const rows = selected.map(location_id => ({ item_id: itemId, location_id, override_modifier_pct: null }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('price_item_locations' as any).insert(rows.slice(i, i + 500));
          if (error) throw error;
        }
      }

      await supabase.from('price_item_exceptions' as any).delete().eq('item_id', itemId);
      if (exceptions.length) {
        const rows = exceptions.map(e => ({ world_id: worldId, item_id: itemId, location_id: e.location_id, action: e.action }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('price_item_exceptions' as any).insert(rows.slice(i, i + 500));
          if (error) throw error;
        }
      }

      toast.success('Uloženo');
      onOpenChange(false);
      await onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Uložení selhalo');
    }
    setBusy(false);
  }

  const locById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{item ? 'Upravit položku' : 'Nová položka'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Název</Label>
                <Input value={draft.name || ''} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Unikátní kód</Label>
                <Input value={draft.code || ''} placeholder={slugify(draft.name || '')}
                  onChange={e => setDraft(p => ({ ...p, code: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Kategorie</Label>
                <Select value={draft.category_id || NONE}
                  onValueChange={v => setDraft(p => ({ ...p, category_id: v === NONE ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Bez kategorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Bez kategorie</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Jednotka</Label>
                <Input value={draft.unit || ''} placeholder="např. kus, džbán" onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Základní cena</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" className="w-24" value={parts.zl} onChange={e => setParts(Number(e.target.value) || 0, parts.st, parts.md)} />
                <span className="text-xs">zl</span>
                <Input type="number" className="w-24" value={parts.st} onChange={e => setParts(parts.zl, Number(e.target.value) || 0, parts.md)} />
                <span className="text-xs">st</span>
                <Input type="number" className="w-24" value={parts.md} onChange={e => setParts(parts.zl, parts.st, Number(e.target.value) || 0)} />
                <span className="text-xs">md</span>
                <span className="text-xs text-muted-foreground ml-2">= {formatCopper(Number(draft.base_price_copper) || 0)}</span>
              </div>
            </div>

            {/* ---------- DOSTUPNOST ---------- */}
            <div className="border rounded p-3 space-y-3 bg-muted/30">
              <p className="font-display text-sm text-primary">Dostupnost</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Režim</Label>
                  <Select value={mode} onValueChange={(v: AvailabilityMode) => setDraft(p => ({ ...p, availability_mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_MODES.map(m => <SelectItem key={m} value={m}>{AVAILABILITY_LABELS[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {mode === 'PROFILE' && (
                  <div>
                    <Label className="text-xs">Profil</Label>
                    <Select value={draft.availability_profile_id || NONE}
                      onValueChange={v => setDraft(p => ({ ...p, availability_profile_id: v === NONE ? null : v }))}>
                      <SelectTrigger><SelectValue placeholder="Vyber profil" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Bez profilu</SelectItem>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {needsPicker && (
                  <div className="flex items-end">
                    <Button variant="secondary" onClick={() => setPickerOpen(true)}>Vybrat sídla ({selected.length})</Button>
                  </div>
                )}
              </div>

              {(mode === 'INHERIT' || mode === 'PROFILE') && (
                <p className="text-xs text-muted-foreground">
                  Aktuální profil: <strong className="text-foreground">{resolved.profile?.name || 'žádný (dostupné všude)'}</strong>
                  {' · '}Zdroj: {resolved.source}
                </p>
              )}

              <p className="text-sm">
                Výsledná dostupnost: <strong className="text-primary">{available.length} / {locations.length}</strong> sídel
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => setShowList(s => !s)}>
                  {showList ? 'Skrýt sídla' : 'Zobrazit sídla'}
                </Button>
                <Select value={exAction} onValueChange={(v: 'ALLOW' | 'DENY') => setExAction(v)}>
                  <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALLOW">Povolit</SelectItem>
                    <SelectItem value="DENY">Zakázat</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => setExPickerOpen(true)}>
                  <Plus size={14} className="mr-1" />Přidat výjimku
                </Button>
              </div>

              {showList && (
                <div className="max-h-52 overflow-y-auto flex flex-wrap gap-1">
                  {available.map(({ loc, source }) => (
                    <span key={loc.id} title={source} className="text-xs px-2 py-0.5 rounded bg-background border cursor-help">
                      {loc.name}
                    </span>
                  ))}
                  {available.length === 0 && <span className="text-xs text-muted-foreground">Nikde dostupné.</span>}
                </div>
              )}

              {exceptions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Výjimky ({exceptions.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {exceptions.map(e => (
                      <div key={e.location_id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{locById.get(e.location_id)?.name || e.location_id}</span>
                        <Select value={e.action}
                          onValueChange={(v: 'ALLOW' | 'DENY') =>
                            setExceptions(prev => prev.map(x => x.location_id === e.location_id ? { ...x, action: v } : x))}>
                          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALLOW">Povolit</SelectItem>
                            <SelectItem value="DENY">Zakázat</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost"
                          onClick={() => setExceptions(prev => prev.filter(x => x.location_id !== e.location_id))}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Poznámka</Label>
              <Textarea value={draft.note || ''} onChange={e => setDraft(p => ({ ...p, note: e.target.value }))} />
            </div>

            {available.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Náhled cen (ekonomika {econMod > 0 ? '+' : ''}{econMod} %):</p>
                <div className="flex flex-wrap gap-1">
                  {available.slice(0, 8).map(({ loc }) => {
                    const calc = computePrice({
                      basePriceCopper: Number(draft.base_price_copper) || 0,
                      locationModifierPct: effectiveLocationPct(loc, typesByCode),
                      economyModifierPct: econMod,
                    });
                    return <span key={loc.id} className="px-2 py-0.5 rounded bg-muted">{loc.name}: {formatCopper(calc.final)}</span>;
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
            <Button disabled={busy} onClick={save}>{busy ? 'Ukládám…' : 'Uložit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettlementPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={mode === 'ONLY_SELECTED' ? 'Sídla, kde je položka dostupná' : 'Sídla, kde položka dostupná NENÍ'}
        locations={locations}
        types={types}
        selected={selected}
        onChange={setSelected}
      />

      <SettlementPickerDialog
        open={exPickerOpen}
        onOpenChange={setExPickerOpen}
        title={`Sídla pro výjimku „${exAction === 'ALLOW' ? 'Povolit' : 'Zakázat'}"`}
        locations={locations}
        types={types}
        selected={exceptions.map(e => e.location_id)}
        onChange={addExceptions}
      />
    </>
  );
}
