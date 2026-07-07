
-- Restore proper world-membership check so RLS policies actually isolate data per world.
-- A user is a "member" of a world only if they own it OR are listed in world_members.
CREATE OR REPLACE FUNCTION public.is_world_member(_world_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worlds
    WHERE id = _world_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.world_members
    WHERE world_id = _world_id AND user_id = _user_id
  );
$$;
