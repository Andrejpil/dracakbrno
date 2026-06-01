-- 1) heroes.is_admin
ALTER TABLE public.heroes ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2) initiative_entries
CREATE TABLE IF NOT EXISTS public.initiative_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'npc', -- 'hero' | 'npc' | 'beast'
  hero_id UUID,
  battle_monster_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.initiative_entries TO authenticated;
GRANT ALL ON public.initiative_entries TO service_role;

ALTER TABLE public.initiative_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads initiative" ON public.initiative_entries;
DROP POLICY IF EXISTS "Editors insert initiative" ON public.initiative_entries;
DROP POLICY IF EXISTS "Editors update initiative" ON public.initiative_entries;
DROP POLICY IF EXISTS "Editors delete initiative" ON public.initiative_entries;

CREATE POLICY "Anyone reads initiative" ON public.initiative_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert initiative" ON public.initiative_entries
  FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors update initiative" ON public.initiative_entries
  FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors delete initiative" ON public.initiative_entries
  FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

ALTER TABLE public.initiative_entries REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.initiative_entries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 3) Cleanup triggers
CREATE OR REPLACE FUNCTION public.cleanup_initiative_on_battle_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.initiative_entries WHERE battle_monster_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.current_hp <= 0 AND (OLD.current_hp IS NULL OR OLD.current_hp > 0) THEN
    DELETE FROM public.initiative_entries WHERE battle_monster_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battle_monster_cleanup_initiative ON public.battle_monsters;
CREATE TRIGGER battle_monster_cleanup_initiative
AFTER UPDATE OR DELETE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_battle_change();

CREATE OR REPLACE FUNCTION public.cleanup_initiative_on_hero_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.initiative_entries WHERE hero_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS hero_cleanup_initiative ON public.heroes;
CREATE TRIGGER hero_cleanup_initiative
AFTER DELETE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_hero_delete();