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
import {
  Coins, Plus, Trash2, Pencil, Landmark, Boxes, TrendingUp, Search, Upload, Download, Eye,
  Settings2, Tags, FileSpreadsheet, FileArchive, Layers, ListTree,
} from 'lucide-react';
import { toast } from 'sonner';
import { ECONOMY_PRESETS, ECONOMY_LABELS, computePrice, formatCopper, effectiveLocationPct } from '@/lib/pricing';
import {
  slugify, downloadXlsx, downloadZip, downloadCsv, PricingExportData,
  itemRows, settlementRows, settlementTagRows, exceptionRows, profileRows, profileRuleRows, typeRows,
} from '@/lib/pricingIO';
import {
  AVAILABILITY_LABELS, AVAILABILITY_MODES, type AvailabilityMode,
  buildTagIndex, itemSettlements, resolveItemProfile,
} from '@/lib/availability';
import SettlementsManagerDialog from '@/components/pricing/SettlementsManagerDialog';
import SettlementTypesDialog from '@/components/pricing/SettlementTypesDialog';
import SettlementPickerDialog from '@/components/pricing/SettlementPickerDialog';
import ItemEditorDialog from '@/components/pricing/ItemEditorDialog';
import PricingImportDialog from '@/components/pricing/PricingImportDialog';
import TagsManagerDialog from '@/components/pricing/TagsManagerDialog';
import ProfilesDialog from '@/components/pricing/ProfilesDialog';
import CategoriesDialog from '@/components/pricing/CategoriesDialog';
import type {
  PriceItem, PriceLocation, PriceLocationType, PriceItemLocation,
  SettlementTag, SettlementTagLink, AvailabilityProfile, PriceCategory, ItemException,
} from '@/components/pricing/types';

interface EconState { id: string; world_id: string; code: string; label: string; modifier_pct: number; sort_order: number; }

const PAGE_SIZE = 25;
const NONE = '__none__';

