import { useEffect, useMemo, useState } from 'react';
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
import { Coins, Plus, Trash2, Pencil, Info, Landmark, Boxes, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  ECONOMY_LABELS, ECONOMY_PRESETS, LOCATION_LABELS,
  economyModifier, computePrice, copperToParts, partsToCopper, formatCopper,
} from '@/lib/pricing';

type LocType = 'city' | 'town' | 'village' | 'hamlet' | 'fortress' | 'market';
type EconState = keyof typeof ECONOMY_PRESETS;

interface Location { id: string; world_id: string; name: string; type: LocType; price_modifier_pct: number; note: string | null; }
interface Item { id: string; world_id: string; name: string; category: string | null; base_price_copper: number; unit: string | null; note: string | null; }
interface ItemLoc { id: string; item_id: string; location_id: string; override_modifier_pct: number | null; }
interface Economy { id?: string; world_id: string; state: EconState; custom_modifier_pct: number; }

export default function PricingPage() {
  const { activeWorldId } = useWorld();
  const { canEdit, loading: roleLoading } = useUserRole();

  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLocs, setItemLocs] = useState<ItemLoc[]>([]);
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [loading, setLoading] = useState(true);

  // location editor
  const [locOpen, setLocOpen] = useState(false);
  const [locDraft, setLocDraft] = useState<Partial<Location>>({});
  // item editor
  const [itemOpen, setItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<Partial<Item>>({});
  const [itemLocDraft, setItemLocDraft] = useState<Record<string, { checked: boolean; override: string }>>({});

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  const canEditPage = canEdit('pricing');

  async function loadAll(worldId: string) {
    setLoading(true);
    const [locRes, itmRes, econRes] = await Promise.all([
      supabase.from('price_locations' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('price_items' as any).select('*').eq('world_id', worldId).order('name'),
      supabase.from('world_economy' as any).select('*').eq('world_id', worldId).maybeSingle(),
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
    setEconomy((econRes.data as any) || { world_id: worldId, state: 'normal', custom_modifier_pct: 0 });
    setLoading(false);
  }

  useEffect(() => { if (activeWorldId) loadAll(activeWorldId); }, [activeWorldId]);

  const econMod = useMemo(() => economy ? economyModifier(economy.state, economy.custom_modifier_pct) : 0, [economy]);

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[], [items]);

  const filteredItems = useMemo(() => items.filter(i => {
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (filterLocation !== 'all') {
      const has = itemLocs.some(il => il.item_id === i.id && il.location_id === filterLocation);
      if (!has) return false;
    }
    return true;
  }), [items, itemLocs, filterCategory, filterLocation]);

  // ---------------- Economy ----------------
  async function saveEconomy(patch: Partial<Economy>) {
    if (!activeWorldId || !economy) return;
    const next = { ...economy, ...patch, world_id: activeWorldId };
    setEconomy(next);
    const { error } = await supabase.from('world_economy' as any).upsert({
      world_id: activeWorldId,
      state: next.state,
      custom_modifier_pct: next.custom_modifier_pct,
    }, { onConflict: 'world_id' });
    if (error) toast.error(error.message);
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
    let error;
    if (locDraft.id) {
      ({ error } = await supabase.from('price_locations' as any).update(payload).eq('id', locDraft.id));
    } else {
      ({ error } = await supabase.from('price_locations' as any).insert(payload));
    }
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
    setItemLocDraft(map);
    setItemOpen(true);
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
    setItemLocDraft(map);
    setItemOpen(true);
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

    // Reset item_locations for this item, then insert new ones
    await supabase.from('price_item_locations' as any).delete().eq('item_id', itemId);
    const rows = Object.entries(itemLocDraft)
      .filter(([, v]) => v.checked)
      .map(([location_id, v]) => ({
        item_id: itemId,
        location_id,
        override_modifier_pct: v.override.trim() === '' ? null : Number(v.override),
      }));
    if (rows.length) {
      const { error: ilErr } = await supabase.from('price_item_locations' as any).insert(rows);
      if (ilErr) { toast.error(ilErr.message); return; }
    }
    setItemOpen(false);
    if (activeWorldId) await loadAll(activeWorldId);
  }
  async function deleteItem(id: string) {
    if (!confirm('Smazat položku?')) return;
    const { error } = await supabase.from('price_items' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (activeWorldId) await loadAll(activeWorldId);
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

  // ---------------- Render helpers ----------------
  const priceParts = (copper: number) => copperToParts(copper);
  const draftBase = Number(itemDraft.base_price_copper) || 0;
  const draftParts = copperToParts(draftBase);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Coins className="text-primary" />
        <h1 className="text-3xl font-display text-primary">Ceník</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        1 zl = 10 st = 100 md. Ceny se ukládají v měděných.
        Ceník vidí a upravují jen Editor a Admin — hráči k němu nemají přístup.
      </p>

      {/* Economy */}
      <Card className="p-4 space-y-3">
        <h2 className="font-display text-lg flex items-center gap-2"><TrendingUp size={18} className="text-primary" />Světová ekonomika</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Stav</Label>
            <Select value={economy?.state || 'normal'} onValueChange={(v: EconState) => saveEconomy({ state: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(ECONOMY_PRESETS).map(k => (
                  <SelectItem key={k} value={k}>
                    {ECONOMY_LABELS[k]} {k !== 'custom' && `(${ECONOMY_PRESETS[k] > 0 ? '+' : ''}${ECONOMY_PRESETS[k]} %)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {economy?.state === 'custom' && (
            <div>
              <Label className="text-xs">Vlastní modifikátor (%)</Label>
              <Input type="number" value={economy.custom_modifier_pct}
                onChange={e => saveEconomy({ custom_modifier_pct: Number(e.target.value) || 0 })} />
            </div>
          )}
          <div className="flex items-end">
            <div className="text-sm">
              Aktuální modifikátor: <strong className={econMod === 0 ? '' : econMod > 0 ? 'text-destructive' : 'text-primary'}>
                {econMod > 0 ? '+' : ''}{econMod} %
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Locations */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg flex items-center gap-2"><Landmark size={18} className="text-primary" />Sídla</h2>
          <Button size="sm" onClick={openNewLocation}><Plus size={14} className="mr-1" />Přidat sídlo</Button>
        </div>
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádná sídla. Přidej města, vesnice, pevnosti nebo trhy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="text-left py-2">Název</th><th className="text-left">Typ</th><th className="text-left">Modifikátor</th><th className="text-left">Poznámka</th><th></th></tr>
              </thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-medium">{l.name}</td>
                    <td>{LOCATION_LABELS[l.type]}</td>
                    <td className={l.price_modifier_pct > 0 ? 'text-destructive' : l.price_modifier_pct < 0 ? 'text-primary' : ''}>
                      {l.price_modifier_pct > 0 ? '+' : ''}{l.price_modifier_pct} %
                    </td>
                    <td className="text-muted-foreground text-xs">{l.note}</td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEditLocation(l)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteLocation(l.id)}><Trash2 size={14} className="text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Items */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg flex items-center gap-2"><Boxes size={18} className="text-primary" />Předměty a služby</h2>
          <div className="flex gap-2 items-center">
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
            <Button size="sm" onClick={openNewItem}><Plus size={14} className="mr-1" />Přidat položku</Button>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Načítám…</p> : filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné položky.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Název</th>
                  <th className="text-left">Kategorie</th>
                  <th className="text-left">Jednotka</th>
                  <th className="text-left">Základ</th>
                  <th className="text-left">Ceny podle sídel</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => {
                  const linked = itemLocs.filter(il => il.item_id === it.id);
                  return (
                    <tr key={it.id} className="border-b hover:bg-muted/30 align-top">
                      <td className="py-2 font-medium">{it.name}</td>
                      <td>{it.category}</td>
                      <td>{it.unit}</td>
                      <td className="whitespace-nowrap">{formatCopper(it.base_price_copper)}</td>
                      <td>
                        {linked.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {linked.map(il => {
                              const loc = locations.find(l => l.id === il.location_id);
                              if (!loc) return null;
                              const locMod = il.override_modifier_pct ?? loc.price_modifier_pct;
                              const calc = computePrice({
                                basePriceCopper: it.base_price_copper,
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
        )}
      </Card>

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
              <Label className="text-xs flex items-center gap-1">
                Prodává se v <Info size={12} className="text-muted-foreground" />
              </Label>
              <p className="text-[11px] text-muted-foreground mb-2">Přepis % je volitelný — když ho vyplníš, přebije výchozí modifikátor sídla pro tuto položku.</p>
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nejdřív přidej nějaké sídlo.</p>
              ) : (
                <div className="space-y-1">
                  {locations.map(l => {
                    const st = itemLocDraft[l.id] || { checked: false, override: '' };
                    const effectiveMod = st.override.trim() === '' ? l.price_modifier_pct : Number(st.override) || 0;
                    const calc = computePrice({
                      basePriceCopper: draftBase,
                      locationModifierPct: effectiveMod,
                      economyModifierPct: econMod,
                    });
                    return (
                      <div key={l.id} className="flex items-center gap-2 py-1 border-b border-border/50">
                        <Checkbox
                          checked={st.checked}
                          onCheckedChange={(v) => setItemLocDraft(p => ({ ...p, [l.id]: { ...st, checked: !!v } }))}
                        />
                        <span className="text-sm flex-1">
                          {l.name} <span className="text-xs text-muted-foreground">({LOCATION_LABELS[l.type]}, {l.price_modifier_pct > 0 ? '+' : ''}{l.price_modifier_pct} %)</span>
                        </span>
                        <Input
                          type="number"
                          className="w-24 h-8 text-xs"
                          placeholder="přepis %"
                          disabled={!st.checked}
                          value={st.override}
                          onChange={e => setItemLocDraft(p => ({ ...p, [l.id]: { ...st, override: e.target.value } }))}
                        />
                        <span className="text-xs w-28 text-right">
                          {st.checked ? formatCopper(calc.final) : '—'}
                        </span>
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
