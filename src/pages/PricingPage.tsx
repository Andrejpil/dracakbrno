import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorld } from '@/contexts/WorldContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Coins, Plus, Trash2, Pencil, Landmark, Boxes, TrendingUp, Search, Upload, Download, Eye, Settings2, Tags, FileSpreadsheet, FileArchive } from 'lucide-react';
import { toast } from 'sonner';
import {
  ECONOMY_PRESETS, ECONOMY_LABELS,
  computePrice, formatCopper, effectiveLocationPct, availabilitySummary,
} from '@/lib/pricing';
import {
  AVAILABILITY_LABELS, AvailabilityMode, slugify,
  downloadXlsx, downloadZip, downloadCsv, PricingExportData,
  itemRows, settlementRows, typeRows,
} from '@/lib/pricingIO';
import SettlementsManagerDialog from '@/components/pricing/SettlementsManagerDialog';
import SettlementTypesDialog from '@/components/pricing/SettlementTypesDialog';
import ItemEditorDialog from '@/components/pricing/ItemEditorDialog';
import PricingImportDialog from '@/components/pricing/PricingImportDialog';
import type { PriceItem, PriceLocation, PriceLocationType, PriceItemLocation } from '@/components/pricing/types';

interface EconState { id: string; world_id: string; code: string; label: string; modifier_pct: number; sort_order: number; }

const PAGE_SIZE = 25;

