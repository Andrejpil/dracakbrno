import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/contexts/WorldContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Crown, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  world_id: string;
  user_id: string;
  member_role: 'editor' | 'viewer';
}
interface Profile { id: string; email: string; }

export default function WorldsPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { worlds, activeWorldId, setActiveWorldId, reload } = useWorld();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // members management
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');

  useEffect(() => {
    supabase.from('profiles').select('id, email').then(({ data }) => {
      setProfiles((data as any) || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedWorld) { setMembers([]); return; }
    supabase.from('world_members' as any).select('*').eq('world_id', selectedWorld).then(({ data }) => {
      setMembers((data as any) || []);
    });
  }, [selectedWorld]);

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
    if (selectedWorld === id) setSelectedWorld(null);
    await reload();
  }

  async function invite(worldId: string) {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const p = profiles.find(x => x.email.toLowerCase() === email);
    if (!p) { toast.error('Uživatel s tímto e-mailem neexistuje.'); return; }
    const { error } = await supabase.from('world_members' as any).insert({
      world_id: worldId, user_id: p.id, member_role: inviteRole,
    });
    if (error) { toast.error(error.message); return; }
    setInviteEmail('');
    const { data } = await supabase.from('world_members' as any).select('*').eq('world_id', worldId);
    setMembers((data as any) || []);
    toast.success('Přidáno');
  }

  async function changeMemberRole(worldId: string, userId: string, role: 'editor' | 'viewer') {
    await supabase.from('world_members' as any).update({ member_role: role }).eq('world_id', worldId).eq('user_id', userId);
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, member_role: role } : m));
  }

  async function removeMember(worldId: string, userId: string) {
    await supabase.from('world_members' as any).delete().eq('world_id', worldId).eq('user_id', userId);
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  }

  const emailFor = (id: string) => profiles.find(p => p.id === id)?.email || id.slice(0, 8);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-display text-primary">Světy</h1>
      <p className="text-sm text-muted-foreground">
        Každý svět má vlastní hrdiny, bestiář, mapy, NPC, kroniku a kalendář. Vlastník světa může přizvat další
        uživatele jako editory nebo pozorovatele. <em>(Filtrování obsahu podle aktivního světa se zapíná postupně – Fáze 2.)</em>
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
          const isSelected = selectedWorld === w.id;
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
                    <Button size="sm" variant="outline" onClick={() => setSelectedWorld(isSelected ? null : w.id)}>
                      <UserPlus size={14} className="mr-1" />{isSelected ? 'Zavřít' : 'Členové'}
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="destructive" onClick={() => deleteWorld(w.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {isSelected && canManage && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs">E-mail uživatele</Label>
                      <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="hrac@example.com" />
                    </div>
                    <div>
                      <Label className="text-xs">Role</Label>
                      <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Hráč</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => invite(w.id)} disabled={!inviteEmail.trim()}>Přidat</Button>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Vlastník: {emailFor(w.owner_id)}</div>
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                        <span>{emailFor(m.user_id)}</span>
                        <div className="flex items-center gap-2">
                          <Select value={m.member_role} onValueChange={(v: any) => changeMemberRole(w.id, m.user_id, v)}>
                            <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Hráč</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                            </SelectContent>
                          </Select>
                          <button onClick={() => removeMember(w.id, m.user_id)} className="text-destructive hover:opacity-70">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && <p className="text-xs text-muted-foreground">Zatím žádní členové.</p>}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
