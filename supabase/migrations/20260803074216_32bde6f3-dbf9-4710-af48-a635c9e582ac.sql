CREATE TABLE public.world_economy_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  modifier_pct integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_economy_states TO authenticated;
GRANT ALL ON public.world_economy_states TO service_role;

ALTER TABLE public.world_economy_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read economy states in own world"
ON public.world_economy_states FOR SELECT TO authenticated
USING (public.is_world_member(world_id, auth.uid()) AND public.can_write_data(auth.uid()));

CREATE POLICY "Editors manage economy states"
ON public.world_economy_states FOR ALL TO authenticated
USING (public.is_world_member(world_id, auth.uid()) AND public.can_write_data(auth.uid()))
WITH CHECK (public.is_world_member(world_id, auth.uid()) AND public.can_write_data(auth.uid()));

CREATE TRIGGER touch_world_economy_states
BEFORE UPDATE ON public.world_economy_states
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.world_economy ADD COLUMN IF NOT EXISTS active_state_code text;