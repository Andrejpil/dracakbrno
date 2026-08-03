import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorld } from '@/contexts/WorldContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Coins, Plus, Trash2, Pencil, Landmark, Boxes, TrendingUp, Search, Upload, Download, Eye, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ECONOMY_PRESETS, ECONOMY_LABELS, LOCATION_LABELS,
  computePrice, copperToParts, partsToCopper, formatCopper,
  buildItemsCsv, parseItemsCsv, CsvItemRow,
} from '@/lib/pricing';

type LocType = 'city' | 'town' | 'village' | 'hamlet' | 'fortress' | 'market';

interface Location { id: string; world_id: string; name: string; type: LocType; price_modifier_pct: number; note: string | null; }
interface Item { id: string; world_id: string; name: string; category: string | null; base_price_copper: number; unit: string | null; note: string | null; }
interface ItemLoc { id: string; item_id: string; location_id: string; override_modifier_pct: number | null; }
interface EconState { id: string; world_id: string; code: string; label: string; modifier_pct: number; sort_order: number; }

const PAGE_SIZE = 25;

export default function PricingPage() {
  const { activeWorldId } = useWorld();
  const { canEdit, loading: roleLoading } = useUserRole();

  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLocs, setItemLocs] = useState<ItemLoc[]>([]);
  const [states, setStates] = useState<EconState[]>([]);
  const [activeStateCode, setActiveStateCode] = useState<string>('normal');
  const [loading, setLoading] = useState(true);

  // dialogs
  const [locOpen, setLocOpen] = useState(false);
  const [locDraft, setLocDraft] = useState<Partial<Location>>({});
  const [locListOpen, setLocListOpen] = useState(false);
  const [locSearch, setLocSearch] = useState('');

  const [econOpen, setEconOpen] = useState(false);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<Partial<Item>>({});
  const [itemLocDraft, setItemLocDraft] = useState<Record<string, { checked: boolean; override: string }>>({});
  const [itemLocSearch, setItemLocSearch] = useState('');
  const [pricesItem, setPricesItem] = useState<Item | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const canEditPage = canEdit('pricing');

  async function loadAll(worldId: string) {
    setLoading(true);
    const [locRes, itmRes, econRes, stRes] = await Promise.all([
      supabase.from('price_locations' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_items' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('world_economy' as any).select('*').eq('world_id', worldId).maybeSingle(),
      supabase.from('world_economy_states' as any).select('*').eq('world_id', worldId).order('sort_order'),
    ]);
    const locs = (locRes.data as any) || [];
    const itms = (itmRes.data as any) || [];
    setLocations(locs);
    setItems(itms);
    if (itms.length) {
      const ids = itms.map((i: Item) => i.id);
      const { data: ilData } = await supabase.from('price_item_locations' as any).select('*').in('item_id', ids);
      setItemLocs((ilData as any) || []);
    } else setItemLocs([]);

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
    const code = econ?.active_state_code || econ?.state || 'normal';
    setActiveStateCode(code);
    if (!econ) {
      await supabase.from('world_economy' as any).upsert(
        { world_id: worldId, state: 'normal', custom_modifier_pct: 0, active_state_code: 'normal' },
        { onConflict: 'world_id' }
      );
    }
    setLoading(false);
  }

  useEffect(() => { if (activeWorldId) loadAll(activeWorldId); }, [activeWorldId]);
  useEffect(() => { setPage(0); }, [search, filterCategory, filterLocation]);

  const econMod = useMemo(
    () => states.find(s => s.code === activeStateCode)?.modifier_pct ?? 0,
    [states, activeStateCode]
  );

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[], [items]);

  const filteredItems = useMemo(() => items.filter(i => {
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (search.trim() && !`${i.name} ${i.category || ''}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filterLocation !== 'all' && !itemLocs.some(il => il.item_id === i.id && il.location_id === filterLocation)) return false;
    return true;
  }), [items, itemLocs, filterCategory, filterLocation, search]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const filteredLocations = useMemo(() => locations.filter(
    l => !locSearch.trim() || l.name.toLowerCase().includes(locSearch.trim().toLowerCase())
  ), [locations, locSearch]);

  // ---------------- Economy ----------------
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
    const code = `stav_${Date.now().toString(36)}`;
    const { data, error } = await supabase.from('world_economy_states' as any)
      .insert({ world_id: activeWorldId, code, label: 'Nový stav', modifier_pct: 0, sort_order: states.length })
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

  // ---------------- Locations ----------------
  function openNewLocation() { setLocDraft({ name: '', type: 'village', price_modifier_pct: 0, note: '' }); setLocOpen(true); }
  function openEditLocation(l: Location) { setLocDraft(l); setLocOpen(true); }
  async function saveLocation() {
    if (!activeWorldId || !locDraft.name?.trim()) { toast.error('Vyplň název'); return; }
    const payload = {
      world_id: activeWorldId,
      name: locDraft.name!.trim(),
      type: (locDraft.type || 'village') as LocType,
      price_modifier_pct: Number(locDraft.price_modifier_pct) || 0,
      note: locDraft.note || null,
    };
    const { error } = locDraft.id
      ? await supabase.from('price_locations' as any).update(payload).eq('id', locDraft.id)
      : await supabase.from('price_locations' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    setLocOpen(false);
    await loadAll(activeWorldId);
  }
  async function deleteLocation(id: string) {
    if (!confirm('Smazat sídlo? Odpojí se od všech položek.')) return;
    const { error } = await supabase.from('price_locations' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (activeWorldId) await loadAll(activeWorldId);
  }

  // ---------------- Items ----------------
  function openNewItem() {
    setItemDraft({ name: '', category: '', base_price_copper: 0, unit: '', note: '' });
    const map: Record<string, { checked: boolean; override: string }> = {};
    locations.forEach(l => { map[l.id] = { checked: false, override: '' }; });
    setItemLocDraft(map); setItemLocSearch(''); setItemOpen(true);
  }
  function openEditItem(it: Item) {
    setItemDraft(it);
    const map: Record<string, { checked: boolean; override: string }> = {};
    locations.forEach(l => {
      const existing = itemLocs.find(il => il.item_id === it.id && il.location_id === l.id);
      map[l.id] = {
        checked: !!existing,
        override: existing?.override_modifier_pct != null ? String(existing.override_modifier_pct) : '',
      };
    });
    setItemLocDraft(map); setItemLocSearch(''); setItemOpen(true);
  }
  async function saveItem() {
    if (!activeWorldId || !itemDraft.name?.trim()) { toast.error('Vyplň název'); return; }
    const payload = {
      world_id: activeWorldId,
      name: itemDraft.name!.trim(),
      category: itemDraft.category || null,
      base_price_copper: Number(itemDraft.base_price_copper) || 0,
      unit: itemDraft.unit || null,
      note: itemDraft.note || null,
    };
    let itemId = itemDraft.id;
    if (itemId) {
      const { error } = await supabase.from('price_items' as any).update(payload).eq('id', itemId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from('price_items' as any).insert(payload).select('id').single();
      if (error) { toast.error(error.message); return; }
      itemId = (data as any).id;
    }
    await supabase.from('price_item_locations' as any).delete().eq('item_id', itemId);
    const rows = Object.entries(itemLocDraft).filter(([, v]) => v.checked).map(([location_id, v]) => ({
      item_id: itemId, location_id,
      override_modifier_pct: v.override.trim() === '' ? null : Number(v.override),
    }));
    if (rows.length) {
      const { error: ilErr } = await supabase.from('price_item_locations' as any).insert(rows);
      if (ilErr) { toast.error(ilErr.message); return; }
    }
    setItemOpen(false);
    await loadAll(activeWorldId);
  }
  async function deleteItem(id: string) {
    if (!confirm('Smazat položku?')) return;
    const { error } = await supabase.from('price_items' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (activeWorldId) await loadAll(activeWorldId);
  }

  function toggleAllDraftLocations(checked: boolean) {
    setItemLocDraft(prev => {
      const next = { ...prev };
      filteredDraftLocations.forEach(l => { next[l.id] = { ...(next[l.id] || { override: '' }), checked }; });
      return next;
    });
  }
  const filteredDraftLocations = useMemo(() => locations.filter(
    l => !itemLocSearch.trim() || l.name.toLowerCase().includes(itemLocSearch.trim().toLowerCase())
  ), [locations, itemLocSearch]);

  // ---------------- Export / Import ----------------
  function exportCsv() {
    const rows: CsvItemRow[] = items.map(it => ({
      name: it.name,
      category: it.category || '',
      unit: it.unit || '',
      note: it.note || '',
      base_copper: it.base_price_copper,
      locations: itemLocs.filter(il => il.item_id === it.id).map(il => ({
        name: locations.find(l => l.id === il.location_id)?.name || '',
        override: il.override_modifier_pct,
      })).filter(l => l.name),
    }));
    const csv = buildItemsCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cenik-predmety.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportTemplate() {
    const csv = buildItemsCsv([{
      name: 'Pivo', category: 'Nápoje', unit: 'korbel', note: '', base_copper: 4,
      locations: locations.slice(0, 2).map(l => ({ name: l.name, override: null })),
    }]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cenik-sablona.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImport(replace: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file || !activeWorldId) { toast.error('Vyber CSV soubor.'); return; }
    setImportBusy(true);
    setImportLog([]);
    try {
      const text = await file.text();
      const { rows, errors } = parseItemsCsv(text);
      if (!rows.length) { setImportLog(errors.length ? errors : ['Žádné platné řádky.']); setImportBusy(false); return; }

      // ensure locations exist
      const locByName = new Map(locations.map(l => [l.name.toLowerCase(), l]));
      const missing = new Set<string>();
      rows.forEach(r => r.locations.forEach(l => { if (!locByName.has(l.name.toLowerCase())) missing.add(l.name); }));
      if (missing.size) {
        const { data: created, error } = await supabase.from('price_locations' as any).insert(
          Array.from(missing).map(name => ({ world_id: activeWorldId, name, type: 'village', price_modifier_pct: 0 }))
        ).select('*');
        if (error) throw error;
        ((created as any) || []).forEach((l: Location) => locByName.set(l.name.toLowerCase(), l));
      }

      if (replace) {
        const ids = items.map(i => i.id);
        if (ids.length) await supabase.from('price_items' as any).delete().in('id', ids);
      }

      const existingByName = replace ? new Map<string, Item>() : new Map(items.map(i => [i.name.toLowerCase(), i]));
      let created = 0, updated = 0;
      const chunk = 200;
      const toInsert = rows.filter(r => !existingByName.has(r.name.toLowerCase()));
      const toUpdate = rows.filter(r => existingByName.has(r.name.toLowerCase()));

      const insertedIds = new Map<string, string>();
      for (let i = 0; i < toInsert.length; i += chunk) {
        const slice = toInsert.slice(i, i + chunk);
        const { data, error } = await supabase.from('price_items' as any).insert(
          slice.map(r => ({
            world_id: activeWorldId, name: r.name, category: r.category || null,
            unit: r.unit || null, note: r.note || null, base_price_copper: r.base_copper,
          }))
        ).select('id, name');
        if (error) throw error;
        ((data as any) || []).forEach((d: any) => insertedIds.set(String(d.name).toLowerCase(), d.id));
        created += slice.length;
      }
      for (const r of toUpdate) {
        const ex = existingByName.get(r.name.toLowerCase())!;
        await supabase.from('price_items' as any).update({
          category: r.category || null, unit: r.unit || null,
          note: r.note || null, base_price_copper: r.base_copper,
        }).eq('id', ex.id);
        updated++;
      }

      // links
      const linkRows: any[] = [];
      for (const r of rows) {
        const id = insertedIds.get(r.name.toLowerCase()) || existingByName.get(r.name.toLowerCase())?.id;
        if (!id) continue;
        await supabase.from('price_item_locations' as any).delete().eq('item_id', id);
        r.locations.forEach(l => {
          const loc = locByName.get(l.name.toLowerCase());
          if (loc) linkRows.push({ item_id: id, location_id: loc.id, override_modifier_pct: l.override });
        });
      }
      for (let i = 0; i < linkRows.length; i += 500) {
        const { error } = await supabase.from('price_item_locations' as any).insert(linkRows.slice(i, i + 500));
        if (error) throw error;
      }

      setImportLog([
        `Nově přidáno: ${created}`,
        `Aktualizováno: ${updated}`,
        missing.size ? `Vytvořena nová sídla: ${missing.size}` : '',
        ...errors,
      ].filter(Boolean));
      toast.success('Import dokončen');
      await loadAll(activeWorldId);
    } catch (e: any) {
      toast.error(e.message || 'Import selhal');
      setImportLog(prev => [...prev, e.message || 'Import selhal']);
    }
    setImportBusy(false);
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

  const draftBase = Number(itemDraft.base_price_copper) || 0;
  const draftParts = copperToParts(draftBase);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Coins className="text-primary" />
        <h1 className="text-3xl font-display text-primary">Ceník</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        1 zl = 10 st = 100 md. Ceny se ukládají v měděných. Ceník vidí a upravují jen Editor a Admin.
      </p>

      {/* Economy */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg flex items-center gap-2"><TrendingUp size={18} className="text-primary" />Světová ekonomika</h2>
          <Button size="sm" variant="secondary" onClick={() => setEconOpen(true)}>
            <Settings2 size={14} className="mr-1" />Spravovat stavy
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs">Aktuální stav</Label>
            <Select value={activeStateCode} onValueChange={setActiveState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {states.map(s => (
                  <SelectItem key={s.id} value={s.code}>
                    {s.label} ({s.modifier_pct > 0 ? '+' : ''}{s.modifier_pct} %)
                  </SelectItem>
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

      {/* Locations */}
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Landmark size={18} className="text-primary" />Sídla
          <span className="text-sm text-muted-foreground font-sans">({locations.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setLocListOpen(true)}>
            <Eye size={14} className="mr-1" />Zobrazit / spravovat
          </Button>
          <Button size="sm" onClick={openNewLocation}><Plus size={14} className="mr-1" />Přidat sídlo</Button>
        </div>
      </Card>

      {/* Items */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Boxes size={18} className="text-primary" />Předměty a služby
            <span className="text-sm text-muted-foreground font-sans">({filteredItems.length})</span>
          </h2>
          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" variant="secondary" onClick={exportCsv}><Download size={14} className="mr-1" />Export CSV</Button>
            <Button size="sm" variant="secondary" onClick={() => { setImportLog([]); setImportOpen(true); }}>
              <Upload size={14} className="mr-1" />Import CSV
            </Button>
            <Button size="sm" onClick={openNewItem}><Plus size={14} className="mr-1" />Přidat položku</Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-8 text-sm" placeholder="Hledat předmět…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Sídlo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna sídla</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Načítám…</p> : pageItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné položky.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2">Název</th>
                    <th className="text-left">Kategorie</th>
                    <th className="text-left">Jednotka</th>
                    <th className="text-left">Základ</th>
                    <th className="text-left">Sídla</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(it => {
                    const linked = itemLocs.filter(il => il.item_id === it.id);
                    return (
                      <tr key={it.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 font-medium">{it.name}</td>
                        <td>{it.category}</td>
                        <td>{it.unit}</td>
                        <td className="whitespace-nowrap">{formatCopper(it.base_price_copper)}</td>
                        <td>
                          {linked.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPricesItem(it)}>
                              {linked.length} sídel — ceny
                            </Button>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => openEditItem(it)}><Pencil size={14} /></Button>
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

      {/* Locations list dialog */}
      <Dialog open={locListOpen} onOpenChange={setLocListOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sídla ({locations.length})</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-2">
            <Input className="h-8 text-sm" placeholder="Hledat sídlo…" value={locSearch} onChange={e => setLocSearch(e.target.value)} />
            <Button size="sm" onClick={openNewLocation}><Plus size={14} className="mr-1" />Přidat</Button>
          </div>
          {filteredLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádná sídla.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="text-left py-2">Název</th><th className="text-left">Typ</th><th className="text-left">Modifikátor</th><th className="text-left">Poznámka</th><th></th></tr>
              </thead>
              <tbody>
                {filteredLocations.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-medium">{l.name}</td>
                    <td>{LOCATION_LABELS[l.type]}</td>
                    <td className={l.price_modifier_pct > 0 ? 'text-destructive' : l.price_modifier_pct < 0 ? 'text-primary' : ''}>
                      {l.price_modifier_pct > 0 ? '+' : ''}{l.price_modifier_pct} %
                    </td>
                    <td className="text-muted-foreground text-xs">{l.note}</td>
                    <td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openEditLocation(l)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteLocation(l.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>

      {/* Prices per item dialog */}
      <Dialog open={!!pricesItem} onOpenChange={o => !o && setPricesItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ceny — {pricesItem?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-1">
            {pricesItem && itemLocs.filter(il => il.item_id === pricesItem.id).map(il => {
              const loc = locations.find(l => l.id === il.location_id);
              if (!loc) return null;
              const locMod = il.override_modifier_pct ?? loc.price_modifier_pct;
              const calc = computePrice({
                basePriceCopper: pricesItem.base_price_copper,
                locationModifierPct: locMod,
                economyModifierPct: econMod,
              });
              return (
                <Tooltip key={il.id}>
                  <TooltipTrigger asChild>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted cursor-help">
                      <strong>{loc.name}:</strong> {formatCopper(calc.final)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <div>Základ: {formatCopper(calc.base)}</div>
                    <div>Sídlo: {locMod > 0 ? '+' : ''}{locMod} %{il.override_modifier_pct != null && ' (přepis)'}</div>
                    <div>Ekonomika: {econMod > 0 ? '+' : ''}{econMod} %</div>
                    <div className="border-t mt-1 pt-1">Výsledek: <strong>{formatCopper(calc.final)}</strong></div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import předmětů z CSV</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Sloupce: <code>nazev, kategorie, jednotka, zl, st, md, poznamka, sidla</code>.
              Sídla se oddělují svislítkem, volitelný přepis modifikátoru za rovnítkem — např.
              <code> Praha=10|Brno</code>. Neexistující sídla se automaticky vytvoří.
              Položka se stejným názvem se aktualizuje.
            </p>
            <Button size="sm" variant="secondary" onClick={exportTemplate}><Download size={14} className="mr-1" />Stáhnout šablonu</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground" />
            {importLog.length > 0 && (
              <div className="text-xs bg-muted rounded p-2 space-y-0.5 max-h-40 overflow-y-auto">
                {importLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Zavřít</Button>
            <Button variant="destructive" disabled={importBusy} onClick={() => handleImport(true)}>Nahradit vše</Button>
            <Button disabled={importBusy} onClick={() => handleImport(false)}>{importBusy ? 'Importuji…' : 'Přidat / aktualizovat'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{locDraft.id ? 'Upravit sídlo' : 'Nové sídlo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Název</Label>
              <Input value={locDraft.name || ''} onChange={e => setLocDraft(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Typ</Label>
                <Select value={locDraft.type || 'village'} onValueChange={(v: LocType) => setLocDraft(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Modifikátor (%)</Label>
                <Input type="number" value={locDraft.price_modifier_pct ?? 0}
                  onChange={e => setLocDraft(p => ({ ...p, price_modifier_pct: Number(e.target.value) || 0 }))} />
              </div>
            </div>
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

      {/* Item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{itemDraft.id ? 'Upravit položku' : 'Nová položka'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Název</Label>
                <Input value={itemDraft.name || ''} onChange={e => setItemDraft(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Kategorie</Label>
                <Input value={itemDraft.category || ''} placeholder="např. Nápoje" onChange={e => setItemDraft(p => ({ ...p, category: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Jednotka</Label>
                <Input value={itemDraft.unit || ''} placeholder="např. kus, džbán" onChange={e => setItemDraft(p => ({ ...p, unit: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Základní cena</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" min={0} value={draftParts.zl}
                  onChange={e => setItemDraft(p => ({ ...p, base_price_copper: partsToCopper(Number(e.target.value) || 0, draftParts.st, draftParts.md) }))} />
                <span className="text-xs">zl</span>
                <Input type="number" min={0} max={9} value={draftParts.st}
                  onChange={e => setItemDraft(p => ({ ...p, base_price_copper: partsToCopper(draftParts.zl, Number(e.target.value) || 0, draftParts.md) }))} />
                <span className="text-xs">st</span>
                <Input type="number" min={0} max={9} value={draftParts.md}
                  onChange={e => setItemDraft(p => ({ ...p, base_price_copper: partsToCopper(draftParts.zl, draftParts.st, Number(e.target.value) || 0) }))} />
                <span className="text-xs">md</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">= {formatCopper(draftBase)} ({draftBase} md)</p>
            </div>

            <div>
              <Label className="text-xs">Poznámka</Label>
              <Textarea value={itemDraft.note || ''} onChange={e => setItemDraft(p => ({ ...p, note: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Prodává se v</Label>
              <div className="flex gap-2 items-center my-2">
                <Input className="h-8 text-xs" placeholder="Hledat sídlo…" value={itemLocSearch} onChange={e => setItemLocSearch(e.target.value)} />
                <Button size="sm" variant="secondary" onClick={() => toggleAllDraftLocations(true)}>Vybrat vše</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleAllDraftLocations(false)}>Zrušit</Button>
              </div>
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nejdřív přidej nějaké sídlo.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {filteredDraftLocations.map(l => {
                    const st = itemLocDraft[l.id] || { checked: false, override: '' };
                    const effectiveMod = st.override.trim() === '' ? l.price_modifier_pct : Number(st.override) || 0;
                    const calc = computePrice({
                      basePriceCopper: draftBase,
                      locationModifierPct: effectiveMod,
                      economyModifierPct: econMod,
                    });
                    return (
                      <div key={l.id} className="flex items-center gap-2 py-1 border-b border-border/50">
                        <Checkbox checked={st.checked}
                          onCheckedChange={(v) => setItemLocDraft(p => ({ ...p, [l.id]: { ...st, checked: !!v } }))} />
                        <span className="text-sm flex-1">
                          {l.name} <span className="text-xs text-muted-foreground">({LOCATION_LABELS[l.type]}, {l.price_modifier_pct > 0 ? '+' : ''}{l.price_modifier_pct} %)</span>
                        </span>
                        <Input type="number" className="w-24 h-8 text-xs" placeholder="přepis %"
                          disabled={!st.checked} value={st.override}
                          onChange={e => setItemLocDraft(p => ({ ...p, [l.id]: { ...st, override: e.target.value } }))} />
                        <span className="text-xs w-28 text-right">{st.checked ? formatCopper(calc.final) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemOpen(false)}>Zrušit</Button>
            <Button onClick={saveItem}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
