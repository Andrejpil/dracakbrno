import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { effectiveLocationPct } from '@/lib/pricing';
import type { PriceLocation, PriceLocationType } from './types';

const PAGE = 50;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  locations: PriceLocation[];
  types: PriceLocationType[];
  onEdit: (l: PriceLocation) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReload: () => Promise<void> | void;
}

export default function SettlementsManagerDialog({
  open, onOpenChange, worldId, locations, types, onEdit, onAdd, onDelete, onReload,
}: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all'); // all | default | custom
  const [modMin, setModMin] = useState('');
  const [modMax, setModMax] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkType, setBulkType] = useState('');
  const [bulkSet, setBulkSet] = useState('');
  const [bulkDelta, setBulkDelta] = useState('');
  const [busy, setBusy] = useState(false);

  const typesByCode = useMemo(
    () => Object.fromEntries(types.map(t => [t.code, t])) as Record<string, PriceLocationType>,
    [types]
  );

  const filtered = useMemo(() => locations.filter(l => {
    const eff = effectiveLocationPct(l, typesByCode);
    if (typeFilter !== 'all' && (l.type_code || l.type) !== typeFilter) return false;
    if (sourceFilter === 'default' && !l.uses_type_default) return false;
    if (sourceFilter === 'custom' && l.uses_type_default) return false;
    if (modMin !== '' && eff < Number(modMin)) return false;
    if (modMax !== '' && eff > Number(modMax)) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${l.name} ${l.code || ''}`.toLowerCase().includes(q)) return false;
    return true;
  }), [locations, typesByCode, typeFilter, sourceFilter, modMin, modMax, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pageCount - 1);
  const rows = filtered.slice(p * PAGE, p * PAGE + PAGE);
  const sel = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string, on: boolean) {
    const n = new Set(sel);
    if (on) n.add(id); else n.delete(id);
    setSelected(Array.from(n));
  }

  async function apply(patchFn: (l: PriceLocation) => Record<string, any>, question: string) {
    if (!selected.length) return;
    if (!confirm(question)) return;
    setBusy(true);
    try {
      const byPatch = new Map<string, string[]>();
      selected.forEach(id => {
        const loc = locations.find(l => l.id === id);
        if (!loc) return;
        const key = JSON.stringify(patchFn(loc));
        byPatch.set(key, [...(byPatch.get(key) || []), id]);
      });
      for (const [key, ids] of byPatch) {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await supabase.from('price_locations' as any)
            .update(JSON.parse(key)).in('id', ids.slice(i, i + 200)).eq('world_id', worldId);
          if (error) throw error;
        }
      }
      toast.success(`Upraveno ${selected.length} sídel.`);
      setSelected([]);
      await onReload();
    } catch (e: any) {
      toast.error(e.message || 'Hromadná změna selhala');
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Spravovat sídla ({locations.length})</DialogTitle></DialogHeader>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-8 text-sm" placeholder="Hledat sídlo nebo kód…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny typy</SelectItem>
              {types.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Výchozí i vlastní</SelectItem>
              <SelectItem value="default">Používá výchozí hodnotu typu</SelectItem>
              <SelectItem value="custom">Má vlastní hodnotu</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs w-24" type="number" placeholder="% od" value={modMin} onChange={e => { setModMin(e.target.value); setPage(0); }} />
          <Input className="h-8 text-xs w-24" type="number" placeholder="% do" value={modMax} onChange={e => { setModMax(e.target.value); setPage(0); }} />
          <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Přidat</Button>
        </div>

        <div className="flex gap-2 items-center text-xs flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setSelected(Array.from(new Set([...selected, ...rows.map(r => r.id)])))}>
            Vybrat stránku
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelected(filtered.map(r => r.id))}>
            Vybrat všechny filtrované ({filtered.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Zrušit výběr</Button>
          <span className="text-muted-foreground ml-auto">Vybráno: <strong>{selected.length}</strong></span>
        </div>

        {selected.length > 0 && (
          <div className="border rounded p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-medium">Hromadné akce pro {selected.length} sídel</p>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={bulkType} onValueChange={setBulkType}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Typ sídla" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkType || busy}
                onClick={() => apply(() => ({ type_code: bulkType, type: bulkType }),
                  `Opravdu chcete nastavit typ ${types.find(t => t.code === bulkType)?.label} u ${selected.length} sídel?`)}>
                Nastavit typ
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Input className="h-8 text-xs w-28" type="number" placeholder="hodnota %" value={bulkSet} onChange={e => setBulkSet(e.target.value)} />
              <Button size="sm" disabled={bulkSet === '' || busy}
                onClick={() => apply(() => ({ price_modifier_pct: Number(bulkSet) || 0, uses_type_default: false }),
                  `Nastavit vlastní modifikátor ${bulkSet} % u ${selected.length} sídel?`)}>
                Nastavit vlastní hodnotu
              </Button>
              <Input className="h-8 text-xs w-28" type="number" placeholder="+/- %" value={bulkDelta} onChange={e => setBulkDelta(e.target.value)} />
              <Button size="sm" disabled={bulkDelta === '' || busy}
                onClick={() => apply(l => ({
                  price_modifier_pct: effectiveLocationPct(l, typesByCode) + (Number(bulkDelta) || 0),
                  uses_type_default: false,
                }), `Změnit modifikátor o ${bulkDelta} % u ${selected.length} sídel?`)}>
                Přičíst / odečíst
              </Button>
              <Button size="sm" variant="secondary" disabled={busy}
                onClick={() => apply(() => ({ uses_type_default: true }),
                  `Použít výchozí modifikátor typu u ${selected.length} sídel?`)}>
                Použít výchozí hodnotu typu
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="w-8"></th>
                <th className="text-left py-2">Sídlo</th>
                <th className="text-left">Kód</th>
                <th className="text-left">Typ</th>
                <th className="text-left">Výsledný modifikátor</th>
                <th className="text-left">Zdroj</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(l => {
                const eff = effectiveLocationPct(l, typesByCode);
                return (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td><Checkbox checked={sel.has(l.id)} onCheckedChange={v => toggle(l.id, !!v)} /></td>
                    <td className="py-1.5 font-medium">{l.name}</td>
                    <td className="text-xs text-muted-foreground">{l.code}</td>
                    <td>{typesByCode[l.type_code || l.type]?.label || l.type_code || '—'}</td>
                    <td className={eff > 0 ? 'text-destructive' : eff < 0 ? 'text-primary' : ''}>{eff > 0 ? '+' : ''}{eff} %</td>
                    <td className="text-xs">
                      {l.uses_type_default
                        ? <span className="text-muted-foreground">Výchozí hodnota typu</span>
                        : <span className="text-foreground font-medium">Vlastní hodnota</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(l)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(l.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center">
          <span className="text-xs text-muted-foreground mr-auto">Strana {p + 1} / {pageCount} ({filtered.length} sídel)</span>
          <Button size="sm" variant="secondary" disabled={p === 0} onClick={() => setPage(p - 1)}>Předchozí</Button>
          <Button size="sm" variant="secondary" disabled={p >= pageCount - 1} onClick={() => setPage(p + 1)}>Další</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
