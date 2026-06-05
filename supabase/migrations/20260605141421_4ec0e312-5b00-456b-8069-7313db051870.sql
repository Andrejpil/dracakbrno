CREATE TABLE public.npc_name_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male','female')),
  part text NOT NULL CHECK (part IN ('first','last')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race, gender, part, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_name_parts TO authenticated;
GRANT ALL ON public.npc_name_parts TO service_role;

ALTER TABLE public.npc_name_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads npc_name_parts" ON public.npc_name_parts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors insert npc_name_parts" ON public.npc_name_parts
  FOR INSERT TO authenticated WITH CHECK (public.can_write_data(auth.uid()));

CREATE POLICY "Editors update npc_name_parts" ON public.npc_name_parts
  FOR UPDATE TO authenticated USING (public.can_write_data(auth.uid()));

CREATE POLICY "Editors delete npc_name_parts" ON public.npc_name_parts
  FOR DELETE TO authenticated USING (public.can_write_data(auth.uid()));

CREATE INDEX idx_npc_name_parts_lookup ON public.npc_name_parts(race, gender, part);
