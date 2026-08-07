import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/pricingIO';
import { resolveItemProfile } from '@/lib/availability';
import type { AvailabilityProfile, PriceCategory } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  worldId: string;
  categories: PriceCategory[];
  profiles: AvailabilityProfile[];
  onReload: () => Promise<void> | void;
}

const NONE = '__none__';

export default function CategoriesDialog({ open, onOpenChange, worldId, categories, profiles, onReload }: Props) {
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState(NONE);

  const tree = useMemo(() => {
    const roots = categories.filter(c => !c.parent_id);
    const out: { cat: PriceCategory; depth: number }[] = [];
    const walk = (c: PriceCategory, depth: number) => {
      out.push({ cat: c, depth });
      categories.filter(x => x.parent_id === c.id).forEach(x => walk(x, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    categories.filter(c => c.parent_id && !categories.some(p => p.id === c.parent_id)).forEach(c => out.push({ cat: c, depth: 0 }));
    return out;
  }, [categories]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from('price_categories' as any).insert({
      world_id: worldId, name, code: slugify(name),
      parent_id: newParent === NONE ? null : newParent, sort_order: categories.length,
    });
    if (error) { toast.error(error.message); return; }
    setNewName(''); setNewParent(NONE);
    await onReload();
  }

  async function patch(id: string, p: Record<string, any>) {
    const { error } = await supabase.from('price_categories' as any).update(p).eq('id', id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  async function remove(c: PriceCategory) {
    if (!confirm(`Smazat kategorii „${c.name}"? Položky zůstanou, jen ztratí zařazení.`)) return;
    const { error } = await supabase.from('price_categories' as any).delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    await onReload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kategorie a výchozí profily ({categories.length})</DialogTitle></DialogHeader>

        <div className="flex gap-2 flex-wrap items-center">
          <Input className="h-8 text-sm flex-1 min-w-[160px]" placeholder="Nová kategorie" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <Select value={newParent} onValueChange={setNewParent}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Bez nadřazené kategorie</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add}><Plus size={14} className="mr-1" />Přidat</Button>
        </div>

        <div className="space-y-1">
          {tree.length === 0 && <p className="text-sm text-muted-foreground">Žádné kategorie.</p>}
          {tree.map(({ cat, depth }) => {
            const inherited = resolveItemProfile(
              { availability_mode: 'INHERIT', availability_profile_id: null, category_id: cat.id },
              categories, profiles
            );
            return (
              <div key={cat.id} className="flex items-center gap-2 border-b py-1.5" style={{ paddingLeft: depth * 16 }}>
                <span className="flex-1 text-sm truncate">{depth > 0 && '↳ '}{cat.name}</span>
                <Select value={cat.default_profile_id || NONE}
                  onValueChange={v => patch(cat.id, { default_profile_id: v === NONE ? null : v })}>
                  <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Výchozí profil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      {cat.parent_id && inherited.profile ? `Zdědit (${inherited.profile.name})` : 'Bez profilu'}
                    </SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => remove(cat)}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            );
          })}
        </div>

        <DialogFooter><Button onClick={() => onOpenChange(false)}>Hotovo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
