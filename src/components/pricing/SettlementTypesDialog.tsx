import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/pricingIO';
import type { PriceLocation, PriceLocationType } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  types: PriceLocationType[];
  locations: PriceLocation[];
  onReload: () => Promise<void> | void;
}

export default function SettlementTypesDialog({ open, onOpenChange, worldId, types, locations, onReload }: Props) {
  const [draft, setDraft] = useState<Record<string, Partial<PriceLocationType>>>({});

  function val<K extends keyof PriceLocationType>(t: PriceLocationType, k: K): PriceLocationType[K] {
    return (draft[t.id]?.[k] ?? t[k]) as PriceLocationType[K];
  }

  async function save(t: PriceLocationType, patch: Partial<PriceLocationType>) {
    const { error } = await supabase.from('price_location_types' as any).update(patch).eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  async function addType() {
    const code = `typ-${Date.now().toString(36)}`;
    const { error } = await supabase.from('price_location_types' as any).insert({
      world_id: worldId, code, label: 'Nový typ', default_modifier_pct: 0, sort_order: types.length,
    });
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  async function removeType(t: PriceLocationType) {
    const used = locations.filter(l => (l.type_code || l.type) === t.code).length;
    if (used > 0) { toast.error(`Typ používá ${used} sídel — nelze smazat.`); return; }
    if (!confirm(`Smazat typ „${t.label}"?`)) return;
    const { error } = await supabase.from('price_location_types' as any).delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Typy sídel a jejich výchozí procenta</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Změna výchozího procenta se okamžitě projeví u všech sídel, která používají výchozí hodnotu typu.
          Sídla s vlastní hodnotou zůstanou beze změny.
        </p>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b"><th className="text-left py-2">Název typu</th><th className="text-left">Kód</th><th className="text-left">Výchozí %</th><th className="text-left">Sídel</th><th></th></tr>
          </thead>
          <tbody>
            {types.map(t => {
              const used = locations.filter(l => (l.type_code || l.type) === t.code).length;
              return (
                <tr key={t.id} className="border-b">
                  <td className="py-1 pr-2">
                    <Input className="h-8 text-sm" value={String(val(t, 'label'))}
                      onChange={e => setDraft(d => ({ ...d, [t.id]: { ...d[t.id], label: e.target.value } }))}
                      onBlur={e => save(t, { label: e.target.value.trim() || 'Typ' })} />
                  </td>
                  <td className="pr-2">
                    <Input className="h-8 text-sm w-28" value={String(val(t, 'code'))}
                      onChange={e => setDraft(d => ({ ...d, [t.id]: { ...d[t.id], code: e.target.value } }))}
                      onBlur={async e => {
                        const code = slugify(e.target.value);
                        if (code === t.code) return;
                        const { error } = await supabase.from('price_location_types' as any).update({ code }).eq('id', t.id);
                        if (error) { toast.error(error.message); return; }
                        await supabase.from('price_locations' as any).update({ type_code: code }).eq('world_id', worldId).eq('type_code', t.code);
                        await onReload();
                      }} />
                  </td>
                  <td className="pr-2">
                    <Input type="number" className="h-8 text-sm w-24" value={String(val(t, 'default_modifier_pct'))}
                      onChange={e => setDraft(d => ({ ...d, [t.id]: { ...d[t.id], default_modifier_pct: Number(e.target.value) || 0 } }))}
                      onBlur={e => save(t, { default_modifier_pct: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="text-xs text-muted-foreground">{used}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeType(t)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <DialogFooter>
          <Button variant="secondary" onClick={addType}><Plus size={14} className="mr-1" />Přidat typ</Button>
          <Button onClick={() => onOpenChange(false)}>Hotovo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
