CREATE OR REPLACE FUNCTION public.is_world_editor(_world_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.can_write_data(_user_id)
     AND public.is_world_member(_world_id, _user_id);
$function$;