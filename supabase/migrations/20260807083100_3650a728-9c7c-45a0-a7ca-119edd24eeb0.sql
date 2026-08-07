
-- =========================================================
-- 1. SETTLEMENT EXTRA ATTRIBUTES
-- =========================================================
ALTER TABLE public.price_locations
  ADD COLUMN IF NOT EXISTS size integer,
  ADD COLUMN IF NOT EXISTS wealth integer,
  ADD COLUMN IF NOT EXISTS region text;

-- =========================================================
-- 2. SETTLEMENT TAGS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.price_settlement_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_settlement_tags TO authenticated;
GRANT ALL ON public.price_settlement_tags TO service_role;
ALTER TABLE public.price_settlement_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read price_settlement_tags" ON public.price_settlement_tags
  FOR SELECT TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors write price_settlement_tags" ON public.price_settlement_tags
  FOR ALL TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_price_settlement_tags_updated BEFORE UPDATE ON public.price_settlement_tags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.price_settlement_tag_map (
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.price_locations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.price_settlement_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_pstm_tag ON public.price_settlement_tag_map(tag_id);
CREATE INDEX IF NOT EXISTS idx_pstm_world ON public.price_settlement_tag_map(world_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_settlement_tag_map TO authenticated;
GRANT ALL ON public.price_settlement_tag_map TO service_role;
ALTER TABLE public.price_settlement_tag_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read pstm" ON public.price_settlement_tag_map
  FOR SELECT TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors write pstm" ON public.price_settlement_tag_map
  FOR ALL TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. AVAILABILITY PROFILES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.price_availability_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  note text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, code)
);
CREATE INDEX IF NOT EXISTS idx_pap_rules ON public.price_availability_profiles USING gin (rules);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_availability_profiles TO authenticated;
GRANT ALL ON public.price_availability_profiles TO service_role;
ALTER TABLE public.price_availability_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read pap" ON public.price_availability_profiles
  FOR SELECT TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors write pap" ON public.price_availability_profiles
  FOR ALL TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pap_updated BEFORE UPDATE ON public.price_availability_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4. CATEGORIES (hierarchy + default profile)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.price_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.price_categories(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  default_profile_id uuid REFERENCES public.price_availability_profiles(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, code)
);
CREATE INDEX IF NOT EXISTS idx_pc_parent ON public.price_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_pc_world ON public.price_categories(world_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_categories TO authenticated;
GRANT ALL ON public.price_categories TO service_role;
ALTER TABLE public.price_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read pc" ON public.price_categories
  FOR SELECT TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors write pc" ON public.price_categories
  FOR ALL TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.price_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 5. ITEMS: category_id + profile + subcategory
-- =========================================================
ALTER TABLE public.price_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.price_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_profile_id uuid REFERENCES public.price_availability_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pi_category ON public.price_items(category_id);
CREATE INDEX IF NOT EXISTS idx_pi_profile ON public.price_items(availability_profile_id);
CREATE INDEX IF NOT EXISTS idx_pi_world_mode ON public.price_items(world_id, availability_mode);
CREATE INDEX IF NOT EXISTS idx_pi_world_code ON public.price_items(world_id, code);

-- backfill categories from existing free-text category
INSERT INTO public.price_categories (world_id, code, name)
SELECT DISTINCT i.world_id, public.pricing_slug(i.category), i.category
FROM public.price_items i
WHERE i.category IS NOT NULL AND btrim(i.category) <> ''
  AND public.pricing_slug(i.category) IS NOT NULL
ON CONFLICT (world_id, code) DO NOTHING;

UPDATE public.price_items i
SET category_id = c.id
FROM public.price_categories c
WHERE i.category_id IS NULL
  AND c.world_id = i.world_id
  AND c.code = public.pricing_slug(i.category);

-- =========================================================
-- 6. ITEM EXCEPTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.price_item_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.price_locations(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'ALLOW',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, item_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_pie_item ON public.price_item_exceptions(item_id);
CREATE INDEX IF NOT EXISTS idx_pie_location ON public.price_item_exceptions(location_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_item_exceptions TO authenticated;
GRANT ALL ON public.price_item_exceptions TO service_role;
ALTER TABLE public.price_item_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read pie" ON public.price_item_exceptions
  FOR SELECT TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors write pie" ON public.price_item_exceptions
  FOR ALL TO authenticated USING (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_world_editor(world_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.price_item_exceptions_action_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.action NOT IN ('ALLOW','DENY') THEN
    RAISE EXCEPTION 'action must be ALLOW or DENY';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pie_action BEFORE INSERT OR UPDATE ON public.price_item_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.price_item_exceptions_action_check();

-- =========================================================
-- 7. SERVER-SIDE AVAILABILITY LOGIC
-- =========================================================
CREATE OR REPLACE FUNCTION public.price_profile_settlements(_profile_id uuid)
RETURNS TABLE(location_id uuid, name text, code text)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH p AS (SELECT world_id, rules FROM price_availability_profiles WHERE id = _profile_id)
  SELECT l.id, l.name, l.code
  FROM price_locations l, p
  WHERE l.world_id = p.world_id
    AND (COALESCE(jsonb_array_length(p.rules->'type_codes'),0) = 0
         OR COALESCE(l.type_code, l.type::text) IN (SELECT jsonb_array_elements_text(p.rules->'type_codes')))
    AND (p.rules->>'size_min' IS NULL OR COALESCE(l.size,0) >= (p.rules->>'size_min')::int)
    AND (p.rules->>'size_max' IS NULL OR COALESCE(l.size,0) <= (p.rules->>'size_max')::int)
    AND (p.rules->>'wealth_min' IS NULL OR COALESCE(l.wealth,0) >= (p.rules->>'wealth_min')::int)
    AND (p.rules->>'wealth_max' IS NULL OR COALESCE(l.wealth,0) <= (p.rules->>'wealth_max')::int)
    AND (COALESCE(jsonb_array_length(p.rules->'regions_in'),0) = 0
         OR COALESCE(l.region,'') IN (SELECT jsonb_array_elements_text(p.rules->'regions_in')))
    AND (COALESCE(jsonb_array_length(p.rules->'regions_not_in'),0) = 0
         OR COALESCE(l.region,'') NOT IN (SELECT jsonb_array_elements_text(p.rules->'regions_not_in')))
    AND (COALESCE(jsonb_array_length(p.rules->'tags_any'),0) = 0
         OR EXISTS (SELECT 1 FROM price_settlement_tag_map m JOIN price_settlement_tags t ON t.id = m.tag_id
                    WHERE m.location_id = l.id
                      AND t.code IN (SELECT jsonb_array_elements_text(p.rules->'tags_any'))))
    AND (COALESCE(jsonb_array_length(p.rules->'tags_all'),0) = 0
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.rules->'tags_all') req
                        WHERE NOT EXISTS (SELECT 1 FROM price_settlement_tag_map m JOIN price_settlement_tags t ON t.id = m.tag_id
                                          WHERE m.location_id = l.id AND t.code = req)))
    AND NOT EXISTS (SELECT 1 FROM price_settlement_tag_map m JOIN price_settlement_tags t ON t.id = m.tag_id
                    WHERE m.location_id = l.id
                      AND t.code IN (SELECT jsonb_array_elements_text(COALESCE(p.rules->'tags_none','[]'::jsonb))));
$$;

CREATE OR REPLACE FUNCTION public.price_profile_preview(_profile_id uuid)
RETURNS TABLE(matched integer, total integer)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (SELECT count(*)::int FROM price_profile_settlements(_profile_id)),
         (SELECT count(*)::int FROM price_locations l
          WHERE l.world_id = (SELECT world_id FROM price_availability_profiles WHERE id = _profile_id));
$$;

-- resolve which profile an item uses and where it comes from
CREATE OR REPLACE FUNCTION public.price_item_profile(_item_id uuid)
RETURNS TABLE(profile_id uuid, source text)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE it record; cat record; lvl int := 0;
BEGIN
  SELECT * INTO it FROM price_items WHERE id = _item_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF it.availability_mode = 'PROFILE' AND it.availability_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT it.availability_profile_id, 'Vlastní profil položky'::text;
    RETURN;
  END IF;

  IF it.category_id IS NOT NULL THEN
    SELECT * INTO cat FROM price_categories WHERE id = it.category_id;
    WHILE FOUND AND lvl < 10 LOOP
      IF cat.default_profile_id IS NOT NULL THEN
        RETURN QUERY SELECT cat.default_profile_id, ('Kategorie „' || cat.name || '"')::text;
        RETURN;
      END IF;
      EXIT WHEN cat.parent_id IS NULL;
      SELECT * INTO cat FROM price_categories WHERE id = cat.parent_id;
      lvl := lvl + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT NULL::uuid, 'Bez profilu'::text;
END $$;

-- final availability of one item in one settlement (with explanation)
CREATE OR REPLACE FUNCTION public.price_item_available(_item_id uuid, _location_id uuid)
RETURNS TABLE(available boolean, source text)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE it record; ex record; pr record; hit boolean;
BEGIN
  SELECT * INTO it FROM price_items WHERE id = _item_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO ex FROM price_item_exceptions
   WHERE item_id = _item_id AND location_id = _location_id;
  IF FOUND THEN
    RETURN QUERY SELECT ex.action = 'ALLOW', 'Ruční výjimka'::text;
    RETURN;
  END IF;

  IF it.availability_mode = 'EVERYWHERE' THEN
    RETURN QUERY SELECT true, 'Nastavení položky: dostupné všude'::text; RETURN;
  ELSIF it.availability_mode = 'NOWHERE' THEN
    RETURN QUERY SELECT false, 'Nastavení položky: nedostupné nikde'::text; RETURN;
  ELSIF it.availability_mode = 'ONLY_SELECTED' THEN
    RETURN QUERY SELECT EXISTS (SELECT 1 FROM price_item_locations
                                WHERE item_id = _item_id AND location_id = _location_id),
                        'Nastavení položky: pouze vybraná sídla'::text; RETURN;
  ELSIF it.availability_mode = 'EXCEPT_SELECTED' THEN
    RETURN QUERY SELECT NOT EXISTS (SELECT 1 FROM price_item_locations
                                    WHERE item_id = _item_id AND location_id = _location_id),
                        'Nastavení položky: všude kromě vybraných'::text; RETURN;
  END IF;

  SELECT * INTO pr FROM price_item_profile(_item_id);
  IF pr.profile_id IS NULL THEN
    RETURN QUERY SELECT true, 'Výchozí pravidlo (bez profilu): dostupné všude'::text; RETURN;
  END IF;
  SELECT EXISTS (SELECT 1 FROM price_profile_settlements(pr.profile_id) s WHERE s.location_id = _location_id) INTO hit;
  RETURN QUERY SELECT hit,
    ('Profil „' || (SELECT name FROM price_availability_profiles WHERE id = pr.profile_id) || '" (' || pr.source || ')')::text;
END $$;

-- list of settlements where item is available
CREATE OR REPLACE FUNCTION public.price_item_settlements(_item_id uuid)
RETURNS TABLE(location_id uuid, name text, source text)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT l.id, l.name, a.source
  FROM price_locations l
  CROSS JOIN LATERAL price_item_available(_item_id, l.id) a
  WHERE l.world_id = (SELECT world_id FROM price_items WHERE id = _item_id)
    AND a.available
  ORDER BY l.name;
$$;

CREATE OR REPLACE FUNCTION public.price_item_availability_count(_item_id uuid)
RETURNS TABLE(matched integer, total integer)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (SELECT count(*)::int FROM price_item_settlements(_item_id)),
         (SELECT count(*)::int FROM price_locations l
          WHERE l.world_id = (SELECT world_id FROM price_items WHERE id = _item_id));
$$;

-- =========================================================
-- 8. SERVER-SIDE BULK OPERATIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.price_bulk_update_items(
  _world_id uuid,
  _ids uuid[],
  _search text,
  _category_id uuid,
  _mode_filter text,
  _patch jsonb
) RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH target AS (
    SELECT i.id FROM price_items i
    WHERE i.world_id = _world_id
      AND (_ids IS NULL OR i.id = ANY(_ids))
      AND (_search IS NULL OR _search = '' OR i.name ILIKE '%'||_search||'%' OR i.code ILIKE '%'||_search||'%')
      AND (_category_id IS NULL OR i.category_id = _category_id)
      AND (_mode_filter IS NULL OR _mode_filter = '' OR i.availability_mode = _mode_filter)
  )
  UPDATE price_items i SET
    availability_mode = COALESCE(_patch->>'availability_mode', i.availability_mode),
    availability_profile_id = CASE WHEN _patch ? 'availability_profile_id'
      THEN NULLIF(_patch->>'availability_profile_id','')::uuid ELSE i.availability_profile_id END,
    category_id = CASE WHEN _patch ? 'category_id'
      THEN NULLIF(_patch->>'category_id','')::uuid ELSE i.category_id END,
    category = CASE WHEN _patch ? 'category'
      THEN NULLIF(_patch->>'category','') ELSE i.category END
  FROM target t WHERE i.id = t.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.price_bulk_item_exceptions(
  _world_id uuid,
  _ids uuid[],
  _search text,
  _category_id uuid,
  _mode_filter text,
  _location_ids uuid[],
  _action text  -- 'ALLOW' | 'DENY' | 'REMOVE'
) RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  CREATE TEMP TABLE _tgt ON COMMIT DROP AS
    SELECT i.id FROM price_items i
    WHERE i.world_id = _world_id
      AND (_ids IS NULL OR i.id = ANY(_ids))
      AND (_search IS NULL OR _search = '' OR i.name ILIKE '%'||_search||'%' OR i.code ILIKE '%'||_search||'%')
      AND (_category_id IS NULL OR i.category_id = _category_id)
      AND (_mode_filter IS NULL OR _mode_filter = '' OR i.availability_mode = _mode_filter);

  IF _action = 'REMOVE' THEN
    DELETE FROM price_item_exceptions e
    USING _tgt t WHERE e.item_id = t.id AND e.location_id = ANY(_location_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    INSERT INTO price_item_exceptions (world_id, item_id, location_id, action)
    SELECT _world_id, t.id, l, _action FROM _tgt t CROSS JOIN unnest(_location_ids) l
    ON CONFLICT (world_id, item_id, location_id) DO UPDATE SET action = EXCLUDED.action;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.price_bulk_tag_settlements(
  _world_id uuid, _location_ids uuid[], _tag_id uuid, _add boolean
) RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF _add THEN
    INSERT INTO price_settlement_tag_map (world_id, location_id, tag_id)
    SELECT _world_id, l.id, _tag_id FROM price_locations l
    WHERE l.id = ANY(_location_ids) AND l.world_id = _world_id
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM price_settlement_tag_map
    WHERE tag_id = _tag_id AND location_id = ANY(_location_ids) AND world_id = _world_id;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
