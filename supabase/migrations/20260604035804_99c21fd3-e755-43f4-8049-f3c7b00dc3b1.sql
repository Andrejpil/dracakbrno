CREATE OR REPLACE FUNCTION public.ensure_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assign_default_role(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_role_trg ON public.profiles;
CREATE TRIGGER ensure_profile_role_trg
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_role();

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'viewer'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
);

REVOKE ALL ON FUNCTION public.assign_default_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_write_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_profile_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_default_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_write_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_role() TO service_role;