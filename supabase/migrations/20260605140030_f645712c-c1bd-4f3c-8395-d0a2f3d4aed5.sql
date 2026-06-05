
DROP POLICY IF EXISTS "Read visible points or editors" ON public.special_map_points;
CREATE POLICY "Read visible points or editors"
ON public.special_map_points
FOR SELECT
TO authenticated
USING ((visible_to_viewers = true) OR public.can_write_data(auth.uid()));
