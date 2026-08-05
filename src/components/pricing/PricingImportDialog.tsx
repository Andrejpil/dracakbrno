import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { parseImportFile, validateImport, ValidationResult, downloadXlsx } from '@/lib/pricingIO';

type Mode = 'upsert' | 'insert' | 'replace';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  onDone: () => Promise<void> | void;
}

async function fetchAllCodes(table: string, worldId: string) {
  const out: { id: string; code: string | null; name: string }[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase.from(table as any)
      .select('id, code, name').eq('world_id', worldId).range(from, from + step - 1);
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
  const [preview, setPreview] = useState<null | {
    v: ValidationResult;
    newItems: number; updItems: number;
    newLocs: number; updLocs: number;
    newTypes: number;
  }>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function analyse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Vyber soubor (.xlsx, .csv nebo .zip)'); return; }
    setBusy(true); setLog([]);
    try {
      const sheets = await parseImportFile(file);
      const [items, locs, typesRes] = await Promise.all([
        fetchAllCodes('price_items', worldId),
        fetchAllCodes('price_locations', worldId),
        supabase.from('price_location_types' as any).select('code, label').eq('world_id', worldId),
      ]);
      const nrm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
      const itemCodes = new Set(items.map(i => i.code || '').filter(Boolean));
      const settlementCodes = new Set(locs.map(l => l.code || '').filter(Boolean));
      const typeRows = ((typesRes.data as any[]) || []);
      const typeCodes = new Set(typeRows.map(t => t.code));
      const settlementCodeByName = new Map(locs.filter(l => l.code).map(l => [nrm(l.name), l.code as string]));
      const typeCodeByLabel = new Map(typeRows.map(t => [nrm(t.label || ''), t.code as string]));
      const v = validateImport(sheets, { itemCodes, settlementCodes, typeCodes, settlementCodeByName, typeCodeByLabel });
      setPreview({
        v,
        newItems: v.items.filter(i => !itemCodes.has(i.code)).length,
        updItems: v.items.filter(i => itemCodes.has(i.code)).length,
        newLocs: v.settlements.filter(s => !settlementCodes.has(s.code)).length,
        updLocs: v.settlements.filter(s => settlementCodes.has(s.code)).length,
        newTypes: v.types.filter(t => !typeCodes.has(t.code)).length,
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

      // 1) types
      if (v.types.length) {
        const { error } = await supabase.from('price_location_types' as any)
          .upsert(v.types.map((t, i) => ({ world_id: worldId, code: t.code, label: t.label, default_modifier_pct: t.default_modifier_pct, sort_order: i })),
            { onConflict: 'world_id,code' });
        if (error) throw error;
        messages.push(`Typy sídel: ${v.types.length}`);
      }

      if (mode === 'replace') {
        await supabase.from('price_items' as any).delete().eq('world_id', worldId);
        if (v.settlements.length) await supabase.from('price_locations' as any).delete().eq('world_id', worldId);
      }

      // 2) settlements
      const existingLocs = await fetchAllCodes('price_locations', worldId);
      const locCodes = new Set(existingLocs.map(l => l.code));
      const locsToWrite = mode === 'insert' ? v.settlements.filter(s => !locCodes.has(s.code)) : v.settlements;
      for (let i = 0; i < locsToWrite.length; i += 300) {
        const { error } = await supabase.from('price_locations' as any).upsert(
          locsToWrite.slice(i, i + 300).map(s => ({
            world_id: worldId, code: s.code, name: s.name, type: s.type_code, type_code: s.type_code,
            price_modifier_pct: s.price_modifier_pct, uses_type_default: s.uses_type_default, note: s.note,
          })), { onConflict: 'world_id,code' });
        if (error) throw error;
      }
      if (locsToWrite.length) messages.push(`Sídla zapsána: ${locsToWrite.length}`);

      // 3) items
      const existingItems = await fetchAllCodes('price_items', worldId);
      const itemCodes = new Set(existingItems.map(i => i.code));
      const itemsToWrite = mode === 'insert' ? v.items.filter(i => !itemCodes.has(i.code)) : v.items;
      for (let i = 0; i < itemsToWrite.length; i += 300) {
        const { error } = await supabase.from('price_items' as any).upsert(
          itemsToWrite.slice(i, i + 300).map(it => ({
            world_id: worldId, code: it.code, name: it.name, category: it.category, unit: it.unit,
            note: it.note, base_price_copper: it.base_price_copper, availability_mode: it.availability_mode,
          })), { onConflict: 'world_id,code' });
        if (error) throw error;
      }
      messages.push(`Položky zapsány: ${itemsToWrite.length}`);

      // 4) availability links
      const allItems = await fetchAllCodes('price_items', worldId);
      const allLocs = await fetchAllCodes('price_locations', worldId);
      const itemIdByCode = new Map(allItems.map(i => [i.code, i.id]));
      const locIdByCode = new Map(allLocs.map(l => [l.code, l.id]));

      const touched = new Set(itemsToWrite.map(i => itemIdByCode.get(i.code)).filter(Boolean) as string[]);
      const ids = Array.from(touched);
      for (let i = 0; i < ids.length; i += 200) {
        await supabase.from('price_item_locations' as any).delete().in('item_id', ids.slice(i, i + 200));
      }
      const links = v.availability
        .map(a => ({
          item_id: itemIdByCode.get(a.item_code),
          location_id: locIdByCode.get(a.settlement_code),
          override_modifier_pct: a.override,
        }))
        .filter(l => l.item_id && l.location_id && touched.has(l.item_id as string));
      for (let i = 0; i < links.length; i += 500) {
        const { error } = await supabase.from('price_item_locations' as any).insert(links.slice(i, i + 500));
        if (error) throw error;
      }
      messages.push(`Vazeb dostupnosti: ${links.length}`);
      if (v.errors.length) messages.push(`Chyb / varování: ${v.errors.length}`);

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
      items: [{
        item_id: '', item_code: 'vino-belteren', name: 'Víno z Belterenu', category: 'Nápoje', unit: 'láhev',
        base_gold: 1, base_silver: 2, base_copper: 0, availability_mode: 'ONLY_SELECTED', note: '',
      }],
      settlements: [{
        settlement_id: '', settlement_code: 'belteren', name: 'Belteren', settlement_type: 'city',
        price_modifier_percent: 0, uses_type_default: true, note: '',
      }],
      availability: [{ item_code: 'vino-belteren', settlement_code: 'belteren', override_percent: '' }],
      types: [{ type_code: 'city', label: 'Město', default_modifier_percent: 10 }],
    }, 'cenik-sablona.xlsx');
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setPreview(null); setLog([]); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import ceníku</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Přijímá <code>.xlsx</code> (listy Polozky / Sidla / Dostupnost / TypySidel), <code>.zip</code> s CSV soubory
            (items.csv, settlements.csv, availability.csv) nebo jednotlivý <code>.csv</code>.
            Položky a sídla se párují podle unikátního kódu, název je jen pomocná hodnota.
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
                <SelectItem value="replace">Kompletně nahradit data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <div className="border rounded p-3 space-y-1 text-xs">
              <p className="font-medium text-sm">Náhled změn</p>
              <p>Položky — nové: <strong>{preview.newItems}</strong>, aktualizované: <strong>{preview.updItems}</strong></p>
              <p>Sídla — nová: <strong>{preview.newLocs}</strong>, aktualizovaná: <strong>{preview.updLocs}</strong></p>
              <p>Nové typy sídel: <strong>{preview.newTypes}</strong></p>
              <p>Vazeb dostupnosti: <strong>{preview.v.availability.length}</strong></p>
              <p className={preview.v.errors.length ? 'text-destructive' : ''}>Chybné řádky: <strong>{preview.v.errors.length}</strong></p>
              {preview.v.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-muted rounded p-2 space-y-0.5">
                  {preview.v.errors.slice(0, 200).map((e, i) => <div key={i}>{e}</div>)}
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
