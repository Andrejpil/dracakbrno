import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ThemeName = 'dark' | 'light' | 'emerald' | 'royal' | 'crimson' | 'parchment';
export type ChronicleOrder = 'newest_first' | 'oldest_first';
export type ChronicleOpenPage = 'first' | 'last';

export interface UserSettings {
  theme: ThemeName;
  chronicle_order: ChronicleOrder;
  chronicle_open_page: ChronicleOpenPage;
}

const DEFAULTS: UserSettings = {
  theme: 'dark',
  chronicle_order: 'newest_first',
  chronicle_open_page: 'first',
};

interface Ctx {
  settings: UserSettings;
  loading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
  getWorldNickname: (worldId: string) => string;
  setWorldNickname: (worldId: string, nickname: string) => Promise<void>;
  nicknames: Record<string, string>;
}

const UserSettingsContext = createContext<Ctx | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setSettings(DEFAULTS); setNicknames({}); setLoading(false); return; }
    setLoading(true);
    const { data: s } = await supabase.from('user_settings' as any).select('*').eq('user_id', user.id).maybeSingle();
    if (s) {
      const row = s as any;
      setSettings({
        theme: (row.theme || 'dark') as ThemeName,
        chronicle_order: (row.chronicle_order || 'newest_first') as ChronicleOrder,
        chronicle_open_page: (row.chronicle_open_page || 'first') as ChronicleOpenPage,
      });
    } else {
      setSettings(DEFAULTS);
    }
    const { data: n } = await supabase.from('world_nicknames' as any).select('world_id, nickname').eq('user_id', user.id);
    const map: Record<string, string> = {};
    ((n as any[]) || []).forEach(r => { map[r.world_id] = r.nickname; });
    setNicknames(map);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const update = async (patch: Partial<UserSettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from('user_settings' as any).upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
  };

  const getWorldNickname = (worldId: string) => nicknames[worldId] || '';

  const setWorldNickname = async (worldId: string, nickname: string) => {
    if (!user) return;
    setNicknames(prev => ({ ...prev, [worldId]: nickname }));
    if (!nickname.trim()) {
      await supabase.from('world_nicknames' as any).delete().eq('user_id', user.id).eq('world_id', worldId);
      setNicknames(prev => { const c = { ...prev }; delete c[worldId]; return c; });
    } else {
      await supabase.from('world_nicknames' as any).upsert(
        { user_id: user.id, world_id: worldId, nickname: nickname.trim() },
        { onConflict: 'user_id,world_id' }
      );
    }
  };

  return (
    <UserSettingsContext.Provider value={{ settings, loading, update, getWorldNickname, setWorldNickname, nicknames }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error('useUserSettings must be inside UserSettingsProvider');
  return ctx;
}
