
-- 1) Every authenticated user can read role_permissions (viewers need this to know which pages they can see).
DROP POLICY IF EXISTS "Staff read role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- 2) Global roles (Users tab) are the single source of truth for access.
-- World membership no longer gatekeeps content — any authenticated user can read any world's data.
-- Per-page visibility is enforced client-side via role_permissions, and writes still go through can_write_data.
CREATE OR REPLACE FUNCTION public.is_world_member(_world_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_world_editor(_world_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_write_data(_user_id);
$$;

-- 3) Realtime for calendar: enable replica identity and add tables to publication (idempotent).
ALTER TABLE public.game_calendar REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_special_days REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_calendar'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_calendar';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'calendar_special_days'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_special_days';
  END IF;
END $$;
