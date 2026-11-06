ALTER TABLE public.battle_actions ADD COLUMN undo_snapshot jsonb, ADD COLUMN undone_at timestamptz, ADD COLUMN action_order bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX battle_actions_latest_idx ON public.battle_actions(world_id,action_order DESC);
DO $$ DECLARE d text; BEGIN SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='battle_apply_action'; d:=replace(d,'public.battle_apply_action(', 'public.battle_apply_action_core('); d:=replace(d,'WHERE a.world_id=_world_id AND z','WHERE a.world_id=_world_id AND a.undone_at IS NULL AND z'); EXECUTE d; END $$;
REVOKE ALL ON FUNCTION public.battle_apply_action_core(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.battle_capture_undo(_world_id uuid,_hero_id uuid,_targets jsonb,_user_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
WITH ids AS (SELECT (j.value->>'id')::uuid id FROM jsonb_array_elements(_targets) AS j(value)), beasts AS (SELECT b.* FROM public.battle_monsters b JOIN ids ON ids.id=b.id WHERE b.world_id=_world_id)
SELECT jsonb_build_object(
'beasts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'current_hp',b.current_hp,'killed_by',b.killed_by,'battle_id',b.battle_id,'name',b.name) ORDER BY b.id) FROM beasts b),'[]'::jsonb),
'maps',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.map_beasts m WHERE m.world_id=_world_id AND m.battle_id IN (SELECT b.battle_id FROM beasts b)),'[]'::jsonb),
'initiative',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.initiative_entries i WHERE i.world_id=_world_id AND i.battle_monster_id IN (SELECT id FROM ids)),'[]'::jsonb),
'hero',(SELECT jsonb_build_object('id',h.id,'total_damage',h.total_damage,'experience',h.experience,'kills',h.kills) FROM public.heroes h WHERE h.id=_hero_id AND h.world_id=_world_id),
'kills',coalesce((SELECT jsonb_agg(to_jsonb(k) ORDER BY k.id) FROM public.monster_kills k WHERE k.world_id=_world_id AND k.user_id=_user_id AND k.monster_name IN (SELECT b.name FROM beasts b)),'[]'::jsonb)); $$;
REVOKE ALL ON FUNCTION public.battle_capture_undo(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.battle_apply_action(_world_id uuid,_action_id uuid,_hero_id uuid,_kind text,_targets jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_state jsonb; answer jsonb; previous public.battle_actions%rowtype;
BEGIN
IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR (public.is_world_member(_world_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.role_permissions p ON p.role=r.role WHERE r.user_id=auth.uid() AND p.page='battle' AND p.can_edit))) THEN RAISE EXCEPTION 'Nemáte oprávnění upravovat tento boj'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_world_id::text,0));
SELECT * INTO previous FROM public.battle_actions WHERE id=_action_id;
IF FOUND THEN
 IF previous.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Tento útok již byl vrácen'; END IF;
 RETURN public.battle_apply_action_core(_world_id,_action_id,_hero_id,_kind,_targets);
END IF;
PERFORM 1 FROM public.heroes WHERE id=_hero_id AND world_id=_world_id FOR UPDATE;
IF jsonb_typeof(_targets)='array' THEN
 PERFORM 1 FROM public.battle_monsters b WHERE b.world_id=_world_id AND b.id IN (SELECT (j.value->>'id')::uuid FROM jsonb_array_elements(_targets) AS j(value)) ORDER BY b.id FOR UPDATE;
 PERFORM 1 FROM public.map_beasts m WHERE m.world_id=_world_id AND m.battle_id IN (SELECT b.battle_id FROM public.battle_monsters b WHERE b.world_id=_world_id AND b.id IN (SELECT (j.value->>'id')::uuid FROM jsonb_array_elements(_targets) AS j(value))) ORDER BY m.id FOR UPDATE;
 PERFORM 1 FROM public.monster_kills WHERE world_id=_world_id AND user_id=auth.uid() ORDER BY id FOR UPDATE;
 before_state:=public.battle_capture_undo(_world_id,_hero_id,_targets,auth.uid());
