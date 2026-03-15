
-- Function to check if user can write data (admin or editor)
CREATE OR REPLACE FUNCTION public.can_write_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'editor')
  )
$$;

-- HEROES: shared read, editors write
DROP POLICY IF EXISTS "Users manage own heroes" ON public.heroes;
CREATE POLICY "Anyone can read heroes" ON public.heroes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert heroes" ON public.heroes FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update heroes" ON public.heroes FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete heroes" ON public.heroes FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- MONSTERS: shared read, editors write
DROP POLICY IF EXISTS "Users manage own monsters" ON public.monsters;
CREATE POLICY "Anyone can read monsters" ON public.monsters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert monsters" ON public.monsters FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update monsters" ON public.monsters FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete monsters" ON public.monsters FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- BATTLE_MONSTERS: shared read, editors write
DROP POLICY IF EXISTS "Users manage own battle_monsters" ON public.battle_monsters;
CREATE POLICY "Anyone can read battle_monsters" ON public.battle_monsters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert battle_monsters" ON public.battle_monsters FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update battle_monsters" ON public.battle_monsters FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete battle_monsters" ON public.battle_monsters FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- MONSTER_KILLS: shared read, editors write
DROP POLICY IF EXISTS "Users manage own monster_kills" ON public.monster_kills;
CREATE POLICY "Anyone can read monster_kills" ON public.monster_kills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert monster_kills" ON public.monster_kills FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update monster_kills" ON public.monster_kills FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete monster_kills" ON public.monster_kills FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- XP_ARCHIVE: shared read, editors write
DROP POLICY IF EXISTS "Users manage own xp_archive" ON public.xp_archive;
CREATE POLICY "Anyone can read xp_archive" ON public.xp_archive FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert xp_archive" ON public.xp_archive FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update xp_archive" ON public.xp_archive FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete xp_archive" ON public.xp_archive FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- MAP_ROUTES: shared read, editors write
DROP POLICY IF EXISTS "Users manage own map_routes" ON public.map_routes;
CREATE POLICY "Anyone can read map_routes" ON public.map_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert map_routes" ON public.map_routes FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update map_routes" ON public.map_routes FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete map_routes" ON public.map_routes FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- MAP_POINTS: shared read, editors write
DROP POLICY IF EXISTS "Users manage own map_points" ON public.map_points;
CREATE POLICY "Anyone can read map_points" ON public.map_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert map_points" ON public.map_points FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update map_points" ON public.map_points FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete map_points" ON public.map_points FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- MAP_SETTINGS: shared read, editors write
DROP POLICY IF EXISTS "Users manage own map_settings" ON public.map_settings;
CREATE POLICY "Anyone can read map_settings" ON public.map_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert map_settings" ON public.map_settings FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update map_settings" ON public.map_settings FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete map_settings" ON public.map_settings FOR DELETE TO authenticated USING (can_write_data(auth.uid()));
