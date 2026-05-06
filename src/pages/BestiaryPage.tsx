import { useState, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Monster, getAttributeBonus, formatBonus, calculateHP } from '@/lib/gameData';
import BonusBadge from '@/components/BonusBadge';
import { Plus, Pencil, Trash2, Star, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUserRole } from '@/hooks/useUserRole';

const defaultMonster = {
  name: '',
  str: 0, con: 0, dex: 0, int: 0, cha: 0,
  str_min: 0, str_max: 0, con_min: 0, con_max: 0, dex_min: 0, dex_max: 0, int_min: 0, int_max: 0, cha_min: 0, cha_max: 0,
  mp: 0, attack: 0, defense: 0, xp_reward: 0, special: '', is_unique: false, image_url: '',
  hp_multiplier: 1.0,
};

const ATTR_FIELDS: Array<['SÍL'|'ODO'|'OBR'|'INT'|'CHA','str'|'con'|'dex'|'int'|'cha']> = [
  ['SÍL','str'],['ODO','con'],['OBR','dex'],['INT','int'],['CHA','cha'],
];

export default function BestiaryPage() {
  const { monsters, addMonster, editMonster, deleteMonster } = useGame();
  const { canEdit: canEditPage } = useUserRole();
  const editable = canEditPage('bestiary');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof defaultMonster>(defaultMonster);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openNew = () => { setEditId(null); setForm(defaultMonster); setOpen(true); };
  const openEdit = (m: Monster) => {
    setEditId(m.id);
    setForm({
      name: m.name,
      str: m.str, con: m.con, dex: m.dex, int: m.int, cha: m.cha,
      str_min: m.str_min ?? m.str, str_max: m.str_max ?? m.str,
      con_min: m.con_min ?? m.con, con_max: m.con_max ?? m.con,
      dex_min: m.dex_min ?? m.dex, dex_max: m.dex_max ?? m.dex,
      int_min: m.int_min ?? m.int, int_max: m.int_max ?? m.int,
      cha_min: m.cha_min ?? m.cha, cha_max: m.cha_max ?? m.cha,
      mp: m.mp, attack: m.attack, defense: m.defense, xp_reward: m.xp_reward,
      special: m.special, is_unique: m.is_unique, image_url: m.image_url,
      hp_multiplier: m.hp_multiplier ?? 1.0,
    });
    setOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('monster-images').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('monster-images').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = () => {
    if (!form.name) return;
    // Sync single value = midpoint of min/max for backwards compat
    const data: any = {
      ...form,
      str: Math.round((form.str_min + form.str_max) / 2) || form.str_min || form.str,
      con: Math.round((form.con_min + form.con_max) / 2) || form.con_min || form.con,
      dex: Math.round((form.dex_min + form.dex_max) / 2) || form.dex_min || form.dex,
      int: Math.round((form.int_min + form.int_max) / 2) || form.int_min || form.int,
      cha: Math.round((form.cha_min + form.cha_max) / 2) || form.cha_min || form.cha,
      hp: 0,
    };
    if (editId) editMonster(editId, data);
    else addMonster(data);
    setOpen(false);
  };

  const setNum = (field: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [field]: parseInt(value) || 0 }));
  };

  // Preview HP using min CON
  const previewHP = (level: number) => calculateHP(form.con_min || 10, level, form.is_unique, form.hp_multiplier);
  const previewHPMax = (level: number) => calculateHP(form.con_max || 10, level, form.is_unique, form.hp_multiplier);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-primary">Bestiář</h2>
        {editable && <Button onClick={openNew} size="sm"><Plus size={16} className="mr-1" /> Nová bestie</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monsters.map(m => (
          <div key={m.id} className="bg-card rounded-lg p-4 border border-border">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-[150px] w-[150px] rounded-md">
                  {m.image_url ? <AvatarImage src={m.image_url} alt={m.name} className="object-cover" /> : null}
                  <AvatarFallback className="rounded-md text-sm">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg text-foreground">{m.name}</h3>
                  {m.is_unique && <Star size={14} className="text-primary fill-primary" />}
                </div>
              </div>
              {editable && <div className="flex gap-1">
                <button onClick={() => openEdit(m)} className="p-1 text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                <button onClick={() => deleteMonster(m.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
              </div>}
            </div>
            <div className="space-y-1">
              {ATTR_FIELDS.map(([label, key]) => {
                const lo = (m as any)[`${key}_min`] ?? m[key];
                const hi = (m as any)[`${key}_max`] ?? m[key];
                return (
                  <p key={key} className="text-sm text-muted-foreground">
                    {label}: <span className="text-foreground font-bold">{lo}{lo !== hi ? `–${hi}` : ''}</span>
                    <span className="ml-2 text-xs">({formatBonus(getAttributeBonus(lo))}{lo !== hi ? ` až ${formatBonus(getAttributeBonus(hi))}` : ''})</span>
                  </p>
                );
              })}
              <p className="text-sm text-muted-foreground">
                HP úr.1: <span className="text-foreground">{calculateHP(m.con_min ?? m.con, 1, m.is_unique, m.hp_multiplier ?? 1.0)}{(m.con_min ?? m.con) !== (m.con_max ?? m.con) ? `–${calculateHP(m.con_max ?? m.con, 1, m.is_unique, m.hp_multiplier ?? 1.0)}` : ''}</span>
                <span className="ml-1 text-xs">(násob. {Math.round((m.hp_multiplier ?? 1.0) * 100)}%)</span>
                {' | '}MP: <span className="text-foreground">{m.mp}</span>
              </p>
              <p className="text-sm text-muted-foreground">Útok: <span className="text-foreground">{m.attack}</span> | Obrana: <span className="text-foreground">{m.defense}</span></p>
              <p className="text-sm text-muted-foreground">XP za zabití: <span className="text-primary">{m.xp_reward}</span></p>
              <p className="text-sm text-muted-foreground">Typ: <span className="text-foreground">{m.is_unique ? 'Unikátní' : 'Obyčejná'}</span></p>
              {m.special && <p className="text-sm text-muted-foreground">Speciální: <span className="text-foreground">{m.special}</span></p>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">{editId ? 'Upravit bestii' : 'Nová bestie'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[75vh] overflow-auto">
            <Input placeholder="Jméno" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

            <div className="flex items-center gap-3">
              <Avatar className="h-[150px] w-[150px] rounded-md border border-border">
                {form.image_url ? <AvatarImage src={form.image_url} alt="Preview" className="object-cover" /> : null}
                <AvatarFallback className="rounded-md text-muted-foreground"><ImagePlus size={32} /></AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? 'Nahrávám...' : 'Nahrát obrázek'}
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, image_url: '' }))}>Odebrat</Button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <p className="text-xs text-muted-foreground">150×150 px, čtverec</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md border border-border">
              <div className="flex items-center gap-2">
                <Star size={16} className={form.is_unique ? 'text-primary fill-primary' : 'text-muted-foreground'} />
                <span className="text-sm font-bold text-foreground">{form.is_unique ? 'Unikátní bestie' : 'Obyčejná bestie'}</span>
              </div>
              <Switch checked={form.is_unique} onCheckedChange={v => setForm(f => ({ ...f, is_unique: v }))} />
            </div>

            {/* Attribute ranges */}
            <div className="space-y-2 p-2 rounded-md border border-border bg-muted/20">
              <p className="text-xs font-bold text-muted-foreground">Rozsahy atributů (min – max). Konkrétní hodnoty se vylosují při přidání bestie.</p>
              {ATTR_FIELDS.map(([label, key]) => {
                const minK = `${key}_min` as keyof typeof form;
                const maxK = `${key}_max` as keyof typeof form;
                const lo = form[minK] as number;
                const hi = form[maxK] as number;
                const bLo = getAttributeBonus(lo);
                const bHi = getAttributeBonus(hi);
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">{label}</span>
                    <Input type="number" min={1} max={40} className="w-20" placeholder="min"
                      value={lo} onChange={e => setNum(minK, e.target.value)} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="number" min={1} max={40} className="w-20" placeholder="max"
                      value={hi} onChange={e => setNum(maxK, e.target.value)} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      bonus {formatBonus(bLo)}{lo !== hi ? ` až ${formatBonus(bHi)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* HP multiplier (number 1.0 - 50.0) */}
            <div className="p-2 rounded-md border border-border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-muted-foreground">Násobitel HP (úr. 1)</span>
                <span className="text-sm font-bold text-primary">×{form.hp_multiplier.toFixed(1)}</span>
              </div>
              <Input type="number" min={1} max={50} step={0.1}
                value={form.hp_multiplier}
                onChange={e => setForm(f => ({ ...f, hp_multiplier: Math.max(1, Math.min(50, parseFloat(e.target.value) || 1)) }))} />
              <p className="text-xs text-muted-foreground mt-1">HP úr.1 = ⌈(bonus za odolnost + 10) × násobitel⌉ (zaokr. nahoru). Rozsah 1,0 – 50,0.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">ÚT</span>
              <Input type="number" min={0} className="flex-1" value={form.attack} onChange={e => setNum('attack', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">OČ</span>
              <Input type="number" min={0} className="flex-1" value={form.defense} onChange={e => setNum('defense', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">MP</span>
              <Input type="number" min={0} className="flex-1" value={form.mp} onChange={e => setNum('mp', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-muted-foreground shrink-0">XP</span>
              <Input type="number" min={0} placeholder="XP za zabití" value={form.xp_reward} onChange={e => setNum('xp_reward', e.target.value)} />
            </div>

            <div className="p-2 rounded-md border border-border bg-muted/30">
              <p className="text-xs font-bold text-muted-foreground mb-1">Náhled HP ({form.is_unique ? 'unikátní' : 'obyčejná'}):</p>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Úr.1: <span className="text-foreground font-bold">{previewHP(1)}{form.con_min !== form.con_max ? `–${previewHPMax(1)}` : ''}</span></span>
                <span className="text-muted-foreground">Úr.5: <span className="text-foreground font-bold">{previewHP(5)}{form.con_min !== form.con_max ? `–${previewHPMax(5)}` : ''}</span></span>
                <span className="text-muted-foreground">Úr.10: <span className="text-foreground font-bold">{previewHP(10)}{form.con_min !== form.con_max ? `–${previewHPMax(10)}` : ''}</span></span>
              </div>
            </div>

            <Input placeholder="Speciální schopnosti" value={form.special} onChange={e => setForm(f => ({ ...f, special: e.target.value }))} />
            <Button onClick={handleSave} className="w-full">{editId ? 'Uložit změny' : 'Přidat bestii'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
