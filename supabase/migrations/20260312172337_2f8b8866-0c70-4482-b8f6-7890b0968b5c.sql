
ALTER TABLE public.monsters ADD COLUMN is_unique boolean NOT NULL DEFAULT false;
ALTER TABLE public.battle_monsters ADD COLUMN level integer NOT NULL DEFAULT 1;
