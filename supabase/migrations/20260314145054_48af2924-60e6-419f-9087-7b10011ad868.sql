
-- Table for map routes (paths/journeys)
CREATE TABLE public.map_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Nová trasa',
  color text NOT NULL DEFAULT '#ff0000',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own map_routes" ON public.map_routes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for points on a route
CREATE TABLE public.map_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.map_routes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  x double precision NOT NULL,
  y double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own map_points" ON public.map_points
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for map settings (scale, speeds)
CREATE TABLE public.map_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pixels_per_km double precision NOT NULL DEFAULT 10,
  speed_walk double precision NOT NULL DEFAULT 5,
  speed_horse double precision NOT NULL DEFAULT 15,
  speed_broom double precision NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own map_settings" ON public.map_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