async function fetchAllRows(table: string, worldId: string, cols = '*') {
  const out: any[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase.from(table as any).select(cols).eq('world_id', worldId).range(from, from + step - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

export default function PricingPage() {
  const { activeWorldId } = useWorld();
  const { canEdit, loading: roleLoading } = useUserRole();

  const [locations, setLocations] = useState<PriceLocation[]>([]);
  const [types, setTypes] = useState<PriceLocationType[]>([]);
  const [states, setStates] = useState<EconState[]>([]);
  const [activeStateCode, setActiveStateCode] = useState('normal');
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [profiles, setProfiles] = useState<AvailabilityProfile[]>([]);
  const [tags, setTags] = useState<SettlementTag[]>([]);
  const [tagLinks, setTagLinks] = useState<SettlementTagLink[]>([]);

  const [items, setItems] = useState<PriceItem[]>([]);
  const [itemLocs, setItemLocs] = useState<PriceItemLocation[]>([]);
  const [exceptions, setExceptions] = useState<ItemException[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [priceLocId, setPriceLocId] = useState(NONE);
  const [locSearch, setLocSearch] = useState('');


  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allFiltered, setAllFiltered] = useState(false);
  const [bulkProfile, setBulkProfile] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkExAction, setBulkExAction] = useState<'ALLOW' | 'DENY' | 'REMOVE'>('DENY');
  const [bulkExOpen, setBulkExOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [econOpen, setEconOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [locListOpen, setLocListOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [locDraft, setLocDraft] = useState<Partial<PriceLocation>>({});
  const [locDraftTags, setLocDraftTags] = useState<string[]>([]);
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
  const priceLoc = useMemo(() => locations.find(l => l.id === priceLocId) || null, [locations, priceLocId]);
  const tagIdx = useMemo(() => buildTagIndex(tagLinks, tags), [tagLinks, tags]);

  const tagUsage = useMemo(() => {
    const u: Record<string, number> = {};
    tagLinks.forEach(l => { u[l.tag_id] = (u[l.tag_id] || 0) + 1; });
    return u;
  }, [tagLinks]);
  const profileUsage = useMemo(() => {
    const u: Record<string, number> = {};
    categories.forEach(c => { if (c.default_profile_id) u[c.default_profile_id] = (u[c.default_profile_id] || 0) + 1; });
    return u;
  }, [categories]);

  // ---------- base data ----------
  async function loadBase(worldId: string) {
    const [locRes, typeRes, econRes, stRes, catRes, profRes, tagRes, tagMapRes] = await Promise.all([
      supabase.from('price_locations' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_location_types' as any).select('*').eq('world_id', worldId).order('sort_order'),
      supabase.from('world_economy' as any).select('*').eq('world_id', worldId).maybeSingle(),
      supabase.from('world_economy_states' as any).select('*').eq('world_id', worldId).order('sort_order'),
      supabase.from('price_categories' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_availability_profiles' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_settlement_tags' as any).select('*').eq('world_id', worldId).order('label'),
      supabase.from('price_settlement_tag_map' as any).select('*').eq('world_id', worldId),
    ]);
    setLocations(((locRes.data as any) || []) as PriceLocation[]);
    setCategories(((catRes.data as any) || []) as PriceCategory[]);
    setProfiles(((profRes.data as any) || []) as AvailabilityProfile[]);
    setTags(((tagRes.data as any) || []) as SettlementTag[]);
    setTagLinks(((tagMapRes.data as any) || []) as SettlementTagLink[]);

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
  }

  // ---------- server-side paged items ----------
  async function loadItems(worldId: string) {
    setLoading(true);
    let q = supabase.from('price_items' as any).select('*', { count: 'exact' }).eq('world_id', worldId);
    if (debouncedSearch.trim()) q = q.or(`name.ilike.%${debouncedSearch.trim()}%,code.ilike.%${debouncedSearch.trim()}%`);
    if (filterCategory !== 'all') q = q.eq('category_id', filterCategory);
    if (filterMode !== 'all') q = q.eq('availability_mode', filterMode);
    const { data, count, error } = await q.order('name').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = ((data as any) || []) as PriceItem[];
    setItems(rows);
    setTotal(count || 0);
    if (rows.length) {
      const ids = rows.map(r => r.id);
      const [links, exs] = await Promise.all([
        supabase.from('price_item_locations' as any).select('*').in('item_id', ids),
        supabase.from('price_item_exceptions' as any).select('*').in('item_id', ids),
      ]);
      setItemLocs(((links.data as any) || []) as PriceItemLocation[]);
      setExceptions(((exs.data as any) || []) as ItemException[]);
    } else { setItemLocs([]); setExceptions([]); }
    setLoading(false);
  }

  useEffect(() => { if (activeWorldId) loadBase(activeWorldId); }, [activeWorldId]);
  useEffect(() => { if (activeWorldId) loadItems(activeWorldId); }, [activeWorldId, page, debouncedSearch, filterCategory, filterMode]);
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [filterCategory, filterMode]);
  useEffect(() => { setSelectedIds([]); setAllFiltered(false); }, [page, debouncedSearch, filterCategory, filterMode]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selCount = allFiltered ? total : selectedIds.length;

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
    setLocDraft({ name: '', code: '', type_code: types[0]?.code || 'village', uses_type_default: true, price_modifier_pct: 0, note: '', size: null, wealth: null, region: '' });
    setLocDraftTags([]);
    setLocOpen(true);
  }
  function openEditLocation(l: PriceLocation) {
    setLocDraft(l);
    setLocDraftTags(tagLinks.filter(t => t.location_id === l.id).map(t => t.tag_id));
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
      size: locDraft.size ?? null,
      wealth: locDraft.wealth ?? null,
      region: locDraft.region || null,
    };
    let id = locDraft.id;
    if (id) {
      const { error } = await supabase.from('price_locations' as any).update(payload).eq('id', id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from('price_locations' as any).insert(payload).select('id').single();
      if (error) { toast.error(error.message); return; }
      id = (data as any).id;
    }
    await supabase.from('price_settlement_tag_map' as any).delete().eq('location_id', id);
    if (locDraftTags.length) {
      const { error } = await supabase.from('price_settlement_tag_map' as any)
        .insert(locDraftTags.map(tag_id => ({ world_id: activeWorldId, location_id: id, tag_id })));
      if (error) toast.error(error.message);
    }
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

  // ---------- bulk item operations (server-side) ----------
  function bulkArgs() {
    return {
      _world_id: activeWorldId,
      _ids: allFiltered ? null : selectedIds,
      _search: allFiltered ? debouncedSearch : null,
      _category_id: allFiltered && filterCategory !== 'all' ? filterCategory : null,
      _mode_filter: allFiltered && filterMode !== 'all' ? filterMode : null,
    };
  }
  async function runBulk(patch: Record<string, any>, question: string) {
    if (!selCount) return;
    if (!confirm(question)) return;
    setBulkBusy(true);
    const { data, error } = await supabase.rpc('price_bulk_update_items' as any, { ...bulkArgs(), _patch: patch } as any);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Upraveno ${data} položek.`);
    setSelectedIds([]); setAllFiltered(false);
    if (activeWorldId) { await loadBase(activeWorldId); await loadItems(activeWorldId); }
  }
  async function runBulkExceptions(locationIds: string[]) {
    if (!selCount || !locationIds.length) return;
    setBulkBusy(true);
    const { data, error } = await supabase.rpc('price_bulk_item_exceptions' as any, {
      ...bulkArgs(), _location_ids: locationIds, _action: bulkExAction,
    } as any);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Zpracováno ${data} výjimek.`);
    setSelectedIds([]); setAllFiltered(false);
    if (activeWorldId) await loadItems(activeWorldId);
  }

  // ---------- export ----------
  async function collectExport(): Promise<PricingExportData> {
    const worldId = activeWorldId!;
    const [all, exs, tagRows2] = await Promise.all([
      fetchAllRows('price_items', worldId),
      fetchAllRows('price_item_exceptions', worldId),
      fetchAllRows('price_settlement_tag_map', worldId),
    ]);
    const locCodeById = new Map(locations.map(l => [l.id, l.code || slugify(l.name)]));
    const catById = new Map(categories.map(c => [c.id, c]));
    const profById = new Map(profiles.map(p => [p.id, p]));
    const tagById = new Map(tags.map(t => [t.id, t]));

    return {
      types: types.map(t => ({ code: t.code, label: t.label, default_modifier_pct: t.default_modifier_pct })),
      settlements: locations.map(l => ({
        code: l.code || slugify(l.name),
        name: l.name,
        type_code: l.type_code || l.type,
        type_label: typesByCode[l.type_code || l.type]?.label || l.type_code || l.type,
        size: l.size, wealth: l.wealth, region: l.region,
        price_modifier_pct: l.price_modifier_pct,
        uses_type_default: !!l.uses_type_default,
        effective_pct: effectiveLocationPct(l, typesByCode),
      })),
      settlementTags: tagRows2
        .map(r => ({ settlement_code: locCodeById.get(r.location_id) || '', tag: tagById.get(r.tag_id)?.label || '' }))
        .filter(r => r.settlement_code && r.tag),
      items: (all as PriceItem[]).map(it => {
        const cat = it.category_id ? catById.get(it.category_id) : undefined;
        const parent = cat?.parent_id ? catById.get(cat.parent_id) : undefined;
        return {
          code: it.code || slugify(it.name),
          name: it.name,
          category: parent ? parent.name : (cat?.name || it.category || ''),
          subcategory: parent ? (cat?.name || '') : '',
          unit: it.unit || '',
          base_price_copper: it.base_price_copper,
          availability_mode: (it.availability_mode as AvailabilityMode) || 'INHERIT',
          profile_code: it.availability_profile_id ? (profById.get(it.availability_profile_id)?.code || '') : '',
        };
      }),
      exceptions: (exs as ItemException[])
        .map(e => ({
          item_code: (all as PriceItem[]).find(i => i.id === e.item_id)?.code || '',
          settlement_code: locCodeById.get(e.location_id) || '',
          action: e.action,
        }))
        .filter(e => e.item_code && e.settlement_code),
      profiles: profiles.map(p => ({ code: p.code, name: p.name, note: p.note || '', rules: p.rules })),
    };
  }
  async function doExport(kind: 'xlsx' | 'zip' | 'items' | 'settlements' | 'tags' | 'exceptions' | 'profiles') {
    if (!activeWorldId) return;
    setExportBusy(true);
    try {
      const data = await collectExport();
      if (kind === 'xlsx') downloadXlsx(data);
      else if (kind === 'zip') await downloadZip(data);
      else if (kind === 'items') downloadCsv(itemRows(data), 'ITEMS.csv');
      else if (kind === 'settlements') downloadCsv(settlementRows(data), 'SETTLEMENTS.csv');
      else if (kind === 'tags') downloadCsv(settlementTagRows(data), 'SETTLEMENT_TAGS.csv');
      else if (kind === 'exceptions') downloadCsv(exceptionRows(data), 'ITEM_EXCEPTIONS.csv');
      else downloadCsv([...profileRows(data), ...profileRuleRows(data)], 'AVAILABILITY_PROFILES.csv');
      void typeRows;
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

  const availCtx = { exceptions, itemLocations: itemLocs, categories, profiles, tagIdx };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Coins className="text-primary" />
        <h1 className="text-3xl font-display text-primary">Ceník</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        1 zl = 10 st = 100 md. Ceny se počítají a ukládají v měděných. Dostupnost řeší profily, tagy sídel a výjimky — nezávisle na cenových modifikátorech.
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
          <span className="text-sm text-muted-foreground font-sans">({locations.length}) · {tags.length} tagů</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setTypesOpen(true)}><Tags size={14} className="mr-1" />Typy sídel</Button>
          <Button size="sm" variant="secondary" onClick={() => setTagsOpen(true)}><Tags size={14} className="mr-1" />Tagy sídel</Button>
          <Button size="sm" variant="secondary" onClick={() => setLocListOpen(true)}><Eye size={14} className="mr-1" />Spravovat sídla</Button>
          <Button size="sm" onClick={openNewLocation}><Plus size={14} className="mr-1" />Přidat sídlo</Button>
        </div>
      </Card>

      {/* Availability system */}
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Layers size={18} className="text-primary" />Dostupnost
          <span className="text-sm text-muted-foreground font-sans">({profiles.length} profilů, {categories.length} kategorií)</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setProfilesOpen(true)}><Layers size={14} className="mr-1" />Profily dostupnosti</Button>
          <Button size="sm" variant="secondary" onClick={() => setCatsOpen(true)}><ListTree size={14} className="mr-1" />Kategorie</Button>
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
              <Download size={14} className="mr-1" />ITEMS.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('exceptions')}>
              <Download size={14} className="mr-1" />ITEM_EXCEPTIONS.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('settlements')}>
              <Download size={14} className="mr-1" />SETTLEMENTS.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('tags')}>
              <Download size={14} className="mr-1" />SETTLEMENT_TAGS.csv
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => doExport('profiles')}>
              <Download size={14} className="mr-1" />PROFILES.csv
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
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Dostupnost" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny režimy</SelectItem>
              {AVAILABILITY_MODES.map(m => <SelectItem key={m} value={m}>{AVAILABILITY_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priceLocId} onValueChange={setPriceLocId}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Cena v sídle" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <div className="p-1 sticky top-0 bg-popover z-10">
                <Input className="h-7 text-xs" placeholder="Hledat sídlo…" value={locSearch}
                  onChange={e => setLocSearch(e.target.value)} onKeyDown={e => e.stopPropagation()} />
              </div>
              <SelectItem value={NONE}>Bez sloupce ceny</SelectItem>
              {locations
                .filter(l => l.name.toLowerCase().includes(locSearch.trim().toLowerCase()))
                .slice(0, 300)
                .map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>


        <div className="flex gap-2 items-center text-xs flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => { setAllFiltered(false); setSelectedIds(items.map(i => i.id)); }}>Vybrat stránku</Button>
          <Button size="sm" variant="secondary" onClick={() => { setAllFiltered(true); setSelectedIds([]); }}>Vybrat všechny filtrované ({total})</Button>
          <Button size="sm" variant="ghost" onClick={() => { setSelectedIds([]); setAllFiltered(false); }}>Zrušit výběr</Button>
          <span className="text-muted-foreground ml-auto">Vybráno: <strong>{selCount}</strong></span>
        </div>

        {selCount > 0 && (
          <div className="border rounded p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-medium">Hromadné akce pro {selCount} položek</p>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={bulkProfile} onValueChange={setBulkProfile}>
                <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Profil dostupnosti" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkProfile || bulkBusy}
                onClick={() => runBulk({ availability_mode: 'PROFILE', availability_profile_id: bulkProfile },
                  `Nastavit profil u ${selCount} položek?`)}>Nastavit profil</Button>
              <Button size="sm" variant="secondary" disabled={bulkBusy}
                onClick={() => runBulk({ availability_mode: 'INHERIT', availability_profile_id: '' },
                  `Nastavit „zdědit z kategorie" u ${selCount} položek?`)}>Zdědit z kategorie</Button>
              <Button size="sm" variant="secondary" disabled={bulkBusy}
                onClick={() => runBulk({ availability_mode: 'EVERYWHERE' }, `Nastavit „dostupné všude" u ${selCount} položek?`)}>Dostupné všude</Button>
              <Button size="sm" variant="secondary" disabled={bulkBusy}
                onClick={() => runBulk({ availability_mode: 'NOWHERE' }, `Nastavit „nedostupné nikde" u ${selCount} položek?`)}>Nedostupné nikde</Button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkCategory || bulkBusy}
                onClick={() => {
                  const c = categories.find(x => x.id === bulkCategory);
                  runBulk({ category_id: bulkCategory, category: c?.name || '' }, `Přesunout ${selCount} položek do kategorie „${c?.name}"?`);
                }}>Změnit kategorii</Button>
              <Select value={bulkExAction} onValueChange={(v: any) => setBulkExAction(v)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALLOW">Výjimka: Povolit</SelectItem>
                  <SelectItem value="DENY">Výjimka: Zakázat</SelectItem>
                  <SelectItem value="REMOVE">Výjimku odebrat</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => setBulkExOpen(true)}>Vybrat sídla a použít</Button>
            </div>
          </div>
        )}

        {loading ? <p className="text-sm text-muted-foreground">Načítám…</p> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné položky.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-8"></th>
                    <th className="text-left py-2">Název</th>
                    <th className="text-left">Kategorie</th>
                    <th className="text-left">Jednotka</th>
                    <th className="text-left">Základ / ks</th>
                    {priceLoc && <th className="text-left">Cena v „{priceLoc.name}"</th>}
                    <th className="text-left">Dostupnost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const avail = itemSettlements(it, locations, availCtx);
                    const res = resolveItemProfile(it, categories, profiles);
                    const cat = categories.find(c => c.id === it.category_id);
                    const here = priceLoc
                      ? {
                          ok: avail.some(a => a.loc.id === priceLoc.id),
                          calc: computePrice({
                            basePriceCopper: it.base_price_copper,
                            locationModifierPct: effectiveLocationPct(priceLoc, typesByCode),
                            economyModifierPct: econMod,
                          }),
                        }
                      : null;
                    return (
                      <tr key={it.id} className="border-b hover:bg-muted/30">
                        <td>
                          <Checkbox checked={allFiltered || selectedIds.includes(it.id)}
                            onCheckedChange={v => {
                              setAllFiltered(false);
                              setSelectedIds(prev => v ? Array.from(new Set([...prev, it.id])) : prev.filter(x => x !== it.id));
                            }} />
                        </td>
                        <td className="py-2 font-medium">{it.name}</td>
                        <td>{cat?.name || it.category}</td>
                        <td>{it.unit}</td>
                        <td className="whitespace-nowrap">{formatCopper(it.base_price_copper)}</td>
                        {here && (
                          <td className="whitespace-nowrap">
                            {here.ok ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium text-primary cursor-help">{formatCopper(here.calc.final)}</span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  <div>Základ: {formatCopper(here.calc.base)}</div>
                                  <div>Sídlo: {effectiveLocationPct(priceLoc!, typesByCode)} %</div>
                                  <div>Ekonomika: {econMod} %</div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">nedostupné</span>
                            )}
                          </td>
                        )}
                        <td className="text-xs">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPricesItem(it)}>
                            {avail.length} / {locations.length} sídel
                            {res.profile ? ` · ${res.profile.name}` : ''}
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

      <TagsManagerDialog
        open={tagsOpen} onOpenChange={setTagsOpen}
        worldId={activeWorldId} tags={tags} usage={tagUsage}
        onReload={() => loadBase(activeWorldId)}
      />

      <ProfilesDialog
        open={profilesOpen} onOpenChange={setProfilesOpen}
        worldId={activeWorldId} profiles={profiles} types={types} tags={tags}
        locations={locations} tagIdx={tagIdx} usage={profileUsage}
        onReload={() => loadBase(activeWorldId)}
      />

      <CategoriesDialog
        open={catsOpen} onOpenChange={setCatsOpen}
        worldId={activeWorldId} categories={categories} profiles={profiles}
        onReload={() => loadBase(activeWorldId)}
      />

      <SettlementsManagerDialog
        open={locListOpen} onOpenChange={setLocListOpen}
        worldId={activeWorldId} locations={locations} types={types} tags={tags} tagIdx={tagIdx}
        onEdit={openEditLocation}
        onAdd={openNewLocation}
        onDelete={deleteLocation}
        onReload={() => loadBase(activeWorldId)}
      />

      <ItemEditorDialog
        open={itemOpen} onOpenChange={setItemOpen}
        worldId={activeWorldId} item={editItem} locations={locations} types={types}
        categories={categories} profiles={profiles} tagIdx={tagIdx} econMod={econMod}
        onSaved={async () => { await loadBase(activeWorldId); await loadItems(activeWorldId); }}
      />

      <PricingImportDialog
        open={importOpen} onOpenChange={setImportOpen} worldId={activeWorldId}
        onDone={async () => { await loadBase(activeWorldId); await loadItems(activeWorldId); }}
      />

      <SettlementPickerDialog
        open={bulkExOpen} onOpenChange={setBulkExOpen}
        title="Sídla pro hromadnou výjimku"
        locations={locations} types={types} selected={[]}
        onChange={ids => runBulkExceptions(ids)}
      />

      {/* Prices / availability per item dialog */}
      <Dialog open={!!pricesItem} onOpenChange={o => !o && setPricesItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ceny a dostupnost — {pricesItem?.name}</DialogTitle></DialogHeader>
          {pricesItem && (() => {
            const res = resolveItemProfile(pricesItem, categories, profiles);
            const avail = itemSettlements(pricesItem, locations, availCtx);
            return (
              <>
                <p className="text-xs text-muted-foreground">
                  Režim: {AVAILABILITY_LABELS[pricesItem.availability_mode] || pricesItem.availability_mode}
                  {res.profile ? ` · Profil „${res.profile.name}" (${res.source})` : ''}
                  {' · '}{avail.length} / {locations.length} sídel
                </p>
                <div className="flex flex-wrap gap-1">
                  {avail.slice(0, 400).map(({ loc, source }) => {
                    const locMod = effectiveLocationPct(loc, typesByCode);
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
                          <div>Sídlo: {locMod > 0 ? '+' : ''}{locMod} %{loc.uses_type_default ? ' (výchozí hodnota typu)' : ' (vlastní hodnota sídla)'}</div>
                          <div>Ekonomika: {econMod > 0 ? '+' : ''}{econMod} %</div>
                          <div className="border-t mt-1 pt-1">Výsledek: <strong>{formatCopper(calc.final)}</strong></div>
                          <div className="border-t mt-1 pt-1">Dostupnost: ANO — {source}</div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {avail.length === 0 && <p className="text-sm text-muted-foreground">Položka není nikde dostupná.</p>}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Velikost (1–5)</Label>
                <Input type="number" min={1} max={5} value={locDraft.size ?? ''}
                  onChange={e => setLocDraft(p => ({ ...p, size: e.target.value === '' ? null : Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Bohatství (1–5)</Label>
                <Input type="number" min={1} max={5} value={locDraft.wealth ?? ''}
                  onChange={e => setLocDraft(p => ({ ...p, wealth: e.target.value === '' ? null : Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Region</Label>
                <Input value={locDraft.region || ''} onChange={e => setLocDraft(p => ({ ...p, region: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tagy</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.length === 0 && <span className="text-xs text-muted-foreground">Zatím žádné tagy — vytvoř je v „Tagy sídel".</span>}
                {tags.map(t => {
                  const on = locDraftTags.includes(t.id);
                  return (
                    <button key={t.id} type="button"
                      onClick={() => setLocDraftTags(prev => on ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:bg-muted/70'
                      }`}>{t.label}</button>
                  );
                })}
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

      {void NONE}
    </div>
  );
}
