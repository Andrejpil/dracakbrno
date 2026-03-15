
-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  page text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  UNIQUE(role, page)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default permissions
INSERT INTO public.role_permissions (role, page, can_view, can_edit) VALUES
  ('viewer', 'heroes', true, false),
  ('viewer', 'bestiary', true, false),
  ('viewer', 'battle', false, false),
  ('viewer', 'xp', false, false),
  ('viewer', 'stats', true, false),
  ('viewer', 'export', false, false),
  ('viewer', 'map', true, false),
  ('editor', 'heroes', true, true),
  ('editor', 'bestiary', true, true),
  ('editor', 'battle', true, true),
  ('editor', 'xp', true, true),
  ('editor', 'stats', true, true),
  ('editor', 'export', true, true),
  ('editor', 'map', true, true);

-- Function to safely assign default role (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.assign_default_role(p_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_role app_role;
  total_count integer;
BEGIN
  SELECT role INTO existing_role FROM public.user_roles WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN existing_role;
  END IF;
  
  SELECT COUNT(*) INTO total_count FROM public.user_roles;
  
  IF total_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'admin');
    RETURN 'admin';
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'viewer');
    RETURN 'viewer';
  END IF;
END;
$$;

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Set pilar.andrej@gmail.com as admin (if exists)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE email = 'pilar.andrej@gmail.com';
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  END IF;
END;
$$;
