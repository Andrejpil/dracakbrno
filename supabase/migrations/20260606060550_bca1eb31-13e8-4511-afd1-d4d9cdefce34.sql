
-- 1. Re-attach triggers that protect heroes.is_admin from editor escalation
DROP TRIGGER IF EXISTS protect_hero_is_admin_upd ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_upd
BEFORE UPDATE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin();

DROP TRIGGER IF EXISTS protect_hero_is_admin_ins ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_ins
BEFORE INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin_insert();

-- 2. Add a RESTRICTIVE policy that also blocks is_admin changes via RLS for non-admins
DROP POLICY IF EXISTS "Only admins change is_admin" ON public.heroes;
CREATE POLICY "Only admins change is_admin"
ON public.heroes
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR is_admin = false
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR is_admin = false
);

-- 3. Fix storage policy on map-images: scope to authenticated only
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%map image%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Editors can update map images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'map-images' AND public.can_write_data(auth.uid()))
WITH CHECK (bucket_id = 'map-images' AND public.can_write_data(auth.uid()));

CREATE POLICY "Editors can insert map images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'map-images' AND public.can_write_data(auth.uid()));

CREATE POLICY "Editors can delete map images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'map-images' AND public.can_write_data(auth.uid()));

CREATE POLICY "Anyone can read map images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'map-images');

-- 4. Remove tables from realtime publication so hidden rows are not broadcast
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'map_beasts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.map_beasts';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'special_map_points'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.special_map_points';
  END IF;
END $$;
