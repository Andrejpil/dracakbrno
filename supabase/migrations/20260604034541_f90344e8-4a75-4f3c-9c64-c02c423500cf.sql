DROP POLICY IF EXISTS "Authenticated users can update map_tokens" ON public.map_tokens;
CREATE POLICY "Owner or editor can update map_tokens"
ON public.map_tokens
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid() OR can_write_data(auth.uid()))
WITH CHECK (owner_user_id = auth.uid() OR can_write_data(auth.uid()));