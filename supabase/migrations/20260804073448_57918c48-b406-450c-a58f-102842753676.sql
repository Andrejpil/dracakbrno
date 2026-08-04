CREATE TABLE IF NOT EXISTS public.price_location_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  default_modifier_pct integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_location_types TO authenticated;
GRANT ALL ON public.price_location_types TO service_role;
ALTER TABLE public.price_location_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read price_location_types" ON public.price_location_types FOR SELECT TO authenticated
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Editors write price_location_types" ON public.price_location_types FOR ALL TO authenticated
  USING (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_world_editor(world_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS price_location_types_world_idx ON public.price_location_types(world_id);

CREATE OR REPLACE FUNCTION public.pricing_slug(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(
    trim(both '-' from regexp_replace(
      lower(translate(coalesce(_txt,''),
        'áäčďéěíľĺňóôöřŕšťúůüýžÁÄČĎÉĚÍĽĹŇÓÔÖŘŔŠŤÚŮÜÝŽ',
        'aacdeeillnooorrstuuuyzaacdeeillnooorrstuuuyz')),
      '[^a-z0-9]+', '-', 'g')), '');
$$;

ALTER TABLE public.price_locations
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS type_code text,
  ADD COLUMN IF NOT EXISTS uses_type_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.price_items
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS availability_mode text NOT NULL DEFAULT 'EVERYWHERE';

DO $$ BEGIN
  ALTER TABLE public.price_items ADD CONSTRAINT price_items_availability_mode_chk
    CHECK (availability_mode IN ('EVERYWHERE','ONLY_SELECTED','EXCEPT_SELECTED','NOWHERE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.price_location_types (world_id, code, label, default_modifier_pct, sort_order)
SELECT w.id, t.code, t.label, t.pct, t.ord
FROM public.worlds w
CROSS JOIN (VALUES
  ('city','Město',10,0),
  ('town','Městečko',5,1),
  ('village','Vesnice',0,2),
  ('hamlet','Osada',-10,3),
  ('fortress','Pevnost',15,4),
  ('market','Trh',-5,5),
  ('abbey','Opatství',0,6),
  ('port','Přístav',5,7),
  ('castle','Hrad',10,8),
  ('camp','Tábor',-5,9)
) AS t(code,label,pct,ord)
ON CONFLICT (world_id, code) DO NOTHING;

UPDATE public.price_locations SET type_code = type WHERE type_code IS NULL;

WITH numbered AS (
  SELECT id,
    coalesce(public.pricing_slug(name), 'sidlo') AS base,
    row_number() OVER (PARTITION BY world_id, coalesce(public.pricing_slug(name),'sidlo') ORDER BY created_at, id) AS rn
  FROM public.price_locations WHERE code IS NULL
)
UPDATE public.price_locations l SET code = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n WHERE l.id = n.id;

WITH numbered AS (
  SELECT id,
    coalesce(public.pricing_slug(name), 'polozka') AS base,
    row_number() OVER (PARTITION BY world_id, coalesce(public.pricing_slug(name),'polozka') ORDER BY created_at, id) AS rn
  FROM public.price_items WHERE code IS NULL
)
UPDATE public.price_items i SET code = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n WHERE i.id = n.id;

UPDATE public.price_items i SET availability_mode = 'ONLY_SELECTED'
WHERE EXISTS (SELECT 1 FROM public.price_item_locations il WHERE il.item_id = i.id);

CREATE UNIQUE INDEX IF NOT EXISTS price_locations_world_code_uidx ON public.price_locations(world_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS price_items_world_code_uidx ON public.price_items(world_id, code);
CREATE INDEX IF NOT EXISTS price_items_world_name_idx ON public.price_items(world_id, name);
CREATE INDEX IF NOT EXISTS price_items_world_category_idx ON public.price_items(world_id, category);
CREATE INDEX IF NOT EXISTS price_item_locations_item_idx ON public.price_item_locations(item_id);
CREATE INDEX IF NOT EXISTS price_item_locations_loc_idx ON public.price_item_locations(location_id);
CREATE INDEX IF NOT EXISTS price_locations_world_type_idx ON public.price_locations(world_id, type_code);

CREATE TRIGGER trg_price_location_types_updated BEFORE UPDATE ON public.price_location_types
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();