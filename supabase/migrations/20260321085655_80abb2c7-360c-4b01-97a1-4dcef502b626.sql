
-- NPC table
CREATE TABLE public.npcs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read npcs" ON public.npcs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert npcs" ON public.npcs FOR INSERT TO authenticated WITH CHECK (can_write_data(auth.uid()));
CREATE POLICY "Editors can update npcs" ON public.npcs FOR UPDATE TO authenticated USING (can_write_data(auth.uid()));
CREATE POLICY "Editors can delete npcs" ON public.npcs FOR DELETE TO authenticated USING (can_write_data(auth.uid()));

-- Add description to map_points
ALTER TABLE public.map_points ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.map_points ADD COLUMN IF NOT EXISTS point_type TEXT NOT NULL DEFAULT 'generic';

-- Create npc-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('npc-images', 'npc-images', true);

CREATE POLICY "Anyone can read npc images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'npc-images');
CREATE POLICY "Editors can upload npc images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'npc-images' AND can_write_data(auth.uid()));
CREATE POLICY "Editors can update npc images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'npc-images' AND can_write_data(auth.uid()));
CREATE POLICY "Editors can delete npc images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'npc-images' AND can_write_data(auth.uid()));
