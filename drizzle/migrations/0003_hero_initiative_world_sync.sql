CREATE OR REPLACE FUNCTION public.add_initiative_for_hero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.initiative_entries (name, value, source, hero_id, world_id)
  VALUES (NEW.name, 0, 'hero', NEW.id, NEW.world_id)
  ON CONFLICT (hero_id) WHERE hero_id IS NOT NULL DO UPDATE
    SET name = EXCLUDED.name, world_id = EXCLUDED.world_id;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.sync_hero_initiative_world()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.initiative_entries SET name = NEW.name, world_id = NEW.world_id
  WHERE hero_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_hero_initiative_world() FROM PUBLIC;
CREATE TRIGGER hero_initiative_world_sync AFTER UPDATE OF name, world_id ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.sync_hero_initiative_world();