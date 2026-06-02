
-- 1) profiles: restrict SELECT to own row or admin
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Users read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2) heroes: prevent non-admins from changing is_admin
CREATE OR REPLACE FUNCTION public.protect_hero_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins may change is_admin';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_hero_is_admin_trg ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_trg
  BEFORE UPDATE ON public.heroes
  FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin();

-- Also block setting is_admin=true on insert by non-admins
CREATE OR REPLACE FUNCTION public.protect_hero_is_admin_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin = true AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_hero_is_admin_ins_trg ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_ins_trg
  BEFORE INSERT ON public.heroes
  FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin_insert();

-- 3) map_beasts: viewers only see revealed beasts
DROP POLICY IF EXISTS "Anyone can read map_beasts" ON public.map_beasts;
CREATE POLICY "Read revealed beasts or editors"
  ON public.map_beasts FOR SELECT
  USING (revealed = true OR public.can_write_data(auth.uid()));

-- 4) special_map_points: respect visible_to_viewers
DROP POLICY IF EXISTS "Anyone can read special_map_points" ON public.special_map_points;
CREATE POLICY "Read visible points or editors"
  ON public.special_map_points FOR SELECT
  USING (visible_to_viewers = true OR public.can_write_data(auth.uid()));

-- 5) storage: add UPDATE policy for map images
DROP POLICY IF EXISTS "Editors can update map images" ON storage.objects;
CREATE POLICY "Editors can update map images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'map-images' AND public.can_write_data(auth.uid()));

-- 6) storage: remove broad listing on public buckets (public URLs still work)
DROP POLICY IF EXISTS "Anyone can read npc images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view map images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view monster images" ON storage.objects;

-- 7) realtime.messages: add explicit policy for authenticated users
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

-- 8) Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write_data(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_initiative_on_hero_delete() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_initiative_on_battle_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.remove_map_beast_on_death() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.add_initiative_for_hero() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.add_initiative_for_beast() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_hero_is_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_hero_is_admin_insert() FROM anon, authenticated, public;
-- assign_default_role must remain callable by authenticated (client RPC)
GRANT EXECUTE ON FUNCTION public.assign_default_role(uuid) TO authenticated;
