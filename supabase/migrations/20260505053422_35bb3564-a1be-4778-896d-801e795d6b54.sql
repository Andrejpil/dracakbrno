
-- Monsters: min/max for attributes + HP multiplier
ALTER TABLE public.monsters
  ADD COLUMN IF NOT EXISTS str_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS str_max integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS con_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS con_max integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dex_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dex_max integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS int_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS int_max integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cha_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cha_max integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hp_multiplier double precision NOT NULL DEFAULT 1.0;

-- Backfill min/max from existing single value
UPDATE public.monsters SET 
  str_min = COALESCE(NULLIF(str_min,0), str), str_max = COALESCE(NULLIF(str_max,0), str),
  con_min = COALESCE(NULLIF(con_min,0), con), con_max = COALESCE(NULLIF(con_max,0), con),
  dex_min = COALESCE(NULLIF(dex_min,0), dex), dex_max = COALESCE(NULLIF(dex_max,0), dex),
  int_min = COALESCE(NULLIF(int_min,0), int), int_max = COALESCE(NULLIF(int_max,0), int),
  cha_min = COALESCE(NULLIF(cha_min,0), cha), cha_max = COALESCE(NULLIF(cha_max,0), cha);

-- Heroes: good/bad trait
ALTER TABLE public.heroes
  ADD COLUMN IF NOT EXISTS good_trait integer,
  ADD COLUMN IF NOT EXISTS bad_trait integer;

-- Traits table
CREATE TABLE IF NOT EXISTS public.traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('good','bad')),
  number integer NOT NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, number)
);

ALTER TABLE public.traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads traits" ON public.traits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert traits" ON public.traits FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors update traits" ON public.traits FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors delete traits" ON public.traits FOR DELETE TO authenticated USING (can_write_data(auth.uid()));
