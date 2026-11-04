"""Run with python3; requires a locally minted Lovable session. Creates and removes an isolated test world."""
import asyncio,json,os,uuid
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  ctx=await browser.new_context(viewport={'width':1280,'height':1800})
  page=await ctx.new_page(); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: session=json.load(f)
  await page.goto('http://localhost:8080')
  await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[session['storage_key'],json.dumps(session['session'])])
  await page.goto('http://localhost:8080/boj');await page.wait_for_timeout(1700)
  config=await page.evaluate("async()=>{const x=await import('/src/integrations/supabase/client.ts');return {url:x.supabase.supabaseUrl,key:x.supabase.supabaseKey}}")
  headers={'apikey':config['key'],'Authorization':'Bearer '+session['session']['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
  async def req(method,path,data=None):
   r=await ctx.request.fetch(config['url']+'/rest/v1/'+path,method=method,headers=headers,data=json.dumps(data) if data is not None else None)
   if not r.ok: raise AssertionError('API '+str(r.status)+' '+(await r.text())[:350])
   text=await r.text();return json.loads(text) if text else None
  uid=session['session']['user']['id'];wid=str(uuid.uuid4())
  await req('POST','worlds',{'id':wid,'name':'Ověření boje','owner_id':uid})
  try:
   hero=(await req('POST','heroes',{'user_id':uid,'world_id':wid,'name':'Ověřovací hrdina','race':'Člověk','profession':'Bojovník','specialization':'','experience':0}))[0]
   hero_init=await req('GET','initiative_entries?hero_id=eq.'+hero['id'])
   assert len(hero_init)==1 and hero_init[0]['world_id']==wid, 'Hero initiative must belong to its world, never the default world'
   monster=(await req('POST','monsters',{'user_id':uid,'world_id':wid,'name':'Ověřovací goblin','hp':40,'xp_reward':100}))[0]
   beasts=[]
   for i in range(3): beasts.extend(await req('POST','battle_monsters',{'user_id':uid,'world_id':wid,'monster_id':monster['id'],'battle_id':str(uuid.uuid4()),'name':'Goblin '+str(i+1),'hp':40,'current_hp':40,'xp_reward':100,'level':1}))
   # A real map-beast row shares the first battle id.
   maprow=(await req('POST','maps',{'user_id':uid,'world_id':wid,'name':'Ověřovací mapa','image_url':'/placeholder.svg','is_active':True,'fog_enabled':False}))[0]
   mapbeast=(await req('POST','map_beasts',{'map_id':maprow['id'],'world_id':wid,'created_by':uid,'name':'Goblin 1','monster_id':monster['id'],'battle_id':beasts[0]['battle_id'],'hp':40,'current_hp':40,'x':100,'y':100,'revealed':True}))[0]
   await page.evaluate('(id)=>localStorage.setItem("active_world_id",id)',wid);await page.reload();await page.wait_for_timeout(1600)
   second=await ctx.new_page();await second.goto('http://localhost:8080/boj');await second.wait_for_timeout(1400)
   await page.get_by_role('button',name='Detail Goblin 1',exact=True).click()
   await page.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('23')
   await page.get_by_role('button',name='Odečíst poškození',exact=True).click();await page.wait_for_timeout(1400)
   h=(await req('GET','heroes?id=eq.'+hero['id']))[0];assert h['total_damage']==23 and h['experience']==57
   assert (await req('GET','map_beasts?id=eq.'+mapbeast['id']))[0]['current_hp']==17
   await second.get_by_role('button',name='Detail Goblin 1',exact=True).click()
   await second.get_by_role('dialog').get_by_text('17/40',exact=True).wait_for(timeout=10000)
   # Correction and healing do not change damage or experience.
   await page.get_by_role('spinbutton',name='Nová hodnota HP',exact=True).fill('30');await page.get_by_role('button',name='Nastavit HP',exact=True).click();await page.wait_for_timeout(1600)
   await page.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('10');await page.get_by_role('button',name='Přičíst HP',exact=True).click();await page.wait_for_timeout(1600)
   h=(await req('GET','heroes?id=eq.'+hero['id']))[0];assert h['total_damage']==23 and h['experience']==57
   # Slider commits a single whole HP correction.
   slider=page.get_by_role('slider',name='Aktuální HP',exact=True)
   await slider.focus();await slider.press('ArrowLeft');await page.wait_for_timeout(1600)
   assert (await req('GET','battle_monsters?id=eq.'+beasts[0]['id']))[0]['current_hp']==39
   await page.get_by_role('spinbutton',name='Nová hodnota HP',exact=True).fill('40');await page.get_by_role('button',name='Nastavit HP',exact=True).click();await page.wait_for_timeout(1600)
   await page.get_by_role('dialog').get_by_role('button',name='Zavřít detail',exact=True).click()
   await page.get_by_role('button',name='Plošný útok',exact=True).click()
   for i,v in enumerate([8,15,23]):
    await page.get_by_role('checkbox',name='Zasáhnout Goblin '+str(i+1),exact=True).check()
    await page.get_by_role('spinbutton',name='Poškození Goblin '+str(i+1),exact=True).fill(str(v))
   await page.get_by_role('button',name='Provést plošný útok',exact=True).click();await page.wait_for_timeout(2500)
   h=(await req('GET','heroes?id=eq.'+hero['id']))[0];assert h['total_damage']==69 and h['experience']==171,h
   receipt=(await req('GET','battle_actions?world_id=eq.'+wid+'&kind=eq.attack&order=created_at.desc'))[0]
   await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':receipt['id'],'_hero_id':hero['id'],'_kind':'attack','_targets':receipt['targets']})
   assert (await req('GET','heroes?id=eq.'+hero['id']))[0]['total_damage']==69
   # Independent copies via the real UI.
   await page.locator('button[title="Kopírovat Goblin 2"]').click()
   await page.get_by_role('dialog').get_by_role('spinbutton').fill('2');await page.get_by_role('button',name='Přidat 2× do boje',exact=True).click();await page.wait_for_timeout(2400)
   copies=await req('GET','battle_monsters?world_id=eq.'+wid+'&name=eq.Goblin%202');assert len(copies)==3
   copied=[b for b in copies if b['id']!=beasts[1]['id']];assert all(b['current_hp']==40 for b in copied)
   assert len({b['battle_id'] for b in copies})==3
   await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':str(uuid.uuid4()),'_hero_id':None,'_kind':'correct','_targets':[{'id':copied[0]['id'],'amount':7}]})
   unchanged=(await req('GET','battle_monsters?id=eq.'+copied[1]['id']))[0];assert unchanged['current_hp']==40
   # Unique beast uses the existing 10 percent killing bonus.
   unique=(await req('POST','monsters',{'user_id':uid,'world_id':wid,'name':'Unikátní test','hp':40,'xp_reward':100,'is_unique':True}))[0]
   ub=(await req('POST','battle_monsters',{'user_id':uid,'world_id':wid,'monster_id':unique['id'],'battle_id':str(uuid.uuid4()),'name':'Unikátní test','hp':40,'current_hp':40,'xp_reward':100,'level':1}))[0]
   ur=await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':str(uuid.uuid4()),'_hero_id':hero['id'],'_kind':'attack','_targets':[{'id':ub['id'],'amount':40}]})
   assert ur['xp']==110 and ur['kills']==1
   # Restore test hero to isolate the normal-kill expectations below.
   await req('PATCH','heroes?id=eq.'+hero['id'],{'total_damage':69,'experience':171,'kills':0})
   init=await req('GET','initiative_entries?world_id=eq.'+wid);assert len([e for e in init if e['battle_monster_id'] in [b['id'] for b in copied]])==2
   # Active turn persisted by world and read on map.
   await page.locator('button[title="Zahájit tah: Goblin 1"]').click();await page.wait_for_timeout(750)
   state=(await req('GET','battle_state?world_id=eq.'+wid))[0];assert state['active_battle_id']==beasts[0]['battle_id']
   await page.screenshot(path='/tmp/browser/battle/desktop.png')
   await page.set_viewport_size({'width':770,'height':674});await page.screenshot(path='/tmp/browser/battle/small.png')
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page overflow'
   await page.set_viewport_size({'width':1280,'height':1800})
   await page.get_by_role('button',name='Detail Goblin 1',exact=True).click()
   await page.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('99');await page.get_by_role('button',name='Odečíst poškození',exact=True).click();await page.wait_for_timeout(1200)
   h=(await req('GET','heroes?id=eq.'+hero['id']))[0];assert h['kills']==1 and h['total_damage']==101 and h['experience']==256
   # Killing again after resurrection cannot credit the same beast twice.
   await page.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('1');await page.get_by_role('button',name='Přičíst HP',exact=True).click();await page.wait_for_timeout(1600)
   await page.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('1');await page.get_by_role('button',name='Odečíst poškození',exact=True).click();await page.wait_for_timeout(1600)
   assert (await req('GET','heroes?id=eq.'+hero['id']))[0]['kills']==1
   await page.reload();await page.wait_for_timeout(1000);assert 'Padl' in await page.locator('main').inner_text()
   assert not errors,errors
   print('PASS: 23/40, XP 57; correction/healing no stats; slider whole HP; area 46/XP114; replay; independent copies; map HP; realtime second browser; active turn; overkill/kill once; reload; 770px')
  finally:
   await req('DELETE','worlds?id=eq.'+wid);await browser.close()

if __name__=='__main__': asyncio.run(main())
