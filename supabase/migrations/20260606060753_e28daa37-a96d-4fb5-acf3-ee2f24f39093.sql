
-- 1. Races table
CREATE TABLE public.npc_races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_races TO authenticated;
GRANT ALL ON public.npc_races TO service_role;
ALTER TABLE public.npc_races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads npc_races" ON public.npc_races FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert npc_races" ON public.npc_races FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()));
CREATE POLICY "Editors update npc_races" ON public.npc_races FOR UPDATE TO authenticated USING (public.can_write_data(auth.uid()));
CREATE POLICY "Editors delete npc_races" ON public.npc_races FOR DELETE TO authenticated USING (public.can_write_data(auth.uid()));

INSERT INTO public.npc_races (code, label, sort_order) VALUES
  ('Člověk', 'Člověk', 1),
  ('Elf', 'Elf', 2),
  ('Trpaslík', 'Trpaslík', 3),
  ('Barbar', 'Barbar', 4),
  ('Gnóm', 'Gnóm', 5),
  ('Hobit', 'Hobit', 6),
  ('Obr', 'Obr', 7);

-- 2. Names table
CREATE TABLE public.npc_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL,
  part text NOT NULL CHECK (part IN ('first','last')),
  gender text NOT NULL CHECK (gender IN ('male','female','unisex')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (value, part, gender)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_names TO authenticated;
GRANT ALL ON public.npc_names TO service_role;
ALTER TABLE public.npc_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads npc_names" ON public.npc_names FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert npc_names" ON public.npc_names FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()));
CREATE POLICY "Editors update npc_names" ON public.npc_names FOR UPDATE TO authenticated USING (public.can_write_data(auth.uid()));
CREATE POLICY "Editors delete npc_names" ON public.npc_names FOR DELETE TO authenticated USING (public.can_write_data(auth.uid()));

-- 3. Many-to-many link
CREATE TABLE public.npc_name_races (
  name_id uuid NOT NULL REFERENCES public.npc_names(id) ON DELETE CASCADE,
  race_id uuid NOT NULL REFERENCES public.npc_races(id) ON DELETE CASCADE,
  PRIMARY KEY (name_id, race_id)
);
CREATE INDEX idx_npc_name_races_race ON public.npc_name_races(race_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_name_races TO authenticated;
GRANT ALL ON public.npc_name_races TO service_role;
ALTER TABLE public.npc_name_races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads npc_name_races" ON public.npc_name_races FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors insert npc_name_races" ON public.npc_name_races FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()));
CREATE POLICY "Editors delete npc_name_races" ON public.npc_name_races FOR DELETE TO authenticated USING (public.can_write_data(auth.uid()));

-- 4. Migrate existing data
INSERT INTO public.npc_names (value, part, gender)
SELECT DISTINCT value, part, gender FROM public.npc_name_parts
ON CONFLICT DO NOTHING;

INSERT INTO public.npc_name_races (name_id, race_id)
SELECT DISTINCT nn.id, nr.id
FROM public.npc_name_parts p
JOIN public.npc_names nn
  ON nn.value = p.value AND nn.part = p.part AND nn.gender = p.gender
JOIN public.npc_races nr ON nr.code = p.race
ON CONFLICT DO NOTHING;

-- 5. Drop old table
DROP TABLE public.npc_name_parts;
