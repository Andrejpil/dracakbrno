import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { PriceLocation, PriceLocationType } from './types';

const PAGE = 50;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  locations: PriceLocation[];
  types: PriceLocationType[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function SettlementPickerDialog({ open, onOpenChange, title, locations, types, selected, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);

  const sel = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => locations.filter(l => {
    if (typeFilter !== 'all' && (l.type_code || l.type) !== typeFilter) return false;
    if (search.trim() && !l.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [locations, search, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pageCount - 1);
  const rows = filtered.slice(p * PAGE, p * PAGE + PAGE);

  function toggle(id: string, on: boolean) {
    const next = new Set(sel);
    if (on) next.add(id); else next.delete(id);
    onChange(Array.from(next));
  }
  function bulk(on: boolean) {
    const next = new Set(sel);
    filtered.forEach(l => (on ? next.add(l.id) : next.delete(l.id)));
    onChange(Array.from(next));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-8 text-sm" placeholder="Hledat sídlo…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny typy</SelectItem>
              {types.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center flex-wrap text-xs">
          <Button size="sm" variant="secondary" onClick={() => bulk(true)}>Vybrat všechna filtrovaná</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk(false)}>Zrušit výběr filtrovaných</Button>
          <span className="text-muted-foreground ml-auto">Vybráno: <strong>{sel.size}</strong> / {locations.length}</span>
        </div>
        <div className="max-h-[45vh] overflow-y-auto border rounded">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground p-3">Žádná sídla.</p> : rows.map(l => (
            <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 hover:bg-muted/40 cursor-pointer text-sm">
              <Checkbox checked={sel.has(l.id)} onCheckedChange={v => toggle(l.id, !!v)} />
              <span className="flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground">
                {types.find(t => t.code === (l.type_code || l.type))?.label || l.type_code}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter className="items-center">
          <span className="text-xs text-muted-foreground mr-auto">Strana {p + 1} / {pageCount} ({filtered.length} sídel)</span>
          <Button size="sm" variant="secondary" disabled={p === 0} onClick={() => setPage(p - 1)}>Předchozí</Button>
          <Button size="sm" variant="secondary" disabled={p >= pageCount - 1} onClick={() => setPage(p + 1)}>Další</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Hotovo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
