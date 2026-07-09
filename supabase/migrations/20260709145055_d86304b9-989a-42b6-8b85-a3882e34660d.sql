
-- Enum for location types
DO $$ BEGIN
  CREATE TYPE public.price_location_type AS ENUM ('city','town','village','hamlet','fortress','market');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.economy_state AS ENUM ('normal','mobilization','war','famine','plague','festival','trade_boom','embargo','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) price_locations
CREATE TABLE public.price_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.price_location_type NOT NULL DEFAULT 'village',
  price_modifier_pct integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_locations TO authenticated;
GRANT ALL ON public.price_locations TO service_role;
ALTER TABLE public.price_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read price_locations" ON public.price_locations FOR SELECT
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Editors write price_locations" ON public.price_locations FOR ALL
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX price_locations_world_idx ON public.price_locations(world_id);

-- 2) price_items
CREATE TABLE public.price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  base_price_copper integer NOT NULL DEFAULT 0,
  unit text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_items TO authenticated;
GRANT ALL ON public.price_items TO service_role;
ALTER TABLE public.price_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read price_items" ON public.price_items FOR SELECT
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Editors write price_items" ON public.price_items FOR ALL
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX price_items_world_idx ON public.price_items(world_id);

-- 3) price_item_locations
CREATE TABLE public.price_item_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.price_locations(id) ON DELETE CASCADE,
  override_modifier_pct integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_item_locations TO authenticated;
GRANT ALL ON public.price_item_locations TO service_role;
ALTER TABLE public.price_item_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read pil" ON public.price_item_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.price_items i WHERE i.id = item_id
                 AND (public.is_world_editor(i.world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Editors write pil" ON public.price_item_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.price_items i WHERE i.id = item_id
                 AND (public.is_world_editor(i.world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.price_items i WHERE i.id = item_id
                 AND (public.is_world_editor(i.world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))));

-- 4) world_economy
CREATE TABLE public.world_economy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL UNIQUE REFERENCES public.worlds(id) ON DELETE CASCADE,
  state public.economy_state NOT NULL DEFAULT 'normal',
  custom_modifier_pct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_economy TO authenticated;
GRANT ALL ON public.world_economy TO service_role;
ALTER TABLE public.world_economy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read economy" ON public.world_economy FOR SELECT
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Editors write economy" ON public.world_economy FOR ALL
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Updated-at triggers
CREATE TRIGGER trg_price_locations_updated BEFORE UPDATE ON public.price_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_price_items_updated BEFORE UPDATE ON public.price_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_world_economy_updated BEFORE UPDATE ON public.world_economy
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed role_permissions for 'pricing'
INSERT INTO public.role_permissions (role, page, can_view, can_edit) VALUES
  ('admin','pricing',true,true),
  ('editor','pricing',true,true),
  ('viewer','pricing',false,false)
ON CONFLICT (role, page) DO NOTHING;
