import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { parseImportFile, validateImport, ValidationResult, downloadXlsx, slugify } from '@/lib/pricingIO';

type Mode = 'upsert' | 'insert';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  onDone: () => Promise<void> | void;
}

async function fetchAll(table: string, worldId: string, cols = 'id, code, name') {
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

export default function PricingImportDialog({ open, onOpenChange, worldId, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('upsert');
  const [preview, setPreview] = useState<null | { v: ValidationResult; newItems: number; updItems: number; newLocs: number; updLocs: number; newTags: number; newProfiles: number }>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function analyse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Vyber soubor (.xlsx, .csv nebo .zip)'); return; }
    setBusy(true); setLog([]);
    try {
      const sheets = await parseImportFile(file);
      const [items, locs, types, tags, profs] = await Promise.all([
        fetchAll('price_items', worldId),
        fetchAll('price_locations', worldId),
        fetchAll('price_location_types', worldId, 'id, code, label'),
        fetchAll('price_settlement_tags', worldId, 'id, code, label'),
        fetchAll('price_availability_profiles', worldId, 'id, code, name'),
      ]);
      const known = {
        itemCodes: new Set<string>(items.map(i => i.code).filter(Boolean)),
        settlementCodes: new Set<string>(locs.map(l => l.code).filter(Boolean)),
        typeCodes: new Set<string>(types.map(t => t.code)),
        tagCodes: new Set<string>(tags.map(t => t.code)),
        profileCodes: new Set<string>(profs.map(p => p.code)),
      };
      const v = validateImport(sheets, known);
      setPreview({
        v,
        newItems: v.items.filter(i => !known.itemCodes.has(i.code)).length,
        updItems: v.items.filter(i => known.itemCodes.has(i.code)).length,
        newLocs: v.settlements.filter(s => !known.settlementCodes.has(s.code)).length,
        updLocs: v.settlements.filter(s => known.settlementCodes.has(s.code)).length,
        newTags: v.tags.filter(t => !known.tagCodes.has(t.code)).length,
        newProfiles: v.profiles.filter(p => !known.profileCodes.has(p.code)).length,
      });
    } catch (e: any) {
      toast.error(e.message || 'Soubor se nepodařilo načíst');
    }
    setBusy(false);
  }

  async function run() {
    if (!preview) return;
    setBusy(true);
    const messages: string[] = [];
    try {
      const v = preview.v;

      if (v.types.length) {
        const { error } = await supabase.from('price_location_types' as any).upsert(
          v.types.map((t, i) => ({ world_id: worldId, code: t.code, label: t.label, default_modifier_pct: t.default_modifier_pct, sort_order: i })),
          { onConflict: 'world_id,code' });
        if (error) throw error;
        messages.push(`Typy sídel: ${v.types.length}`);
      }

      if (v.tags.length) {
        const { error } = await supabase.from('price_settlement_tags' as any).upsert(
          v.tags.map((t, i) => ({ world_id: worldId, code: t.code, label: t.label, sort_order: i })),
          { onConflict: 'world_id,code' });
        if (error) throw error;
        messages.push(`Tagy: ${v.tags.length}`);
      }

      if (v.profiles.length) {
        const { error } = await supabase.from('price_availability_profiles' as any).upsert(
          v.profiles.map(p => ({ world_id: worldId, code: p.code, name: p.name, note: p.note, rules: p.rules as any })),
          { onConflict: 'world_id,code' });
        if (error) throw error;
        messages.push(`Profily: ${v.profiles.length}`);
      }

      const existingLocs = await fetchAll('price_locations', worldId);
      const locCodes = new Set(existingLocs.map(l => l.code));
      const locsToWrite = mode === 'insert' ? v.settlements.filter(s => !locCodes.has(s.code)) : v.settlements;
      for (let i = 0; i < locsToWrite.length; i += 300) {
        const { error } = await supabase.from('price_locations' as any).upsert(
          locsToWrite.slice(i, i + 300).map(s => ({
            world_id: worldId, code: s.code, name: s.name, type: s.type_code, type_code: s.type_code,
            price_modifier_pct: s.price_modifier_pct, uses_type_default: s.uses_type_default,
            size: s.size, wealth: s.wealth, region: s.region,
          })), { onConflict: 'world_id,code' });
        if (error) throw error;
      }
      if (locsToWrite.length) messages.push(`Sídla: ${locsToWrite.length}`);

      // categories from item text
      const catNames = Array.from(new Set(v.items.flatMap(i => [i.category, i.subcategory]).filter(Boolean) as string[]));
      if (catNames.length) {
        const { error } = await supabase.from('price_categories' as any).upsert(
          catNames.map((n, i) => ({ world_id: worldId, code: slugify(n), name: n, sort_order: i })),
          { onConflict: 'world_id,code' });
        if (error) throw error;
      }
      const allCats = await fetchAll('price_categories', worldId);
      const catIdByCode = new Map(allCats.map(c => [c.code, c.id]));
      // link subcategories under their parent
      const subPatches = v.items
        .filter(i => i.category && i.subcategory)
        .map(i => ({ sub: slugify(i.subcategory!), parent: slugify(i.category!) }));
      const seenSub = new Set<string>();
      for (const s of subPatches) {
        if (seenSub.has(s.sub) || s.sub === s.parent) continue;
        seenSub.add(s.sub);
        await supabase.from('price_categories' as any)
          .update({ parent_id: catIdByCode.get(s.parent) || null }).eq('id', catIdByCode.get(s.sub));
      }

      const allProfiles = await fetchAll('price_availability_profiles', worldId, 'id, code, name');
      const profIdByCode = new Map(allProfiles.map(p => [p.code, p.id]));

      const existingItems = await fetchAll('price_items', worldId);
      const itemCodes = new Set(existingItems.map(i => i.code));
      const itemsToWrite = mode === 'insert' ? v.items.filter(i => !itemCodes.has(i.code)) : v.items;
      for (let i = 0; i < itemsToWrite.length; i += 300) {
        const { error } = await supabase.from('price_items' as any).upsert(
          itemsToWrite.slice(i, i + 300).map(it => {
            const catName = it.subcategory || it.category;
            return {
              world_id: worldId, code: it.code, name: it.name,
              category: catName, category_id: catName ? catIdByCode.get(slugify(catName)) || null : null,
              unit: it.unit, base_price_copper: it.base_price_copper,
              availability_mode: it.availability_mode,
              availability_profile_id: it.profile_code ? profIdByCode.get(it.profile_code) || null : null,
            };
          }), { onConflict: 'world_id,code' });
        if (error) throw error;
      }
      messages.push(`Položky: ${itemsToWrite.length}`);

      // tag links
      if (v.tagLinks.length) {
        const allLocs = await fetchAll('price_locations', worldId);
        const allTags = await fetchAll('price_settlement_tags', worldId, 'id, code, label');
        const locIdByCode = new Map(allLocs.map(l => [l.code, l.id]));
        const tagIdByCode = new Map(allTags.map(t => [t.code, t.id]));
        const rows = v.tagLinks
          .map(t => ({ world_id: worldId, location_id: locIdByCode.get(t.settlement_code), tag_id: tagIdByCode.get(t.tag_code) }))
          .filter(r => r.location_id && r.tag_id);
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('price_settlement_tag_map' as any)
            .upsert(rows.slice(i, i + 500), { onConflict: 'location_id,tag_id', ignoreDuplicates: true });
          if (error) throw error;
        }
        messages.push(`Vazeb tagů: ${rows.length}`);
      }

      // exceptions
      if (v.exceptions.length) {
        const allItems = await fetchAll('price_items', worldId);
        const allLocs2 = await fetchAll('price_locations', worldId);
        const itemIdByCode = new Map(allItems.map(i => [i.code, i.id]));
        const locIdByCode2 = new Map(allLocs2.map(l => [l.code, l.id]));
        const rows = v.exceptions
          .map(e => ({
            world_id: worldId, item_id: itemIdByCode.get(e.item_code),
            location_id: locIdByCode2.get(e.settlement_code), action: e.action,
          }))
          .filter(r => r.item_id && r.location_id);
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('price_item_exceptions' as any)
            .upsert(rows.slice(i, i + 500), { onConflict: 'world_id,item_id,location_id' });
          if (error) throw error;
        }
        messages.push(`Výjimek: ${rows.length}`);
      }

      if (v.errors.length) messages.push(`Chybných řádků (neuloženo): ${v.errors.length}`);
      setLog(messages);
      toast.success('Import dokončen');
      setPreview(null);
      await onDone();
    } catch (e: any) {
      toast.error(e.message || 'Import selhal');
      setLog([...messages, e.message || 'Import selhal']);
    }
    setBusy(false);
  }

  function template() {
    downloadXlsx({
      types: [
        { code: 'city', label: 'Město', default_modifier_pct: 20 },
        { code: 'hamlet', label: 'Osada', default_modifier_pct: -10 },
      ],
      settlements: [
        { code: 'pelegor', name: 'Pelegor', type_code: 'city', type_label: 'Město', size: 5, wealth: 5, region: 'Pobřeží', price_modifier_pct: 20, uses_type_default: true, effective_pct: 20 },
        { code: 'wurfeho-doly', name: 'Wurfeho doly', type_code: 'hamlet', type_label: 'Osada', size: 2, wealth: 3, region: 'Hory', price_modifier_pct: -10, uses_type_default: true, effective_pct: -10 },
      ],
      settlementTags: [
        { settlement_code: 'pelegor', tag: 'přístav' },
        { settlement_code: 'pelegor', tag: 'obchod' },
        { settlement_code: 'wurfeho-doly', tag: 'hornictví' },
      ],
      items: [
        { code: 'pivo', name: 'Pivo', category: 'Nápoje', subcategory: 'Pivo', unit: 'Korbel', base_price_copper: 40, availability_mode: 'INHERIT', profile_code: '' },
        { code: 'zelezna-ruda', name: 'Železná ruda', category: 'Rudy', subcategory: '', unit: 'kg', base_price_copper: 25, availability_mode: 'PROFILE', profile_code: 'dulni-suroviny' },
      ],
      exceptions: [{ item_code: 'zelezna-ruda', settlement_code: 'pelegor', action: 'ALLOW' }],
      profiles: [
        { code: 'dulni-suroviny', name: 'Důlní suroviny', note: '', rules: { tags_any: ['hornictvi', 'doly'] } },
      ],
    }, 'cenik-sablona.xlsx');
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setPreview(null); setLog([]); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import ceníku</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Sešit má samostatné listy: <code>ITEMS</code>, <code>ITEM_EXCEPTIONS</code>, <code>SETTLEMENTS</code>,{' '}
            <code>SETTLEMENT_TAGS</code>, <code>AVAILABILITY_PROFILES</code>, <code>PROFILE_RULES</code> a{' '}
            <code>SETTLEMENT_TYPES</code>. Žádná matice předmět × sídlo — konkrétní sídla se uvádějí jen jako výjimky.
            Cena se píše textem, např. <code>4 st</code> nebo <code>1 zl 2 st</code>. Přijímá se i <code>.zip</code> s CSV nebo jednotlivé <code>.csv</code>.
          </p>

          <Button size="sm" variant="secondary" onClick={template}>Stáhnout šablonu XLSX</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.zip"
            onChange={() => setPreview(null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground" />

          <div className="flex gap-2 items-center">
            <span className="text-xs">Režim:</span>
            <Select value={mode} onValueChange={(v: Mode) => setMode(v)}>
              <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upsert">Přidat nové a aktualizovat existující</SelectItem>
                <SelectItem value="insert">Pouze přidat nové</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <div className="border rounded p-3 space-y-1 text-xs">
              <p className="font-medium text-sm">Náhled změn</p>
              <p>Bude vytvořeno položek: <strong>{preview.newItems}</strong>, změněno: <strong>{preview.updItems}</strong></p>
              <p>Sídla — nová: <strong>{preview.newLocs}</strong>, aktualizovaná: <strong>{preview.updLocs}</strong></p>
              <p>Nové tagy: <strong>{preview.newTags}</strong> · Nové profily: <strong>{preview.newProfiles}</strong></p>
              <p>Výjimek: <strong>{preview.v.exceptions.length}</strong> · Vazeb tagů: <strong>{preview.v.tagLinks.length}</strong></p>
              <p className={preview.v.errors.length ? 'text-destructive' : ''}>Chybné řádky: <strong>{preview.v.errors.length}</strong></p>
              <p>Varování: <strong>{preview.v.warnings.length}</strong></p>
              {(preview.v.errors.length > 0 || preview.v.warnings.length > 0) && (
                <div className="max-h-40 overflow-y-auto bg-muted rounded p-2 space-y-0.5">
                  {preview.v.errors.slice(0, 150).map((e, i) => <div key={`e${i}`} className="text-destructive">{e}</div>)}
                  {preview.v.warnings.slice(0, 150).map((w, i) => <div key={`w${i}`}>{w}</div>)}
                </div>
              )}
              <p className="text-muted-foreground">Chybné řádky se neuloží, ostatní ano.</p>
            </div>
          )}

          {log.length > 0 && (
            <div className="text-xs bg-muted rounded p-2 space-y-0.5">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zavřít</Button>
          <Button variant="secondary" disabled={busy} onClick={analyse}>{busy ? 'Pracuji…' : 'Zkontrolovat soubor'}</Button>
          <Button disabled={busy || !preview} onClick={run}>Provést import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
