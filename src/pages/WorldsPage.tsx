import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/contexts/WorldContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Crown, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function WorldsPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { worlds, activeWorldId, setActiveWorldId, reload } = useWorld();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  async function createWorld() {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from('worlds' as any).insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: user.id,
    });
    if (error) { toast.error('Chyba: ' + error.message); return; }
    setName(''); setDescription('');
    toast.success('Svět vytvořen');
    await reload();
  }

  async function deleteWorld(id: string) {
    if (!confirm('Opravdu smazat svět? Smaže se veškerý obsah v něm!')) return;
    const { error } = await supabase.from('worlds' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Svět smazán');
    await reload();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-display text-primary">Světy</h1>
      <p className="text-sm text-muted-foreground">
        Každý svět má vlastní hrdiny, bestiář, mapy, NPC, kroniku a kalendář. Oprávnění uživatelů
        (prohlížení / editor / admin) se nastavují v záložce <strong>Uživatelé</strong>.
      </p>

      <Card className="p-4 space-y-3">
        <h2 className="font-display text-lg flex items-center gap-2"><Plus size={16} />Nový svět</h2>
        <div>
          <Label className="text-xs">Název</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="např. Andrejova kampaň" />
        </div>
        <div>
          <Label className="text-xs">Popis</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>
        <Button onClick={createWorld} disabled={!name.trim()}>Vytvořit svět</Button>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg">Dostupné světy ({worlds.length})</h2>
        {worlds.map(w => {
          const isOwner = user?.id === w.owner_id;
          const canManage = isOwner || isAdmin;
          const isActive = w.id === activeWorldId;
          return (
            <Card key={w.id} className={`p-4 ${isActive ? 'border-primary' : ''}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{w.name}</span>
                    {isOwner && <span className="flex items-center gap-1 text-xs text-primary"><Crown size={12} />vlastník</span>}
                    {isActive && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">aktivní</span>}
                  </div>
                  {w.description && <p className="text-sm text-muted-foreground mt-1">{w.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <Button size="sm" variant="outline" onClick={() => setActiveWorldId(w.id)}>
                      <Check size={14} className="mr-1" />Přepnout
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="destructive" onClick={() => deleteWorld(w.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
