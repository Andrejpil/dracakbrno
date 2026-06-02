
-- Dedupe existing initiative entries before adding unique indexes
DELETE FROM public.initiative_entries a
USING public.initiative_entries b
WHERE a.ctid < b.ctid
  AND a.hero_id IS NOT NULL
  AND a.hero_id = b.hero_id;

DELETE FROM public.initiative_entries a
USING public.initiative_entries b
WHERE a.ctid < b.ctid
  AND a.battle_monster_id IS NOT NULL
  AND a.battle_monster_id = b.battle_monster_id;

CREATE UNIQUE INDEX IF NOT EXISTS initiative_entries_hero_uniq
  ON public.initiative_entries (hero_id) WHERE hero_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS initiative_entries_beast_uniq
  ON public.initiative_entries (battle_monster_id) WHERE battle_monster_id IS NOT NULL;

-- Auto-insert initiative for new hero
CREATE OR REPLACE FUNCTION public.add_initiative_for_hero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.initiative_entries (name, value, source, hero_id)
  VALUES (NEW.name, 0, 'hero', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_add_initiative_for_hero ON public.heroes;
CREATE TRIGGER trg_add_initiative_for_hero
AFTER INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_hero();

-- Auto-insert initiative for new battle monster
CREATE OR REPLACE FUNCTION public.add_initiative_for_beast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.initiative_entries (name, value, source, battle_monster_id)
  VALUES (NEW.name || ' (úr.' || COALESCE(NEW.level, 1) || ')', 0, 'beast', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_add_initiative_for_beast ON public.battle_monsters;
CREATE TRIGGER trg_add_initiative_for_beast
AFTER INSERT ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_beast();

-- Death triggers
CREATE OR REPLACE FUNCTION public.remove_map_beast_on_death()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.current_hp <= 0 AND (OLD.current_hp IS NULL OR OLD.current_hp > 0) THEN
    DELETE FROM public.map_beasts WHERE battle_id = NEW.battle_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_remove_map_beast_on_death ON public.battle_monsters;
CREATE TRIGGER trg_remove_map_beast_on_death
AFTER UPDATE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.remove_map_beast_on_death();

DROP TRIGGER IF EXISTS trg_cleanup_initiative_on_battle_change ON public.battle_monsters;
CREATE TRIGGER trg_cleanup_initiative_on_battle_change
AFTER UPDATE OR DELETE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_battle_change();

DROP TRIGGER IF EXISTS trg_cleanup_initiative_on_hero_delete ON public.heroes;
CREATE TRIGGER trg_cleanup_initiative_on_hero_delete
AFTER DELETE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_hero_delete();
