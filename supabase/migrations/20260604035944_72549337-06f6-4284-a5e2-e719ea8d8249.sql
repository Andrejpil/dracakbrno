DROP TRIGGER IF EXISTS battle_monster_cleanup_initiative ON public.battle_monsters;
DROP TRIGGER IF EXISTS trg_add_initiative_for_beast ON public.battle_monsters;
DROP TRIGGER IF EXISTS trg_cleanup_initiative_on_battle_change ON public.battle_monsters;
DROP TRIGGER IF EXISTS trg_remove_map_beast_on_death ON public.battle_monsters;