export default function PricingPage() {
  const { activeWorldId } = useWorld();
  const { canEdit, loading: roleLoading } = useUserRole();

  const [locations, setLocations] = useState<PriceLocation[]>([]);
  const [types, setTypes] = useState<PriceLocationType[]>([]);
  const [states, setStates] = useState<EconState[]>([]);
  const [activeStateCode, setActiveStateCode] = useState('normal');
  const [categories, setCategories] = useState<string[]>([]);

  const [items, setItems] = useState<PriceItem[]>([]);
  const [itemLocs, setItemLocs] = useState<PriceItemLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all');

  const [econOpen, setEconOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [locListOpen, setLocListOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [locDraft, setLocDraft] = useState<Partial<PriceLocation>>({});
  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<PriceItem | null>(null);
  const [pricesItem, setPricesItem] = useState<PriceItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const canEditPage = canEdit('pricing');

  const typesByCode = useMemo(
    () => Object.fromEntries(types.map(t => [t.code, t])) as Record<string, PriceLocationType>,
    [types]
  );
  const econMod = useMemo(
    () => states.find(s => s.code === activeStateCode)?.modifier_pct ?? 0,
    [states, activeStateCode]
  );

  // ---------- base data ----------
  async function loadBase(worldId: string) {
    const [locRes, typeRes, econRes, stRes, catRes] = await Promise.all([
      supabase.from('price_locations' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_location_types' as any).select('*').eq('world_id', worldId).order('sort_order'),
      supabase.from('world_economy' as any).select('*').eq('world_id', worldId).maybeSingle(),
      supabase.from('world_economy_states' as any).select('*').eq('world_id', worldId).order('sort_order'),
      supabase.from('price_items' as any).select('category').eq('world_id', worldId).not('category', 'is', null).limit(2000),
    ]);
    setLocations(((locRes.data as any) || []) as PriceLocation[]);

    let tp = ((typeRes.data as any) || []) as PriceLocationType[];
    if (tp.length === 0) {
      const seed = [
        ['city', 'Město', 10], ['town', 'Městečko', 5], ['village', 'Vesnice', 0], ['hamlet', 'Osada', -10],
        ['fortress', 'Pevnost', 15], ['market', 'Trh', -5], ['abbey', 'Opatství', 0], ['port', 'Přístav', 5],
        ['castle', 'Hrad', 10], ['camp', 'Tábor', -5],
      ].map(([code, label, pct], i) => ({ world_id: worldId, code, label, default_modifier_pct: pct, sort_order: i }));
      const { data } = await supabase.from('price_location_types' as any).insert(seed).select('*');
      tp = ((data as any) || []) as PriceLocationType[];
    }
    setTypes(tp);

    let st = ((stRes.data as any) || []) as EconState[];
    if (st.length === 0) {
      const seed = Object.keys(ECONOMY_PRESETS).filter(k => k !== 'custom').map((k, i) => ({
        world_id: worldId, code: k, label: ECONOMY_LABELS[k] || k, modifier_pct: ECONOMY_PRESETS[k], sort_order: i,
      }));
      const { data } = await supabase.from('world_economy_states' as any).insert(seed).select('*');
      st = ((data as any) || []) as EconState[];
    }
    setStates(st);

    const econ: any = econRes.data;
    setActiveStateCode(econ?.active_state_code || econ?.state || 'normal');
    if (!econ) {
      await supabase.from('world_economy' as any).upsert(
        { world_id: worldId, state: 'normal', custom_modifier_pct: 0, active_state_code: 'normal' },
        { onConflict: 'world_id' }
      );
    }
    setCategories(Array.from(new Set((((catRes.data as any[]) || []).map(r => r.category)).filter(Boolean))).sort());
  }

  // ---------- server-side paged items ----------
  async function loadItems(worldId: string) {
    setLoading(true);
    let q = supabase.from('price_items' as any)
      .select('*', { count: 'exact' })
      .eq('world_id', worldId);
    if (debouncedSearch.trim()) q = q.or(`name.ilike.%${debouncedSearch.trim()}%,code.ilike.%${debouncedSearch.trim()}%`);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    if (filterMode !== 'all') q = q.eq('availability_mode', filterMode);
    const { data, count, error } = await q.order('name').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = ((data as any) || []) as PriceItem[];
    setItems(rows);
    setTotal(count || 0);
    if (rows.length) {
      const { data: links } = await supabase.from('price_item_locations' as any)
        .select('*').in('item_id', rows.map(r => r.id));
      setItemLocs(((links as any) || []) as PriceItemLocation[]);
    } else setItemLocs([]);
    setLoading(false);
  }

  useEffect(() => { if (activeWorldId) loadBase(activeWorldId); }, [activeWorldId]);
  useEffect(() => { if (activeWorldId) loadItems(activeWorldId); }, [activeWorldId, page, debouncedSearch, filterCategory, filterMode]);
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [filterCategory, filterMode]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ---------- economy ----------
  async function setActiveState(code: string) {
    if (!activeWorldId) return;
    setActiveStateCode(code);
    const known = ['normal', 'mobilization', 'war', 'famine', 'plague', 'festival', 'trade_boom', 'embargo', 'custom'];
    const { error } = await supabase.from('world_economy' as any).upsert({
      world_id: activeWorldId,
      state: known.includes(code) ? code : 'custom',
      custom_modifier_pct: states.find(s => s.code === code)?.modifier_pct ?? 0,
      active_state_code: code,
    }, { onConflict: 'world_id' });
    if (error) toast.error(error.message);
  }
  async function updateState(id: string, patch: Partial<EconState>) {
    setStates(prev => prev.map(s => (s.id === id ? { ...s, ...patch } as EconState : s)));
    const { error } = await supabase.from('world_economy_states' as any).update(patch).eq('id', id);
    if (error) toast.error(error.message);
  }
  async function addState() {
    if (!activeWorldId) return;
    const { data, error } = await supabase.from('world_economy_states' as any)
      .insert({ world_id: activeWorldId, code: `stav_${Date.now().toString(36)}`, label: 'Nový stav', modifier_pct: 0, sort_order: states.length })
      .select('*').single();
    if (error) { toast.error(error.message); return; }
    setStates(prev => [...prev, data as any]);
  }
  async function deleteState(s: EconState) {
    if (states.length <= 1) { toast.error('Musí zůstat alespoň jeden stav.'); return; }
    if (!confirm(`Smazat stav „${s.label}"?`)) return;
    const { error } = await supabase.from('world_economy_states' as any).delete().eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    const rest = states.filter(x => x.id !== s.id);
    setStates(rest);
    if (activeStateCode === s.code) await setActiveState(rest[0].code);
  }

  // ---------- locations ----------
  function openNewLocation() {
    setLocDraft({ name: '', code: '', type_code: types[0]?.code || 'village', uses_type_default: true, price_modifier_pct: 0, note: '' });
    setLocOpen(true);
  }
  async function saveLocation() {
    if (!activeWorldId || !locDraft.name?.trim()) { toast.error('Vyplň název'); return; }
    const typeCode = locDraft.type_code || types[0]?.code || 'village';
    const payload = {
      world_id: activeWorldId,
      name: locDraft.name.trim(),
      code: slugify(locDraft.code?.trim() || locDraft.name),
      type: typeCode,
      type_code: typeCode,
      uses_type_default: !!locDraft.uses_type_default,
      price_modifier_pct: Number(locDraft.price_modifier_pct) || 0,
      note: locDraft.note || null,
    };
    const { error } = locDraft.id
      ? await supabase.from('price_locations' as any).update(payload).eq('id', locDraft.id)
      : await supabase.from('price_locations' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    setLocOpen(false);
    await loadBase(activeWorldId);
  }
  async function deleteLocation(id: string) {
    if (!confirm('Smazat sídlo? Odpojí se od všech položek.')) return;
    const { error } = await supabase.from('price_locations' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (activeWorldId) await loadBase(activeWorldId);
  }

  async function deleteItem(id: string) {
    if (!confirm('Smazat položku?')) return;
    const { error } = await supabase.from('price_items' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (activeWorldId) await loadItems(activeWorldId);
  }

  // ---------- export ----------
  async function collectExport(): Promise<PricingExportData> {
    const worldId = activeWorldId!;
    const all: PriceItem[] = [];
    const step = 1000;
    for (let from = 0; ; from += step) {
      const { data } = await supabase.from('price_items' as any).select('*').eq('world_id', worldId).order('name').range(from, from + step - 1);
      const rows = ((data as any) || []) as PriceItem[];
      all.push(...rows);
      if (rows.length < step) break;
    }
    const links: PriceItemLocation[] = [];
    for (let i = 0; i < all.length; i += 200) {
      const { data } = await supabase.from('price_item_locations' as any).select('*').in('item_id', all.slice(i, i + 200).map(a => a.id));
      links.push(...(((data as any) || []) as PriceItemLocation[]));
    }
    const locCodeById = new Map(locations.map(l => [l.id, l.code || slugify(l.name)]));
    const linksByItem = new Map<string, PriceItemLocation[]>();
    links.forEach(l => {
      const arr = linksByItem.get(l.item_id) || [];
      arr.push(l);
      linksByItem.set(l.item_id, arr);
    });

    return {
      types: types.map(t => ({ code: t.code, label: t.label, default_modifier_pct: t.default_modifier_pct })),
      settlements: locations.map(l => ({
        code: l.code || slugify(l.name),
        name: l.name,
        type_code: l.type_code || l.type,
        type_label: typesByCode[l.type_code || l.type]?.label || l.type_code || l.type,
        effective_pct: effectiveLocationPct(l, typesByCode),
        uses_type_default: !!l.uses_type_default,
      })),
      items: all.map(it => {
        const mode = (it.availability_mode as AvailabilityMode) || 'EVERYWHERE';
        const own = linksByItem.get(it.id) || [];
        const cells: Record<string, boolean | number> = {};
        const selected = new Map(own.map(l => [locCodeById.get(l.location_id) || '', l.override_modifier_pct]));
        for (const l of locations) {
          const code = l.code || slugify(l.name);
          if (mode === 'NOWHERE') cells[code] = false;
          else if (mode === 'EVERYWHERE') cells[code] = true;
          else if (mode === 'ONLY_SELECTED') {
            if (!selected.has(code)) cells[code] = false;
            else { const ov = selected.get(code); cells[code] = ov == null ? true : ov; }
          } else cells[code] = !selected.has(code);
        }
        return {
          code: it.code || slugify(it.name),
          name: it.name,
          category: it.category || '',
          unit: it.unit || '',
          base_price_copper: it.base_price_copper,
          availability_mode: mode,
          cells,
        };
      }),
    };
  }
  async function doExport(kind: 'xlsx' | 'zip' | 'item' | 'mesta' | 'sidla') {
    if (!activeWorldId) return;
    setExportBusy(true);
    try {
      const data = await collectExport();
      if (kind === 'xlsx') downloadXlsx(data);
      else if (kind === 'zip') await downloadZip(data);
      else if (kind === 'item') downloadCsv(itemRows(data), 'ITEM.csv');
      else if (kind === 'mesta') downloadCsv(settlementRows(data), 'MESTA.csv');
      else downloadCsv(typeRows(data), 'SIDLA.csv');
    } catch (e: any) {
      toast.error(e.message || 'Export selhal');
    }
    setExportBusy(false);
  }


  if (roleLoading) return <p className="text-muted-foreground">Načítám…</p>;
  if (!canEditPage) {
    return (
      <Card className="p-6 max-w-xl">
        <h1 className="text-xl font-display text-primary mb-2">Přístup odepřen</h1>
        <p className="text-sm text-muted-foreground">Ceník je dostupný pouze pro Editory a Administrátory.</p>
      </Card>
    );
  }
  if (!activeWorldId) return <p className="text-muted-foreground">Vyber svět v levém panelu.</p>;

  // locations relevant for an item (used in price dialog)
  function itemLocationsFor(it: PriceItem): { loc: PriceLocation; override: number | null }[] {
    const links = itemLocs.filter(il => il.item_id === it.id);
    const linkedIds = new Set(links.map(l => l.location_id));
    if (it.availability_mode === 'NOWHERE') return [];
    if (it.availability_mode === 'ONLY_SELECTED') {
      return links.map(l => ({ loc: locations.find(x => x.id === l.location_id)!, override: l.override_modifier_pct }))
        .filter(x => x.loc);
    }
    const base = it.availability_mode === 'EXCEPT_SELECTED'
      ? locations.filter(l => !linkedIds.has(l.id))
      : locations;
    return base.map(loc => ({ loc, override: null }));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Coins className="text-primary" />
        <h1 className="text-3xl font-display text-primary">Ceník</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        1 zl = 10 st = 100 md. Ceny se počítají a ukládají v měděných. Ceník vidí a upravují jen Editor a Admin, data jsou oddělená podle světa.
      </p>

      {/* Economy */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg flex items-center gap-2"><TrendingUp size={18} className="text-primary" />Světová ekonomika</h2>
          <Button size="sm" variant="secondary" onClick={() => setEconOpen(true)}><Settings2 size={14} className="mr-1" />Spravovat stavy</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs">Aktuální stav</Label>
            <Select value={activeStateCode} onValueChange={setActiveState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {states.map(s => (
                  <SelectItem key={s.id} value={s.code}>{s.label} ({s.modifier_pct > 0 ? '+' : ''}{s.modifier_pct} %)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm">
            Modifikátor: <strong className={econMod === 0 ? '' : econMod > 0 ? 'text-destructive' : 'text-primary'}>
              {econMod > 0 ? '+' : ''}{econMod} %
            </strong>
          </div>
        </div>
      </Card>

      {/* Settlements */}
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Landmark size={18} className="text-primary" />Sídla
          <span className="text-sm text-muted-foreground font-sans">({locations.length})</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setTypesOpen(true)}><Tags size={14} className="mr-1" />Typy sídel</Button>
          <Button size="sm" variant="secondary" onClick={() => setLocListOpen(true)}><Eye size={14} className="mr-1" />Spravovat sídla</Button>
          <Button size="sm" onClick={openNewLocation}><Plus size={14} className="mr-1" />Přidat sídlo</Button>
        </div>
      </Card>

      {/* Items */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Boxes size={18} className="text-primary" />Předměty a služby
            <span className="text-sm text-muted-foreground font-sans">({total})</span>
          </h2>
          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('xlsx')}>
              <FileSpreadsheet size={14} className="mr-1" />Export XLSX
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('zip')}>
              <FileArchive size={14} className="mr-1" />CSV (ZIP)
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('items')}>
              <Download size={14} className="mr-1" />items.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('settlements')}>
              <Download size={14} className="mr-1" />settlements.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('availability')}>
              <Download size={14} className="mr-1" />availability.csv
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}><Upload size={14} className="mr-1" />Import</Button>
            <Button size="sm" onClick={() => { setEditItem(null); setItemOpen(true); }}><Plus size={14} className="mr-1" />Přidat položku</Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-8 text-sm" placeholder="Hledat předmět nebo kód…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Dostupnost" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny režimy</SelectItem>
              {(Object.keys(AVAILABILITY_LABELS) as AvailabilityMode[]).map(m => (
                <SelectItem key={m} value={m}>{AVAILABILITY_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Načítám…</p> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné položky.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2">Název</th>
                    <th className="text-left">Kód</th>
                    <th className="text-left">Kategorie</th>
                    <th className="text-left">Jednotka</th>
                    <th className="text-left">Základ</th>
                    <th className="text-left">Dostupnost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const linked = itemLocs.filter(il => il.item_id === it.id).length;
                    return (
                      <tr key={it.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 font-medium">{it.name}</td>
                        <td className="text-xs text-muted-foreground">{it.code}</td>
                        <td>{it.category}</td>
                        <td>{it.unit}</td>
                        <td className="whitespace-nowrap">{formatCopper(it.base_price_copper)}</td>
                        <td className="text-xs">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPricesItem(it)}>
                            {availabilitySummary(it.availability_mode, linked)}
                          </Button>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => { setEditItem(it); setItemOpen(true); }}><Pencil size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteItem(it.id)}><Trash2 size={14} className="text-destructive" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>Strana {page + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Předchozí</Button>
                <Button size="sm" variant="secondary" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Další</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Economy states dialog */}
      <Dialog open={econOpen} onOpenChange={setEconOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stavy světové ekonomiky</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {states.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <Input className="flex-1 h-8 text-sm" value={s.label}
                  onChange={e => setStates(prev => prev.map(x => x.id === s.id ? { ...x, label: e.target.value } : x))}
                  onBlur={e => updateState(s.id, { label: e.target.value.trim() || 'Stav' })} />
                <Input type="number" className="w-24 h-8 text-sm" value={s.modifier_pct}
                  onChange={e => setStates(prev => prev.map(x => x.id === s.id ? { ...x, modifier_pct: Number(e.target.value) || 0 } : x))}
                  onBlur={e => updateState(s.id, { modifier_pct: Number(e.target.value) || 0 })} />
                <span className="text-xs">%</span>
                <Button size="sm" variant="ghost" onClick={() => deleteState(s)}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={addState}><Plus size={14} className="mr-1" />Přidat stav</Button>
            <Button onClick={() => setEconOpen(false)}>Hotovo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettlementTypesDialog
        open={typesOpen} onOpenChange={setTypesOpen}
        worldId={activeWorldId} types={types} locations={locations}
        onReload={() => loadBase(activeWorldId)}
      />

      <SettlementsManagerDialog
        open={locListOpen} onOpenChange={setLocListOpen}
        worldId={activeWorldId} locations={locations} types={types}
        onEdit={l => { setLocDraft(l); setLocOpen(true); }}
        onAdd={openNewLocation}
        onDelete={deleteLocation}
        onReload={() => loadBase(activeWorldId)}
      />

      <ItemEditorDialog
        open={itemOpen} onOpenChange={setItemOpen}
        worldId={activeWorldId} item={editItem} locations={locations} types={types} econMod={econMod}
        onSaved={async () => { await loadBase(activeWorldId); await loadItems(activeWorldId); }}
      />

      <PricingImportDialog
        open={importOpen} onOpenChange={setImportOpen} worldId={activeWorldId}
        onDone={async () => { await loadBase(activeWorldId); await loadItems(activeWorldId); }}
      />

      {/* Prices per item dialog */}
      <Dialog open={!!pricesItem} onOpenChange={o => !o && setPricesItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ceny — {pricesItem?.name}</DialogTitle>
          </DialogHeader>
          {pricesItem && (
            <>
              <p className="text-xs text-muted-foreground">
                {AVAILABILITY_LABELS[(pricesItem.availability_mode as AvailabilityMode)] || pricesItem.availability_mode}
              </p>
              <div className="flex flex-wrap gap-1">
                {itemLocationsFor(pricesItem).slice(0, 300).map(({ loc, override }) => {
                  const locMod = override ?? effectiveLocationPct(loc, typesByCode);
                  const calc = computePrice({
                    basePriceCopper: pricesItem.base_price_copper,
                    locationModifierPct: locMod,
                    economyModifierPct: econMod,
                  });
                  return (
                    <Tooltip key={loc.id}>
                      <TooltipTrigger asChild>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted cursor-help">
                          <strong>{loc.name}:</strong> {formatCopper(calc.final)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        <div>Základ: {formatCopper(calc.base)}</div>
                        <div>Sídlo: {locMod > 0 ? '+' : ''}{locMod} %{override != null ? ' (výjimka položky)' : loc.uses_type_default ? ' (výchozí hodnota typu)' : ' (vlastní hodnota sídla)'}</div>
                        <div>Ekonomika: {econMod > 0 ? '+' : ''}{econMod} %</div>
                        <div className="border-t mt-1 pt-1">Výsledek: <strong>{formatCopper(calc.final)}</strong></div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {itemLocationsFor(pricesItem).length === 0 && (
                  <p className="text-sm text-muted-foreground">Položka není nikde dostupná.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{locDraft.id ? 'Upravit sídlo' : 'Nové sídlo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Název</Label>
                <Input value={locDraft.name || ''} onChange={e => setLocDraft(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Unikátní kód</Label>
                <Input value={locDraft.code || ''} placeholder={slugify(locDraft.name || '')}
                  onChange={e => setLocDraft(p => ({ ...p, code: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Typ sídla</Label>
                <Select value={locDraft.type_code || types[0]?.code || 'village'}
                  onValueChange={v => setLocDraft(p => ({ ...p, type_code: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map(t => <SelectItem key={t.code} value={t.code}>{t.label} ({t.default_modifier_pct > 0 ? '+' : ''}{t.default_modifier_pct} %)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vlastní modifikátor (%)</Label>
                <Input type="number" disabled={!!locDraft.uses_type_default} value={locDraft.price_modifier_pct ?? 0}
                  onChange={e => setLocDraft(p => ({ ...p, price_modifier_pct: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!locDraft.uses_type_default}
                onCheckedChange={v => setLocDraft(p => ({ ...p, uses_type_default: !!v }))} />
              Používat výchozí procento typu
              {locDraft.uses_type_default && (
                <span className="text-xs text-muted-foreground">
                  (nyní {typesByCode[locDraft.type_code || '']?.default_modifier_pct ?? 0} %)
                </span>
              )}
            </label>
            <div>
              <Label className="text-xs">Poznámka</Label>
              <Textarea value={locDraft.note || ''} onChange={e => setLocDraft(p => ({ ...p, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLocOpen(false)}>Zrušit</Button>
            <Button onClick={saveLocation}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
