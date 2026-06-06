
-- 1. Enforce email from auth.users on profiles insert/update
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_email text;
BEGIN
  SELECT email INTO real_email FROM auth.users WHERE id = NEW.id;
  IF real_email IS NULL THEN
    RAISE EXCEPTION 'No auth user for profile id %', NEW.id;
  END IF;
  NEW.email := real_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email_ins ON public.profiles;
CREATE TRIGGER sync_profile_email_ins
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

DROP TRIGGER IF EXISTS sync_profile_email_upd ON public.profiles;
CREATE TRIGGER sync_profile_email_upd
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- 2. Remove broad SELECT-listing policy for map-images
DROP POLICY IF EXISTS "Anyone can read map images" ON storage.objects;
