
ALTER TABLE public.battle_state
  ADD COLUMN IF NOT EXISTS active_battle_id uuid,
  ADD COLUMN IF NOT EXISTS active_hero_id uuid;