END IF;
answer:=public.battle_apply_action_core(_world_id,_action_id,_hero_id,_kind,_targets);
IF _kind='attack' THEN UPDATE public.battle_actions SET undo_snapshot=jsonb_build_object('before',before_state,'after',public.battle_capture_undo(_world_id,_hero_id,_targets,auth.uid())) WHERE id=_action_id; END IF;
RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.battle_apply_action(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.battle_apply_action(uuid,uuid,uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.battle_undo_attack(_world_id uuid,_action_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.battle_actions%rowtype; latest uuid; snapshot jsonb; current_state jsonb; x jsonb;
BEGIN
IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR (public.is_world_member(_world_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.role_permissions p ON p.role=r.role WHERE r.user_id=auth.uid() AND p.page='battle' AND p.can_edit))) THEN RAISE EXCEPTION 'Nemáte oprávnění upravovat tento boj'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_world_id::text,0));
SELECT * INTO a FROM public.battle_actions WHERE id=_action_id AND world_id=_world_id FOR UPDATE;
IF NOT FOUND OR a.kind<>'attack' OR a.undo_snapshot IS NULL THEN RAISE EXCEPTION 'Tento útok nelze vrátit'; END IF;
IF a.undone_at IS NOT NULL THEN RETURN jsonb_build_object('undone',true); END IF;
SELECT id INTO latest FROM public.battle_actions WHERE world_id=_world_id ORDER BY action_order DESC LIMIT 1;
IF latest IS DISTINCT FROM a.id THEN RAISE EXCEPTION 'Po útoku už proběhla další změna boje. Vrácení není bezpečné.'; END IF;
PERFORM 1 FROM public.heroes WHERE id=a.hero_id AND world_id=_world_id FOR UPDATE;
PERFORM 1 FROM public.battle_monsters b WHERE b.world_id=_world_id AND b.id IN (SELECT (j.value->>'id')::uuid FROM jsonb_array_elements(a.targets) AS j(value)) ORDER BY b.id FOR UPDATE;
PERFORM 1 FROM public.map_beasts m WHERE m.world_id=_world_id AND m.battle_id IN (SELECT (j.value->>'battle_id')::uuid FROM jsonb_array_elements(a.undo_snapshot->'before'->'beasts') AS j(value)) ORDER BY m.id FOR UPDATE;
PERFORM 1 FROM public.monster_kills WHERE world_id=_world_id AND user_id=a.user_id ORDER BY id FOR UPDATE;
current_state:=public.battle_capture_undo(_world_id,a.hero_id,a.targets,a.user_id);
IF current_state->'beasts' IS DISTINCT FROM a.undo_snapshot->'after'->'beasts' OR current_state->'hero' IS DISTINCT FROM a.undo_snapshot->'after'->'hero' OR current_state->'maps' IS DISTINCT FROM a.undo_snapshot->'after'->'maps' OR current_state->'kills' IS DISTINCT FROM a.undo_snapshot->'after'->'kills' THEN RAISE EXCEPTION 'Životy, mapa nebo statistiky se mezitím změnily. Útok nelze bezpečně vrátit.'; END IF;
snapshot:=a.undo_snapshot->'before';
FOR x IN SELECT value FROM jsonb_array_elements(snapshot->'beasts') LOOP UPDATE public.battle_monsters SET current_hp=(x->>'current_hp')::int,killed_by=(x->>'killed_by')::uuid WHERE id=(x->>'id')::uuid AND world_id=_world_id; END LOOP;
FOR x IN SELECT value FROM jsonb_array_elements(snapshot->'maps') LOOP
 IF EXISTS(SELECT 1 FROM public.map_beasts WHERE id=(x->>'id')::uuid AND world_id=_world_id) THEN UPDATE public.map_beasts SET current_hp=(x->>'current_hp')::int WHERE id=(x->>'id')::uuid AND world_id=_world_id;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.maps WHERE id=(x->>'map_id')::uuid AND world_id=_world_id) THEN RAISE EXCEPTION 'Původní mapa již neexistuje'; END IF;
  INSERT INTO public.map_beasts SELECT (jsonb_populate_record(NULL::public.map_beasts,x)).*;
 END IF;
END LOOP;
FOR x IN SELECT value FROM jsonb_array_elements(snapshot->'initiative') LOOP INSERT INTO public.initiative_entries SELECT (jsonb_populate_record(NULL::public.initiative_entries,x)).* ON CONFLICT DO NOTHING; END LOOP;
IF a.hero_id IS NOT NULL THEN UPDATE public.heroes SET total_damage=(snapshot->'hero'->>'total_damage')::int,experience=(snapshot->'hero'->>'experience')::int,kills=(snapshot->'hero'->>'kills')::int WHERE id=a.hero_id AND world_id=_world_id; END IF;
DELETE FROM public.monster_kills WHERE world_id=_world_id AND user_id=a.user_id AND monster_name IN (SELECT j.value->>'name' FROM jsonb_array_elements(snapshot->'beasts') AS j(value)) AND id NOT IN (SELECT (j.value->>'id')::uuid FROM jsonb_array_elements(snapshot->'kills') AS j(value));
FOR x IN SELECT value FROM jsonb_array_elements(snapshot->'kills') LOOP UPDATE public.monster_kills SET count=(x->>'count')::int WHERE id=(x->>'id')::uuid AND world_id=_world_id AND user_id=a.user_id; END LOOP;
UPDATE public.battle_actions SET undone_at=now() WHERE id=a.id;
RETURN jsonb_build_object('undone',true);
END $$;
REVOKE ALL ON FUNCTION public.battle_undo_attack(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.battle_undo_attack(uuid,uuid) TO authenticated;
CREATE FUNCTION public.battle_last_undoable_attack(_world_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.battle_actions%rowtype;
BEGIN
IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR (public.is_world_member(_world_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles r JOIN public.role_permissions p ON p.role=r.role WHERE r.user_id=auth.uid() AND p.page='battle' AND p.can_edit))) THEN RETURN NULL; END IF;
SELECT * INTO a FROM public.battle_actions WHERE world_id=_world_id ORDER BY action_order DESC LIMIT 1;
IF a.kind='attack' AND a.undone_at IS NULL AND a.undo_snapshot IS NOT NULL THEN RETURN a.id; END IF;
RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.battle_last_undoable_attack(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.battle_last_undoable_attack(uuid) TO authenticated;