import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { computePrice, copperToParts, partsToCopper, formatCopper, effectiveLocationPct, availabilitySummary } from '@/lib/pricing';
import { AVAILABILITY_LABELS, AVAILABILITY_MODES, AvailabilityMode, slugify } from '@/lib/pricingIO';
import SettlementPickerDialog from './SettlementPickerDialog';
import type { PriceItem, PriceLocation, PriceLocationType } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  item: PriceItem | null;
  locations: PriceLocation[];
  types: PriceLocationType[];
  econMod: number;
  onSaved: () => Promise<void> | void;
}

export default function ItemEditorDialog({ open, onOpenChange, worldId, item, locations, types, econMod, onSaved }: Props) {
  const [draft, setDraft] = useState<Partial<PriceItem>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const typesByCode = useMemo(
    () => Object.fromEntries(types.map(t => [t.code, t])) as Record<string, PriceLocationType>,
    [types]
  );

  useEffect(() => {
    if (!open) return;
    if (item) {
      setDraft(item);
      supabase.from('price_item_locations' as any).select('*').eq('item_id', item.id).then(({ data }) => {
        const rows = (data as any[]) || [];
        setSelected(rows.map(r => r.location_id));
        setOverrides(Object.fromEntries(rows
          .filter(r => r.override_modifier_pct != null)
          .map(r => [r.location_id, String(r.override_modifier_pct)])));
      });
    } else {
      setDraft({ name: '', code: '', category: '', unit: '', note: '', base_price_copper: 0, availability_mode: 'EVERYWHERE' });
      setSelected([]);
      setOverrides({});
    }
  }, [open, item]);

  const mode = (draft.availability_mode || 'EVERYWHERE') as AvailabilityMode;
  const needsPicker = mode === 'ONLY_SELECTED' || mode === 'EXCEPT_SELECTED';
  const parts = copperToParts(Number(draft.base_price_copper) || 0);

  function setParts(z: number, s: number, m: number) {
    setDraft(p => ({ ...p, base_price_copper: partsToCopper(z, s, m) }));
  }

  async function save() {
    if (!draft.name?.trim()) { toast.error('Vyplň název'); return; }
    setBusy(true);
    try {
      const code = slugify(draft.code?.trim() || draft.name);
      const payload = {
        world_id: worldId,
        name: draft.name.trim(),
        code,
        category: draft.category || null,
        unit: draft.unit || null,
        note: draft.note || null,
        base_price_copper: Number(draft.base_price_copper) || 0,
        availability_mode: mode,
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
        const rows = selected.map(location_id => ({
          item_id: itemId,
          location_id,
          override_modifier_pct: overrides[location_id]?.trim() ? Number(overrides[location_id]) : null,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('price_item_locations' as any).insert(rows.slice(i, i + 500));
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

  const previewLocs = useMemo(() => {
    if (mode === 'NOWHERE') return [];
    const base = mode === 'ONLY_SELECTED'
      ? locations.filter(l => selected.includes(l.id))
      : mode === 'EXCEPT_SELECTED'
        ? locations.filter(l => !selected.includes(l.id))
        : locations;
    return base.slice(0, 8);
  }, [mode, locations, selected]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
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
                <Input value={draft.category || ''} placeholder="např. Nápoje" onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} />
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

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">Režim dostupnosti</Label>
                <Select value={mode} onValueChange={(v: AvailabilityMode) => setDraft(p => ({ ...p, availability_mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_MODES.map(m => <SelectItem key={m} value={m}>{AVAILABILITY_LABELS[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {needsPicker && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setPickerOpen(true)}>Vybrat sídla</Button>
                  <span className="text-xs text-muted-foreground">{availabilitySummary(mode, selected.length)}</span>
                </div>
              )}
            </div>

            {needsPicker && selected.length > 0 && (
              <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1">
                <p className="text-xs text-muted-foreground">
                  {mode === 'ONLY_SELECTED' ? 'Vybraná sídla (kde se prodává) — volitelný přepis %:' : 'Vybraná sídla (kde se neprodává):'}
                </p>
                {locations.filter(l => selected.includes(l.id)).slice(0, 200).map(l => (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{l.name}</span>
                    {mode === 'ONLY_SELECTED' && (
                      <Input className="w-24 h-7 text-xs" type="number" placeholder="přepis %"
                        value={overrides[l.id] ?? ''}
                        onChange={e => setOverrides(o => ({ ...o, [l.id]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="text-xs">Poznámka</Label>
              <Textarea value={draft.note || ''} onChange={e => setDraft(p => ({ ...p, note: e.target.value }))} />
            </div>

            {previewLocs.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Náhled cen (ekonomika {econMod > 0 ? '+' : ''}{econMod} %):</p>
                <div className="flex flex-wrap gap-1">
                  {previewLocs.map(l => {
                    const locMod = overrides[l.id]?.trim() && mode === 'ONLY_SELECTED'
                      ? Number(overrides[l.id])
                      : effectiveLocationPct(l, typesByCode);
                    const calc = computePrice({
                      basePriceCopper: Number(draft.base_price_copper) || 0,
                      locationModifierPct: locMod,
                      economyModifierPct: econMod,
                    });
                    return <span key={l.id} className="px-2 py-0.5 rounded bg-muted">{l.name}: {formatCopper(calc.final)}</span>;
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
    </>
  );
}
