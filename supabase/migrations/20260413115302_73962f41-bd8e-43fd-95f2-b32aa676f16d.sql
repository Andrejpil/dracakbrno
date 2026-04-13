CREATE TABLE public.special_map_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  visible_to_viewers BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.special_map_points ENABLE ROW LEVEL SECURITY;

-- All authenticated can read (filtering by visibility done in app code using role)
CREATE POLICY "Anyone can read special_map_points"
  ON public.special_map_points FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert special_map_points"
  ON public.special_map_points FOR INSERT
  TO authenticated
  WITH CHECK (can_write_data(auth.uid()));

CREATE POLICY "Editors can update special_map_points"
  ON public.special_map_points FOR UPDATE
  TO authenticated
  USING (can_write_data(auth.uid()));

CREATE POLICY "Editors can delete special_map_points"
  ON public.special_map_points FOR DELETE
  TO authenticated
  USING (can_write_data(auth.uid()));