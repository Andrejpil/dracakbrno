
-- =============================================================
-- Tenant (world) isolation on SELECT policies
-- =============================================================

-- Helper: is_world_member already exists (world owner or member)
-- can_write_data(auth.uid()) grants editors/admins app-wide read.

-- battle_monsters
DROP POLICY IF EXISTS "Anyone can read battle_monsters" ON public.battle_monsters;
CREATE POLICY "Read battle_monsters in own world" ON public.battle_monsters
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- battle_state
DROP POLICY IF EXISTS "Anyone reads battle_state" ON public.battle_state;
CREATE POLICY "Read battle_state in own world" ON public.battle_state
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- calendar_special_days
DROP POLICY IF EXISTS "read special days" ON public.calendar_special_days;
CREATE POLICY "Read special days in own world" ON public.calendar_special_days
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- game_calendar
DROP POLICY IF EXISTS "read calendar" ON public.game_calendar;
CREATE POLICY "Read calendar in own world" ON public.game_calendar
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- heroes
DROP POLICY IF EXISTS "Anyone can read heroes" ON public.heroes;
CREATE POLICY "Read heroes in own world" ON public.heroes
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- initiative_entries
DROP POLICY IF EXISTS "Anyone reads initiative" ON public.initiative_entries;
CREATE POLICY "Read initiative in own world" ON public.initiative_entries
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- map_fog_reveals
DROP POLICY IF EXISTS "Anyone can read map_fog_reveals" ON public.map_fog_reveals;
CREATE POLICY "Read map_fog_reveals in own world" ON public.map_fog_reveals
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- map_points
DROP POLICY IF EXISTS "Anyone can read map_points" ON public.map_points;
CREATE POLICY "Read map_points in own world" ON public.map_points
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- map_routes
DROP POLICY IF EXISTS "Anyone can read map_routes" ON public.map_routes;
CREATE POLICY "Read map_routes in own world" ON public.map_routes
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- map_settings
DROP POLICY IF EXISTS "Anyone can read map_settings" ON public.map_settings;
CREATE POLICY "Read map_settings in own world" ON public.map_settings
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- map_tokens
DROP POLICY IF EXISTS "Anyone can read map_tokens" ON public.map_tokens;
CREATE POLICY "Read map_tokens in own world" ON public.map_tokens
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- maps
DROP POLICY IF EXISTS "Anyone can read maps" ON public.maps;
CREATE POLICY "Read maps in own world" ON public.maps
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- monsters
DROP POLICY IF EXISTS "Anyone can read monsters" ON public.monsters;
CREATE POLICY "Read monsters in own world" ON public.monsters
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- monster_kills
DROP POLICY IF EXISTS "Anyone can read monster_kills" ON public.monster_kills;
CREATE POLICY "Read monster_kills in own world" ON public.monster_kills
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- npcs
DROP POLICY IF EXISTS "Anyone can read npcs" ON public.npcs;
CREATE POLICY "Read npcs in own world" ON public.npcs
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- npc_names
DROP POLICY IF EXISTS "Anyone can read npc_names" ON public.npc_names;
CREATE POLICY "Read npc_names in own world" ON public.npc_names
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- npc_races
DROP POLICY IF EXISTS "Anyone can read npc_races" ON public.npc_races;
CREATE POLICY "Read npc_races in own world" ON public.npc_races
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- npc_name_races (join table without world_id — scope through parent npc_names)
DROP POLICY IF EXISTS "Anyone can read npc_name_races" ON public.npc_name_races;
CREATE POLICY "Read npc_name_races via parent name world" ON public.npc_name_races
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.npc_names n
      WHERE n.id = npc_name_races.name_id
        AND (public.is_world_member(n.world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- special_map_points
DROP POLICY IF EXISTS "Anyone can read special_map_points" ON public.special_map_points;
CREATE POLICY "Read special_map_points in own world" ON public.special_map_points
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- traits
DROP POLICY IF EXISTS "Anyone can read traits" ON public.traits;
CREATE POLICY "Read traits in own world" ON public.traits
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- xp_archive
DROP POLICY IF EXISTS "Anyone can read xp_archive" ON public.xp_archive;
CREATE POLICY "Read xp_archive in own world" ON public.xp_archive
  FOR SELECT TO authenticated
  USING (public.is_world_member(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- role_permissions: restrict read to admins/editors only
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.role_permissions;
CREATE POLICY "Staff read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.can_write_data(auth.uid()));

-- =============================================================
-- realtime.messages: restrict broadcast/presence to admins only
-- (app relies on postgres_changes, which is unaffected by this policy)
-- =============================================================
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Only admins can use realtime broadcast/presence"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
