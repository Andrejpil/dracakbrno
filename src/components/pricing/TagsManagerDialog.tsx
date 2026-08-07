import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/pricingIO';
import type { SettlementTag } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  tags: SettlementTag[];
  usage: Record<string, number>;
  onReload: () => Promise<void> | void;
}

export default function TagsManagerDialog({ open, onOpenChange, worldId, tags, usage, onReload }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    const { error } = await supabase.from('price_settlement_tags' as any).insert({
      world_id: worldId, code: slugify(label), label, sort_order: tags.length,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewLabel('');
    await onReload();
  }

  async function rename(t: SettlementTag, label: string) {
    if (!label.trim() || label === t.label) return;
    const { error } = await supabase.from('price_settlement_tags' as any)
      .update({ label: label.trim() }).eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  async function remove(t: SettlementTag) {
    if ((usage[t.id] || 0) > 0) {
      toast.error(`Tag „${t.label}" je přiřazen ${usage[t.id]} sídlům — nejdřív jej odeber.`);
      return;
    }
    if (!confirm(`Smazat tag „${t.label}"?`)) return;
    const { error } = await supabase.from('price_settlement_tags' as any).delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tagy sídel ({tags.length})</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input className="h-8 text-sm" placeholder="Nový tag, např. hornictví" value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <Button size="sm" disabled={busy || !newLabel.trim()} onClick={add}><Plus size={14} className="mr-1" />Přidat</Button>
        </div>
        <div className="space-y-1">
          {tags.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné tagy.</p>}
          {tags.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <Input className="h-8 text-sm flex-1" value={drafts[t.id] ?? t.label}
                onChange={e => setDrafts(d => ({ ...d, [t.id]: e.target.value }))}
                onBlur={e => rename(t, e.target.value)} />
              <span className="text-xs text-muted-foreground w-24 text-right">{usage[t.id] || 0} sídel</span>
              <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 size={14} className="text-destructive" /></Button>
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Hotovo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
