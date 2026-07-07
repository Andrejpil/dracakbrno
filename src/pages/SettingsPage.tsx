import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/contexts/WorldContext';
import { useUserSettings, ThemeName } from '@/hooks/useUserSettings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Palette, KeyRound, User, ScrollText } from 'lucide-react';

const THEMES: { value: ThemeName; label: string; swatch: string[] }[] = [
  { value: 'dark', label: 'Klasická tmavá', swatch: ['#1a1d24', '#d69034', '#a03535'] },
  { value: 'light', label: 'Klasická světlá', swatch: ['#f3ecd9', '#c47d1a', '#a03535'] },
  { value: 'emerald', label: 'Smaragdový les', swatch: ['#1a1d24', '#22a06b', '#0f6b52'] },
  { value: 'royal', label: 'Královská modř', swatch: ['#1a1d24', '#4a7bd6', '#6b4bc4'] },
  { value: 'crimson', label: 'Krvavá purpura', swatch: ['#1a1d24', '#c93d5d', '#8a2340'] },
  { value: 'parchment', label: 'Pergamen', swatch: ['#f3ecd9', '#8b5a2b', '#6b4423'] },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { worlds, activeWorldId } = useWorld();
  const { settings, update, getWorldNickname, setWorldNickname } = useUserSettings();

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Local nickname draft per world
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function changePassword() {
    if (password.length < 6) { toast.error('Heslo musí mít alespoň 6 znaků.'); return; }
    if (password !== password2) { toast.error('Hesla se neshodují.'); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password });
    setChangingPw(false);
    if (error) { toast.error('Chyba: ' + error.message); return; }
    setPassword(''); setPassword2('');
    toast.success('Heslo změněno.');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-display text-primary">Nastavení</h1>
      <p className="text-sm text-muted-foreground">Přihlášen jako <strong className="text-foreground">{user?.email}</strong></p>

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-lg flex items-center gap-2"><KeyRound size={18} className="text-primary" />Změna hesla</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nové heslo</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min. 6 znaků" />
          </div>
          <div>
            <Label className="text-xs">Potvrdit heslo</Label>
            <Input type="password" value={password2} onChange={e => setPassword2(e.target.value)} />
          </div>
        </div>
        <Button onClick={changePassword} disabled={changingPw || !password}>
          {changingPw ? 'Ukládám…' : 'Změnit heslo'}
        </Button>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-lg flex items-center gap-2"><User size={18} className="text-primary" />Přezdívka pro svět</h2>
        <p className="text-xs text-muted-foreground">
          Přezdívka se použije jako jméno autora zápisků v kronice daného světa. Pro každý svět můžeš mít jinou.
        </p>
        {worlds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím nejsi členem žádného světa.</p>
        ) : (
          <div className="space-y-2">
            {worlds.map(w => {
              const current = getWorldNickname(w.id);
              const draft = drafts[w.id] ?? current;
              const changed = draft !== current;
              return (
                <div key={w.id} className="flex items-center gap-2">
                  <span className="text-sm min-w-[140px] truncate">
                    {w.name}
                    {w.id === activeWorldId && <span className="text-primary text-xs ml-1">(aktivní)</span>}
                  </span>
                  <Input
                    className="flex-1"
                    value={draft}
                    placeholder={user?.email?.split('@')[0] || 'přezdívka'}
                    onChange={e => setDrafts(p => ({ ...p, [w.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    disabled={!changed}
                    onClick={async () => {
                      await setWorldNickname(w.id, draft);
                      toast.success('Přezdívka uložena');
                    }}
                  >Uložit</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-lg flex items-center gap-2"><Palette size={18} className="text-primary" />Barevné schéma</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {THEMES.map(t => {
            const active = settings.theme === t.value;
            return (
              <button
                key={t.value}
                onClick={() => update({ theme: t.value })}
                className={`text-left p-3 rounded-md border-2 transition-all ${
                  active ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex gap-1 mb-2">
                  {t.swatch.map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ background: c }} />
                  ))}
                </div>
                <div className="text-sm font-medium">{t.label}</div>
                {active && <div className="text-[10px] text-primary mt-1">✓ aktivní</div>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-lg flex items-center gap-2"><ScrollText size={18} className="text-primary" />Kronika</h2>

        <div className="space-y-2">
          <Label className="text-xs">Řazení zápisků</Label>
          <Select value={settings.chronicle_order} onValueChange={(v: any) => update({ chronicle_order: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest_first">Nejnovější první (strana 1 = nejmladší zápis)</SelectItem>
              <SelectItem value="oldest_first">Nejstarší první (strana 1 = nejstarší zápis)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Otevřít kroniku na</Label>
          <Select value={settings.chronicle_open_page} onValueChange={(v: any) => update({ chronicle_open_page: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first">první straně</SelectItem>
              <SelectItem value="last">poslední straně</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Kombinací obou voleb dostaneš přesně čtyři varianty:  
          řazení nejnovější/nejstarší × otevření na první/poslední straně.
        </p>
      </Card>
    </div>
  );
}
