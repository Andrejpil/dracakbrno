REVOKE ALL ON FUNCTION public.add_initiative_for_beast() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_initiative_on_battle_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_map_beast_on_death() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_initiative_for_beast() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_initiative_on_battle_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_map_beast_on_death() TO service_role;