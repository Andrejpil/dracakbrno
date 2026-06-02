-- Allow any signed-in user to move tokens on the shared map (viewers play their characters).
DROP POLICY IF EXISTS "Editors or owners can update map_tokens" ON public.map_tokens;
CREATE POLICY "Authenticated users can update map_tokens"
  ON public.map_tokens
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure realtime sends full row for UPDATE so RLS-on-realtime can re-evaluate
-- (lets viewers receive map_beasts UPDATE that flips revealed=true).
ALTER TABLE public.map_beasts REPLICA IDENTITY FULL;
ALTER TABLE public.map_tokens REPLICA IDENTITY FULL;
ALTER TABLE public.battle_monsters REPLICA IDENTITY FULL;