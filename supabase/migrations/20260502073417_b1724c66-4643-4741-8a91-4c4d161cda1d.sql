
-- 1. Add map_id to map_routes (global if NULL)
ALTER TABLE public.map_routes ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES public.maps(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_map_routes_map_id ON public.map_routes(map_id);

-- 2. Create map_beasts table (beast tokens placed on map by admin/editor)
CREATE TABLE IF NOT EXISTS public.map_beasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  monster_id uuid REFERENCES public.monsters(id) ON DELETE SET NULL,
  battle_id uuid,           -- pairs with battle_monsters.battle_id (logical id, not FK because that table uses battle_id default uuid)
  created_by uuid NOT NULL,
  short_code text NOT NULL DEFAULT '??',
  name text NOT NULL DEFAULT 'Bestie',
  level integer NOT NULL DEFAULT 1,
  hp integer NOT NULL DEFAULT 10,
  current_hp integer NOT NULL DEFAULT 10,
  color text NOT NULL DEFAULT '#dc2626',
  x double precision NOT NULL DEFAULT 50,
  y double precision NOT NULL DEFAULT 50,
  reveal_radius double precision NOT NULL DEFAULT 80,
  -- Whether this beast has been "seen" by players (revealed via discovery)
  revealed boolean NOT NULL DEFAULT false,
  -- 'none' = always visible when in fog reveal; 'manual' = stays hidden until admin reveals; 'auto' = reveals when player token is within reveal_radius
  stealth_mode text NOT NULL DEFAULT 'none',
  notes text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_beasts_map_id ON public.map_beasts(map_id);

ALTER TABLE public.map_beasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map_beasts" ON public.map_beasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert map_beasts" ON public.map_beasts FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update map_beasts" ON public.map_beasts FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete map_beasts" ON public.map_beasts FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_beasts;
ALTER TABLE public.map_beasts REPLICA IDENTITY FULL;

-- 3. Granular map permissions: seed permission rows for sub-pages
INSERT INTO public.role_permissions (role, page, can_view, can_edit) VALUES
  ('viewer', 'map_routes',  true,  false),
  ('viewer', 'map_special', true,  false),
  ('viewer', 'map_tokens',  true,  false),
  ('viewer', 'map_fog',     true,  false),
  ('viewer', 'map_beasts',  true,  false),
  ('editor', 'map_routes',  true,  true),
  ('editor', 'map_special', true,  true),
  ('editor', 'map_tokens',  true,  true),
  ('editor', 'map_fog',     true,  true),
  ('editor', 'map_beasts',  true,  true)
ON CONFLICT DO NOTHING;
