import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shiftDate } from '@/lib/calendar';

export interface GameCalendar {
  current_day: number;
  current_month: number;
  current_year: number;
  era_name: string;
}

export interface SpecialDay {
  id: string;
  name: string;
  description: string | null;
  color: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  recurring: boolean;
  year: number | null;
}

interface Ctx {
  calendar: GameCalendar | null;
  specialDays: SpecialDay[];
  loading: boolean;
  shift: (delta: number) => Promise<void>;
  update: (patch: Partial<GameCalendar>) => Promise<void>;
  addSpecialDay: (sd: Omit<SpecialDay, 'id'>) => Promise<void>;
  deleteSpecialDay: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const CalendarContext = createContext<Ctx | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendar, setCalendar] = useState<GameCalendar | null>(null);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: cal }, { data: sd }] = await Promise.all([
      supabase.from('game_calendar' as any).select('*').maybeSingle(),
      supabase.from('calendar_special_days' as any).select('*'),
    ]);
    if (cal) setCalendar(cal as any);
    setSpecialDays((sd as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_calendar' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_special_days' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const shift = async (delta: number) => {
    if (!calendar) return;
    const next = shiftDate(calendar.current_day, calendar.current_month, calendar.current_year, delta);
    const patch = { current_day: next.day, current_month: next.month, current_year: next.year };
    setCalendar({ ...calendar, ...patch }); // optimistic
    await supabase.from('game_calendar' as any).update(patch).eq('id', true);
  };

  const update = async (patch: Partial<GameCalendar>) => {
    if (calendar) setCalendar({ ...calendar, ...patch });
    await supabase.from('game_calendar' as any).update(patch).eq('id', true);
  };

  const addSpecialDay = async (sd: Omit<SpecialDay, 'id'>) => {
    const { data, error } = await supabase.from('calendar_special_days' as any).insert(sd).select().single();
    if (!error && data) setSpecialDays(prev => [...prev, data as any]);
  };

  const deleteSpecialDay = async (id: string) => {
    setSpecialDays(prev => prev.filter(s => s.id !== id));
    await supabase.from('calendar_special_days' as any).delete().eq('id', id);
  };

  return (
    <CalendarContext.Provider value={{ calendar, specialDays, loading, shift, update, addSpecialDay, deleteSpecialDay, reload: load }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be inside CalendarProvider');
  return ctx;
}
