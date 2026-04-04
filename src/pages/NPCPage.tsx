import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Edit2, Search, Wand2, RefreshCw, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NPC_RACES, generateRandomName, type NPCRace, type NPCGender } from '@/lib/npcNames';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface NPC {
  id: string;
  name: string;
  location: string;
  description: string;
  relationship: string;
  image_url: string;
}

export default function NPCPage() {
  const { user } = useAuth();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('npc');
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null);
  const [form, setForm] = useState({ name: '', location: '', description: '', relationship: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  // Generator state
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [genRace, setGenRace] = useState<NPCRace>('Člověk');
  const [genGender, setGenGender] = useState<NPCGender>('random');
  const [genName, setGenName] = useState('');
  const [genForm, setGenForm] = useState({ location: '', description: '', relationship: '' });

  useEffect(() => {
    if (user) loadNpcs();
  }, [user]);

  async function loadNpcs() {
    setLoading(true);
    const { data } = await supabase.from('npcs').select('*').order('name');
    setNpcs((data || []).map((n: any) => ({
      id: n.id, name: n.name, location: n.location,
      description: n.description, relationship: n.relationship, image_url: n.image_url,
    })));
    setLoading(false);
  }

  function openCreate() {
    setEditingNpc(null);
    setForm({ name: '', location: '', description: '', relationship: '' });
    setImageFile(null);
    setImagePreview('');
    setDialogOpen(true);
  }

  function openEdit(npc: NPC) {
    setEditingNpc(npc);
    setForm({ name: npc.name, location: npc.location, description: npc.description, relationship: npc.relationship });
    setImageFile(null);
    setImagePreview(npc.image_url);
    setDialogOpen(true);
  }

  async function uploadImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('npc-images').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('npc-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!user || !form.name.trim()) return;
    let imageUrl = editingNpc?.image_url || '';

    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile); } catch {
        toast({ title: 'Chyba při nahrávání obrázku', variant: 'destructive' });
        return;
      }
    }

    if (editingNpc) {
      await supabase.from('npcs').update({
        name: form.name, location: form.location,
        description: form.description, relationship: form.relationship,
        image_url: imageUrl,
      }).eq('id', editingNpc.id);
    } else {
      await supabase.from('npcs').insert({
        user_id: user.id, name: form.name, location: form.location,
        description: form.description, relationship: form.relationship,
        image_url: imageUrl,
      });
    }
    setDialogOpen(false);
    loadNpcs();
    toast({ title: editingNpc ? 'NPC upraveno' : 'NPC přidáno' });
  }

  async function handleDelete(id: string) {
    await supabase.from('npcs').delete().eq('id', id);
    setNpcs(prev => prev.filter(n => n.id !== id));
    toast({ title: 'NPC smazáno' });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // Generator functions
  function openGenerator() {
    setGenRace('Člověk');
    setGenName(generateRandomName('Člověk'));
    setGenForm({ location: '', description: '', relationship: '' });
    setGeneratorOpen(true);
  }

  function rerollName() {
    setGenName(generateRandomName(genRace));
  }

  function handleRaceChange(race: string) {
    setGenRace(race as NPCRace);
    setGenName(generateRandomName(race as NPCRace));
  }

  async function handleSaveGenerated() {
    if (!user || !genName.trim()) return;
    await supabase.from('npcs').insert({
      user_id: user.id,
      name: genName,
      location: genForm.location,
      description: genForm.description,
      relationship: genForm.relationship,
      image_url: '',
    });
    setGeneratorOpen(false);
    loadNpcs();
    toast({ title: 'NPC uloženo do seznamu' });
  }

  const filtered = npcs.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">NPC postavy</h2>
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openGenerator}>
              <Wand2 size={16} className="mr-1" /> Generátor NPC
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} className="mr-1" /> Přidat NPC
            </Button>
          </div>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Hledat NPC..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Načítání...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Žádné NPC postavy.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(npc => (
            <Card key={npc.id} className="p-4 flex gap-4">
              <Avatar className="h-[150px] w-[150px] rounded-md shrink-0">
                {npc.image_url ? (
                  <AvatarImage src={npc.image_url} alt={npc.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-md text-lg">
                  {npc.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-display text-lg text-foreground truncate">{npc.name}</h3>
                  {editable && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(npc)} className="p-1 text-muted-foreground hover:text-primary">
                        <Edit2 size={14} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Smazat NPC?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Opravdu chcete smazat <strong>{npc.name}</strong>?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Zrušit</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(npc.id)}>Smazat</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                {npc.location && (
                  <p className="text-sm text-muted-foreground">📍 {npc.location}</p>
                )}
                {npc.relationship && (
                  <p className="text-sm text-primary mt-1">💬 {npc.relationship}</p>
                )}
                {npc.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{npc.description}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingNpc ? 'Upravit NPC' : 'Nové NPC'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-foreground font-medium">Jméno *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Lokace</label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Vztah k družině</label>
              <Input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Popis</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Obrázek (150×150px)</label>
              <Input type="file" accept="image/*" onChange={handleFileChange} className="mt-1" />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="mt-2 w-[150px] h-[150px] object-cover rounded-md border border-border" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingNpc ? 'Uložit' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generator Dialog */}
      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wand2 size={20} /> Generátor NPC
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground font-medium">Rasa</label>
              <Select value={genRace} onValueChange={handleRaceChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NPC_RACES.map(race => (
                    <SelectItem key={race} value={race}>{race}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-foreground font-medium">Vygenerované jméno</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={genName}
                  onChange={e => setGenName(e.target.value)}
                  className="flex-1 text-lg font-display"
                />
                <Button variant="outline" size="icon" onClick={rerollName} title="Nové jméno">
                  <RefreshCw size={16} />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-foreground font-medium">Lokace</label>
              <Input value={genForm.location} onChange={e => setGenForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Vztah k družině</label>
              <Input value={genForm.relationship} onChange={e => setGenForm(f => ({ ...f, relationship: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-foreground font-medium">Popis</label>
              <Textarea value={genForm.description} onChange={e => setGenForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveGenerated} disabled={!genName.trim()}>
              <Save size={16} className="mr-1" /> Uložit do seznamu NPC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
