import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trait, traitKey } from '@/lib/gameData';

export function useTraits() {
  const [traits, setTraits] = useState<Trait[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('traits').select('*').order('kind').order('number');
    if (data) setTraits(data as Trait[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('traits-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traits' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const findTrait = (kind: 'good' | 'bad', n: number | null | undefined): Trait | undefined => {
    if (!n) return undefined;
    const key = traitKey(n);
    return traits.find(t => t.kind === kind && t.number === key);
  };

  const updateTrait = useCallback(async (kind: 'good' | 'bad', number: number, name: string, description: string) => {
    const key = traitKey(number);
    const existing = traits.find(t => t.kind === kind && t.number === key);
    if (existing) {
      await supabase.from('traits').update({ name, description }).eq('id', existing.id);
    } else {
      await supabase.from('traits').insert({ kind, number: key, name, description });
    }
    load();
  }, [traits, load]);

  return { traits, findTrait, updateTrait, reload: load };
}
