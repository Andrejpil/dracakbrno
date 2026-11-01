CREATE OR REPLACE FUNCTION public.battle_apply_action(_world_id uuid, _action_id uuid, _hero_id uuid, _kind text, _targets jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.battle_monsters%rowtype; t jsonb; previous public.battle_actions%rowtype; actual integer; amount integer; total integer:=0; gain integer:=0; kill_count integer:=0; scaled integer; unique_beast boolean; first_kill boolean; output jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR (public.is_world_member(_world_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.role_permissions p ON p.role=r.role WHERE r.user_id=auth.uid() AND p.page='battle' AND p.can_edit))) THEN RAISE EXCEPTION 'Nemáte oprávnění upravovat tento boj'; END IF;
 IF _action_id IS NULL OR _kind IS NULL OR _kind NOT IN ('attack','heal','correct') OR jsonb_typeof(_targets) IS DISTINCT FROM 'array' OR jsonb_array_length(_targets) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Neplatná akce'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_targets) x WHERE (x->>'amount') IS NULL OR (x->>'amount') !~ '^[0-9]{1,8}$' OR (x->>'amount')::int < 0 OR (x->>'id') IS NULL) OR (SELECT count(*) FROM jsonb_array_elements(_targets)) <> (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(_targets) x) THEN RAISE EXCEPTION 'Neplatné nebo duplicitní cíle'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_world_id::text,0));
 SELECT * INTO previous FROM public.battle_actions WHERE id=_action_id;
 IF FOUND THEN
  IF previous.world_id<>_world_id OR previous.user_id<>auth.uid() OR previous.hero_id IS DISTINCT FROM _hero_id OR previous.kind<>_kind OR previous.targets<>_targets THEN RAISE EXCEPTION 'Identifikátor akce již byl použit'; END IF;
  RETURN previous.result;
 END IF;
 IF _hero_id IS NOT NULL THEN PERFORM 1 FROM public.heroes WHERE id=_hero_id AND world_id=_world_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Útočník nepatří do světa'; END IF; END IF;
 INSERT INTO public.battle_actions(id,world_id,user_id,hero_id,kind,targets) VALUES(_action_id,_world_id,auth.uid(),_hero_id,_kind,_targets);
 FOR t IN SELECT value FROM jsonb_array_elements(_targets) ORDER BY value->>'id' LOOP
  SELECT * INTO b FROM public.battle_monsters WHERE id=(t->>'id')::uuid AND world_id=_world_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cíl již není v tomto boji'; END IF;
  amount:=(t->>'amount')::int;
  IF _kind='attack' THEN
   actual:=least(amount,greatest(0,b.current_hp)); total:=total+actual;
   SELECT coalesce(m.is_unique,false) INTO unique_beast FROM public.monsters m WHERE m.id=b.monster_id;
   scaled:=floor(b.xp_reward*(1+(b.level-1)*0.1));
   IF _hero_id IS NOT NULL AND b.hp>0 THEN gain:=gain+floor(actual::numeric/b.hp*scaled); END IF;
   first_kill:=b.current_hp>0 AND b.current_hp-actual=0 AND b.killed_by IS NULL AND NOT EXISTS(SELECT 1 FROM public.battle_actions a CROSS JOIN LATERAL jsonb_array_elements(coalesce(a.result->'targets','[]'::jsonb)) z WHERE a.world_id=_world_id AND z->>'id'=b.id::text AND z->>'killed'='true');
   IF first_kill THEN
    kill_count:=kill_count+1;
    IF _hero_id IS NOT NULL THEN gain:=gain+floor(scaled*CASE WHEN coalesce(unique_beast,false) THEN 0.10 ELSE 0.05 END); END IF;
    INSERT INTO public.monster_kills(user_id,world_id,monster_name,count) VALUES(auth.uid(),_world_id,b.name,1) ON CONFLICT(user_id,monster_name) DO UPDATE SET count=public.monster_kills.count+1;
   END IF;
   UPDATE public.battle_monsters SET current_hp=greatest(0,b.current_hp-actual), killed_by=CASE WHEN first_kill AND _hero_id IS NOT NULL THEN _hero_id ELSE b.killed_by END WHERE id=b.id;
   UPDATE public.map_beasts SET current_hp=greatest(0,b.current_hp-actual) WHERE battle_id=b.battle_id AND world_id=_world_id;
   output:=output||jsonb_build_array(jsonb_build_object('id',b.id,'damage',actual,'hp',greatest(0,b.current_hp-actual),'killed',first_kill));
  ELSE
   amount:=greatest(0,least(b.hp,CASE WHEN _kind='heal' THEN b.current_hp+amount ELSE amount END));
   UPDATE public.battle_monsters SET current_hp=amount WHERE id=b.id;
   UPDATE public.map_beasts SET current_hp=amount WHERE battle_id=b.battle_id AND world_id=_world_id;
   output:=output||jsonb_build_array(jsonb_build_object('id',b.id,'hp',amount,'damage',0,'killed',false));
  END IF;
 END LOOP;
 IF _kind='attack' AND _hero_id IS NOT NULL THEN UPDATE public.heroes SET total_damage=total_damage+total, experience=experience+gain, kills=public.heroes.kills+kill_count WHERE id=_hero_id AND world_id=_world_id; END IF;
 UPDATE public.battle_actions SET result=jsonb_build_object('damage',total,'xp',gain,'kills',kill_count,'targets',output) WHERE id=_action_id RETURNING result INTO t;
 RETURN t;
END $$;