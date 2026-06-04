CREATE OR REPLACE FUNCTION public.add_initiative_for_beast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.initiative_entries (name, value, source, battle_monster_id)
  VALUES (NEW.name || ' (úr.' || COALESCE(NEW.level, 1) || ')', 0, 'beast', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_initiative_on_battle_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

CREATE OR REPLACE FUNCTION public.remove_map_beast_on_death()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.current_hp <= 0 AND (OLD.current_hp IS NULL OR OLD.current_hp > 0) THEN
    DELETE FROM public.map_beasts WHERE battle_id = NEW.battle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_initiative_for_beast_trg ON public.battle_monsters;
CREATE TRIGGER add_initiative_for_beast_trg
AFTER INSERT ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_beast();

DROP TRIGGER IF EXISTS cleanup_initiative_on_battle_change_trg ON public.battle_monsters;
CREATE TRIGGER cleanup_initiative_on_battle_change_trg
AFTER UPDATE OR DELETE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_battle_change();

DROP TRIGGER IF EXISTS remove_map_beast_on_death_trg ON public.battle_monsters;
CREATE TRIGGER remove_map_beast_on_death_trg
AFTER UPDATE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.remove_map_beast_on_death();

WITH orphan_map_beasts AS (
  SELECT mb.*, m.str, m.con, m.dex, m.int, m.cha, m.mp, m.attack, m.defense, m.xp_reward, m.special, m.image_url
  FROM public.map_beasts mb
  LEFT JOIN public.monsters m ON m.id = mb.monster_id
  WHERE mb.battle_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.battle_monsters bm WHERE bm.battle_id = mb.battle_id
    )
)
INSERT INTO public.battle_monsters (
  user_id, monster_id, battle_id, name,
  str, con, dex, int, cha,
  hp, mp, attack, defense, xp_reward, special,
  current_hp, current_mp, level, image_url
)
SELECT
  created_by,
  monster_id,
  battle_id,
  name,
  COALESCE(str, 10),
  COALESCE(con, 10),
  COALESCE(dex, 10),
  COALESCE(int, 10),
  COALESCE(cha, 10),
  hp,
  COALESCE(mp, 0),
  COALESCE(attack, 0),
  COALESCE(defense, 0),
  COALESCE(xp_reward, 0),
  COALESCE(special, ''),
  current_hp,
  COALESCE(mp, 0),
  level,
  COALESCE(image_url, '')
FROM orphan_map_beasts;

INSERT INTO public.initiative_entries (name, value, source, battle_monster_id)
SELECT bm.name || ' (úr.' || COALESCE(bm.level, 1) || ')', 0, 'beast', bm.id
FROM public.battle_monsters bm
WHERE bm.current_hp > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.initiative_entries i WHERE i.battle_monster_id = bm.id
  );