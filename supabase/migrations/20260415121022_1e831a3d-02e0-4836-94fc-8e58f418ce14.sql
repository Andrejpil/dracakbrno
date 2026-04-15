
-- Add map_id column to map_settings
ALTER TABLE public.map_settings ADD COLUMN map_id UUID REFERENCES public.maps(id) ON DELETE CASCADE;

-- Drop the old unique constraint on user_id (if exists) and create new one
ALTER TABLE public.map_settings DROP CONSTRAINT IF EXISTS map_settings_user_id_key;
CREATE UNIQUE INDEX map_settings_user_map_unique ON public.map_settings (user_id, map_id);
