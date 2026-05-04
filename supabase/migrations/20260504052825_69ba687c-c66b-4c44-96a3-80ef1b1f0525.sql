ALTER TABLE public.maps REPLICA IDENTITY FULL;
ALTER TABLE public.map_settings REPLICA IDENTITY FULL;
ALTER TABLE public.battle_monsters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_monsters;