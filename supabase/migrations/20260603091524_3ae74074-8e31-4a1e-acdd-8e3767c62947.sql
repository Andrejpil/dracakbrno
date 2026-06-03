
-- Re-attach missing triggers (only protect_hero_is_admin_trg exists)
DROP TRIGGER IF EXISTS add_initiative_for_hero_trg ON public.heroes;
CREATE TRIGGER add_initiative_for_hero_trg AFTER INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_hero();

DROP TRIGGER IF EXISTS cleanup_initiative_on_hero_delete_trg ON public.heroes;
CREATE TRIGGER cleanup_initiative_on_hero_delete_trg BEFORE DELETE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_hero_delete();

DROP TRIGGER IF EXISTS protect_hero_is_admin_insert_trg ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_insert_trg BEFORE INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin_insert();

DROP TRIGGER IF EXISTS add_initiative_for_beast_trg ON public.battle_monsters;
CREATE TRIGGER add_initiative_for_beast_trg AFTER INSERT ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_beast();

DROP TRIGGER IF EXISTS cleanup_initiative_on_battle_change_trg ON public.battle_monsters;
CREATE TRIGGER cleanup_initiative_on_battle_change_trg AFTER UPDATE OR DELETE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_battle_change();

DROP TRIGGER IF EXISTS remove_map_beast_on_death_trg ON public.battle_monsters;
CREATE TRIGGER remove_map_beast_on_death_trg AFTER UPDATE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.remove_map_beast_on_death();

-- Backfill: create missing initiative entries for existing heroes and alive battle monsters
INSERT INTO public.initiative_entries (name, value, source, hero_id)
SELECT h.name, 0, 'hero', h.id FROM public.heroes h
WHERE NOT EXISTS (SELECT 1 FROM public.initiative_entries i WHERE i.hero_id = h.id);

INSERT INTO public.initiative_entries (name, value, source, battle_monster_id)
SELECT bm.name || ' (úr.' || COALESCE(bm.level, 1) || ')', 0, 'beast', bm.id
FROM public.battle_monsters bm
WHERE bm.current_hp > 0
  AND NOT EXISTS (SELECT 1 FROM public.initiative_entries i WHERE i.battle_monster_id = bm.id);

-- Shared battle state (active initiative entry) so all clients can highlight active turn
CREATE TABLE IF NOT EXISTS public.battle_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  active_initiative_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.battle_state TO authenticated;
GRANT ALL ON public.battle_state TO service_role;
ALTER TABLE public.battle_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads battle_state" ON public.battle_state;
CREATE POLICY "Anyone reads battle_state" ON public.battle_state FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Editors insert battle_state" ON public.battle_state;
CREATE POLICY "Editors insert battle_state" ON public.battle_state FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()));
DROP POLICY IF EXISTS "Editors update battle_state" ON public.battle_state;
CREATE POLICY "Editors update battle_state" ON public.battle_state FOR UPDATE TO authenticated USING (public.can_write_data(auth.uid()));

INSERT INTO public.battle_state (id, active_initiative_id) VALUES (true, NULL) ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_state;
ALTER TABLE public.battle_state REPLICA IDENTITY FULL;
