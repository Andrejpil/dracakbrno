
-- =============== WORLDS INFRASTRUCTURE ===============

CREATE TABLE public.worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worlds TO authenticated;
GRANT ALL ON public.worlds TO service_role;
ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.world_members (
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'viewer' CHECK (member_role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_members TO authenticated;
GRANT ALL ON public.world_members TO service_role;
ALTER TABLE public.world_members ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_world_member(_world_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worlds WHERE id = _world_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.world_members WHERE world_id = _world_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_world_editor(_world_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worlds WHERE id = _world_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.world_members
    WHERE world_id = _world_id AND user_id = _user_id AND member_role = 'editor'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_world_owner(_world_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.worlds WHERE id = _world_id AND owner_id = _user_id)
$$;

-- RLS: worlds
CREATE POLICY "read worlds you belong to" ON public.worlds FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_world_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "any authenticated can create own world" ON public.worlds FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner or admin can update world" ON public.worlds FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can delete world" ON public.worlds FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS: world_members
CREATE POLICY "members read own memberships" ON public.world_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_world_owner(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner manages members" ON public.world_members FOR INSERT TO authenticated
  WITH CHECK (public.is_world_owner(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner updates members" ON public.world_members FOR UPDATE TO authenticated
  USING (public.is_world_owner(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_world_owner(world_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner removes members" ON public.world_members FOR DELETE TO authenticated
  USING (public.is_world_owner(world_id, auth.uid()) OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER worlds_touch BEFORE UPDATE ON public.worlds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== SEED "Hlavní svět" ===============
INSERT INTO public.worlds (id, name, description, owner_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Hlavní svět',
  'Původní svět s veškerým dosavadním obsahem.',
  'b2178436-ba78-494a-b748-0c572f94ec6f'
);

-- Add all existing users as viewers of the main world so nothing "disappears" for them.
INSERT INTO public.world_members (world_id, user_id, member_role)
SELECT '00000000-0000-0000-0000-000000000001', u.id,
  CASE WHEN public.can_write_data(u.id) THEN 'editor' ELSE 'viewer' END
FROM auth.users u
WHERE u.id <> 'b2178436-ba78-494a-b748-0c572f94ec6f'
ON CONFLICT DO NOTHING;

-- =============== ADD world_id TO ALL GAME TABLES ===============
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'heroes','monsters','npcs','npc_names','npc_races','maps','traits',
    'chronicle_entries','calendar_special_days',
    'map_points','map_routes','map_settings','map_tokens','special_map_points',
    'map_beasts','map_fog_reveals',
    'battle_monsters','initiative_entries','monster_kills','xp_archive'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS world_id uuid REFERENCES public.worlds(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET world_id = %L WHERE world_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN world_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN world_id SET DEFAULT %L', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(world_id)', t || '_world_id_idx', t);
  END LOOP;
END $$;

-- battle_state has PK on some_singleton_id; add world_id per-world
ALTER TABLE public.battle_state ADD COLUMN IF NOT EXISTS world_id uuid REFERENCES public.worlds(id) ON DELETE CASCADE;
UPDATE public.battle_state SET world_id = '00000000-0000-0000-0000-000000000001' WHERE world_id IS NULL;
ALTER TABLE public.battle_state ALTER COLUMN world_id SET NOT NULL;
ALTER TABLE public.battle_state ALTER COLUMN world_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- game_calendar: convert from singleton to per-world
ALTER TABLE public.game_calendar DROP CONSTRAINT IF EXISTS single_row;
ALTER TABLE public.game_calendar ADD COLUMN IF NOT EXISTS world_id uuid REFERENCES public.worlds(id) ON DELETE CASCADE;
UPDATE public.game_calendar SET world_id = '00000000-0000-0000-0000-000000000001' WHERE world_id IS NULL;
ALTER TABLE public.game_calendar ALTER COLUMN world_id SET NOT NULL;
ALTER TABLE public.game_calendar ALTER COLUMN world_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE UNIQUE INDEX IF NOT EXISTS game_calendar_world_uidx ON public.game_calendar(world_id);
