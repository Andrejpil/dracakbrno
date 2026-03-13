-- Create storage bucket for monster images
INSERT INTO storage.buckets (id, name, public) VALUES ('monster-images', 'monster-images', true);

-- Allow authenticated users to upload monster images
CREATE POLICY "Users can upload monster images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'monster-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to view monster images (public bucket)
CREATE POLICY "Anyone can view monster images" ON storage.objects
  FOR SELECT USING (bucket_id = 'monster-images');

-- Allow users to update their own monster images
CREATE POLICY "Users can update own monster images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'monster-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own monster images
CREATE POLICY "Users can delete own monster images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'monster-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add image_url column to monsters table
ALTER TABLE public.monsters ADD COLUMN image_url text NOT NULL DEFAULT '';

-- Add image_url column to battle_monsters table
ALTER TABLE public.battle_monsters ADD COLUMN image_url text NOT NULL DEFAULT '';