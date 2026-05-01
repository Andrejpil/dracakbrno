-- 1) Special points: bind to map
ALTER TABLE public.special_map_points
  ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES public.maps(id) ON DELETE CASCADE;

-- 2) Maps: fog of war toggle + default radius
ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS fog_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_reveal_radius double precision NOT NULL DEFAULT 60;

-- 3) Map tokens (player characters on the map)
CREATE TABLE IF NOT EXISTS public.map_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  owner_user_id uuid,                       -- who can move this token (null = anyone)
  created_by uuid NOT NULL,                 -- admin who added it
  name text NOT NULL DEFAULT 'Postava',
  color text NOT NULL DEFAULT '#3b82f6',
  icon text NOT NULL DEFAULT 'user',        -- lucide icon name
  x double precision NOT NULL DEFAULT 50,
  y double precision NOT NULL DEFAULT 50,
  reveal_radius double precision NOT NULL DEFAULT 60,
  light_source text NOT NULL DEFAULT 'default', -- e.g. 'torch', 'lantern', 'light_spell'
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map_tokens"
  ON public.map_tokens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert map_tokens"
  ON public.map_tokens FOR INSERT TO authenticated
  WITH CHECK (public.can_write_data(auth.uid()));

CREATE POLICY "Editors can delete map_tokens"
  ON public.map_tokens FOR DELETE TO authenticated
  USING (public.can_write_data(auth.uid()));

-- Editors can update anything; owners can update only their own token (move it)
CREATE POLICY "Editors or owners can update map_tokens"
  ON public.map_tokens FOR UPDATE TO authenticated
  USING (public.can_write_data(auth.uid()) OR owner_user_id = auth.uid());

-- 4) Fog of war revealed areas (shared per map)
CREATE TABLE IF NOT EXISTS public.map_fog_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  radius double precision NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_fog_reveals_map ON public.map_fog_reveals(map_id);

ALTER TABLE public.map_fog_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map_fog_reveals"
  ON public.map_fog_reveals FOR SELECT TO authenticated USING (true);

-- Any authenticated user can add reveals (so viewers moving their token reveal map too)
CREATE POLICY "Authenticated can insert map_fog_reveals"
  ON public.map_fog_reveals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Editors can delete map_fog_reveals"
  ON public.map_fog_reveals FOR DELETE TO authenticated
  USING (public.can_write_data(auth.uid()));

-- 5) Enable realtime for live sync
ALTER TABLE public.map_tokens REPLICA IDENTITY FULL;
ALTER TABLE public.map_fog_reveals REPLICA IDENTITY FULL;
ALTER TABLE public.special_map_points REPLICA IDENTITY FULL;
ALTER TABLE public.map_routes REPLICA IDENTITY FULL;
ALTER TABLE public.map_points REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_fog_reveals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_map_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_routes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_points;