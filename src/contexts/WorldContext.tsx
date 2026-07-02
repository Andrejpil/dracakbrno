import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface World {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface Ctx {
  worlds: World[];
  activeWorldId: string | null;
  activeWorld: World | null;
  isActiveOwner: boolean;
  loading: boolean;
  setActiveWorldId: (id: string) => void;
  reload: () => Promise<void>;
}

const WorldContext = createContext<Ctx | null>(null);
const LS_KEY = 'active_world_id';

export function WorldProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [activeWorldId, setActiveWorldIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setWorlds([]); setLoading(false); return; }
    const { data } = await supabase.from('worlds' as any).select('*').order('created_at');
    const list = (data as any as World[]) || [];
    setWorlds(list);

    const stored = localStorage.getItem(LS_KEY);
    const valid = stored && list.some(w => w.id === stored) ? stored : (list[0]?.id ?? null);
    setActiveWorldIdState(valid);
    if (valid) localStorage.setItem(LS_KEY, valid);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setActiveWorldId = (id: string) => {
    setActiveWorldIdState(id);
    localStorage.setItem(LS_KEY, id);
  };

  const activeWorld = worlds.find(w => w.id === activeWorldId) || null;
  const isActiveOwner = !!(activeWorld && user && activeWorld.owner_id === user.id);

  return (
    <WorldContext.Provider value={{ worlds, activeWorldId, activeWorld, isActiveOwner, loading, setActiveWorldId, reload: load }}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorld() {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorld must be inside WorldProvider');
  return ctx;
}
