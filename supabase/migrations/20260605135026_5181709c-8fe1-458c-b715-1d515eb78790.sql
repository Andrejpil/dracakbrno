
-- 1) profiles SELECT policy -> restrict to authenticated only
DROP POLICY IF EXISTS "Users read own profile or admin reads all" ON public.profiles;
CREATE POLICY "Users read own profile or admin reads all"
ON public.profiles
FOR SELECT
TO authenticated
USING ((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'));

-- 2) heroes is_admin protection triggers (recreate to ensure present)
DROP TRIGGER IF EXISTS protect_hero_is_admin_trg ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_trg
BEFORE UPDATE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin();

DROP TRIGGER IF EXISTS protect_hero_is_admin_insert_trg ON public.heroes;
CREATE TRIGGER protect_hero_is_admin_insert_trg
BEFORE INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.protect_hero_is_admin_insert();

-- 3) map_beasts: viewers should only see fully-visible beasts (revealed AND stealth_mode='none')
DROP POLICY IF EXISTS "Read revealed beasts or editors" ON public.map_beasts;
CREATE POLICY "Read revealed beasts or editors"
ON public.map_beasts
FOR SELECT
TO authenticated
USING (
  ((revealed = true) AND (stealth_mode = 'none'))
  OR public.can_write_data(auth.uid())
);

-- 4) Ensure profile-role assignment trigger exists (recreate)
DROP TRIGGER IF EXISTS ensure_profile_role_trg ON public.profiles;
CREATE TRIGGER ensure_profile_role_trg
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_role();

-- 5) Recreate beast/hero initiative and cleanup triggers (they vanished from triggers list)
DROP TRIGGER IF EXISTS add_initiative_for_beast_trg ON public.battle_monsters;
CREATE TRIGGER add_initiative_for_beast_trg
AFTER INSERT ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_beast();

DROP TRIGGER IF EXISTS cleanup_initiative_on_battle_change_trg ON public.battle_monsters;
CREATE TRIGGER cleanup_initiative_on_battle_change_trg
AFTER UPDATE OR DELETE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_battle_change();

DROP TRIGGER IF EXISTS remove_map_beast_on_death_trg ON public.battle_monsters;
CREATE TRIGGER remove_map_beast_on_death_trg
AFTER UPDATE ON public.battle_monsters
FOR EACH ROW EXECUTE FUNCTION public.remove_map_beast_on_death();

DROP TRIGGER IF EXISTS add_initiative_for_hero_trg ON public.heroes;
CREATE TRIGGER add_initiative_for_hero_trg
AFTER INSERT ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.add_initiative_for_hero();

DROP TRIGGER IF EXISTS cleanup_initiative_on_hero_delete_trg ON public.heroes;
CREATE TRIGGER cleanup_initiative_on_hero_delete_trg
AFTER DELETE ON public.heroes
FOR EACH ROW EXECUTE FUNCTION public.cleanup_initiative_on_hero_delete();
