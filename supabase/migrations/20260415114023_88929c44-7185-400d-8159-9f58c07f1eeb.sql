
-- Create maps table
CREATE TABLE public.maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maps" ON public.maps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert maps" ON public.maps FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update maps" ON public.maps FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete maps" ON public.maps FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('map-images', 'map-images', true);

CREATE POLICY "Anyone can view map images" ON storage.objects FOR SELECT USING (bucket_id = 'map-images');
CREATE POLICY "Editors can upload map images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'map-images' AND can_write_data(auth.uid()));
CREATE POLICY "Editors can delete map images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'map-images' AND can_write_data(auth.uid()));
