"""Authenticated undo regression; run with python3 after lovable auth-session."""
import asyncio, json, os, uuid
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={'width':1280,'height':1800})
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
            session = json.load(f)
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v])=>localStorage.setItem(k,v)', [session['storage_key'],json.dumps(session['session'])])
        config = await page.evaluate("async()=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');return {url:s.supabaseUrl,key:s.supabaseKey}}")
        headers = {'apikey':config['key'],'Authorization':'Bearer '+session['session']['access_token'],'Content-Type':'application/json','Prefer':'return=representation'}
        async def req(method, path, data=None, ok=True):
            r = await ctx.request.fetch(config['url']+'/rest/v1/'+path,method=method,headers=headers,data=json.dumps(data) if data is not None else None)
            if ok:
                assert r.ok, 'Request failed: '+str(r.status)+' '+(await r.text())[:300]
            else:
                assert not r.ok, 'Unsafe request accepted'
                return
            text = await r.text()
            return json.loads(text) if text else None
        wid = str(uuid.uuid4()); uid = session['session']['user']['id']
        await req('POST','worlds',{'id':wid,'name':'Ověření vrácení útoku','owner_id':uid})
        try:
            hero = (await req('POST','heroes',{'world_id':wid,'user_id':uid,'name':'Testovací hrdina','race':'Člověk','profession':'Bojovník'}))[0]
            monster = (await req('POST','monsters',{'world_id':wid,'user_id':uid,'name':'Testovací bestie','hp':40,'xp_reward':100}))[0]
            beasts = []
            for n in range(3):
                beasts += await req('POST','battle_monsters',{'world_id':wid,'user_id':uid,'monster_id':monster['id'],'battle_id':str(uuid.uuid4()),'name':'Bestie '+str(n+1),'hp':40,'current_hp':40,'xp_reward':100,'level':1})
            maprow = (await req('POST','maps',{'world_id':wid,'user_id':uid,'name':'Testovací mapa','image_url':'/placeholder.svg'}))[0]
            mb = (await req('POST','map_beasts',{'world_id':wid,'map_id':maprow['id'],'created_by':uid,'monster_id':monster['id'],'battle_id':beasts[0]['battle_id'],'name':'Bestie 1','hp':40,'current_hp':40,'x':120,'y':100,'revealed':True}))[0]
            await page.evaluate('(id)=>localStorage.setItem("active_world_id",id)',wid)
            await page.goto('http://localhost:8080/boj')
            await page.get_by_role('button',name='Detail Bestie 1',exact=True).click()
            dialog = page.get_by_role('dialog')
            await dialog.get_by_role('spinbutton',name='Poškození HP',exact=True).fill('23')
            await dialog.get_by_role('button',name='Odečíst poškození',exact=True).click()
            undo = dialog.get_by_role('button',name='Vrátit poslední zranění',exact=True)
            await undo.wait_for()
            await page.wait_for_function("()=>document.querySelector('input[aria-label=\"Nová hodnota HP\"]')?.value==='17'")
            h = (await req('GET','heroes?id=eq.'+hero['id']))[0]
            assert (h['total_damage'],h['experience']) == (23,57)
            receipt = (await req('GET','battle_actions?world_id=eq.'+wid+'&order=action_order.desc'))[0]
            await undo.click()
            await page.wait_for_function("()=>document.querySelector('input[aria-label=\"Nová hodnota HP\"]')?.value==='40'")
            h = (await req('GET','heroes?id=eq.'+hero['id']))[0]
            assert (h['total_damage'],h['experience'],h['kills']) == (0,0,0)
            assert (await req('GET','map_beasts?id=eq.'+mb['id']))[0]['current_hp']==40
            await req('POST','rpc/battle_undo_attack',{'_world_id':wid,'_action_id':receipt['id']})
            await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':receipt['id'],'_hero_id':hero['id'],'_kind':'attack','_targets':receipt['targets']},ok=False)
            await dialog.screenshot(path='/tmp/browser/battle-undo/detail.png')
            # Killing attack must restore deleted map token and initiative, and allow a new kill.
            async def attack(targets):
                aid = str(uuid.uuid4())
                result = await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':aid,'_hero_id':hero['id'],'_kind':'attack','_targets':targets})
                return aid,result
            async def undo_rpc(aid):
                await req('POST','rpc/battle_undo_attack',{'_world_id':wid,'_action_id':aid})
            aid,result = await attack([{'id':beasts[0]['id'],'amount':99}])
            assert (result['damage'],result['xp'],result['kills'])==(40,105,1)
            assert not await req('GET','map_beasts?id=eq.'+mb['id'])
            await undo_rpc(aid)
            assert (await req('GET','map_beasts?id=eq.'+mb['id']))[0]['x']==120
            assert len(await req('GET','initiative_entries?battle_monster_id=eq.'+beasts[0]['id']))==1
            assert not await req('GET','monster_kills?world_id=eq.'+wid)
            aid,result = await attack([{'id':beasts[0]['id'],'amount':40}])
            assert result['kills']==1
            await undo_rpc(aid)
            # Area undo restores all targets and the exact 114 XP / 46 damage.
            aid,result = await attack([{'id':b['id'],'amount':v} for b,v in zip(beasts,[8,15,23])])
            assert (result['damage'],result['xp'])==(46,114)
            await undo_rpc(aid)
            assert all(b['current_hp']==40 for b in await req('GET','battle_monsters?world_id=eq.'+wid))
            h=(await req('GET','heroes?id=eq.'+hero['id']))[0]
            assert (h['total_damage'],h['experience'],h['kills'])==(0,0,0)
            # Later correction and external stat edits must block stale undo.
            aid,_ = await attack([{'id':beasts[1]['id'],'amount':8}])
            await req('PATCH','heroes?id=eq.'+hero['id'],{'experience':30})
            await req('POST','rpc/battle_undo_attack',{'_world_id':wid,'_action_id':aid},ok=False)
            await req('POST','rpc/battle_apply_action',{'_world_id':wid,'_action_id':str(uuid.uuid4()),'_hero_id':None,'_kind':'correct','_targets':[{'id':beasts[1]['id'],'amount':35}]})
            await req('POST','rpc/battle_undo_attack',{'_world_id':wid,'_action_id':aid},ok=False)
            await req('POST','rpc/battle_undo_attack',{'_world_id':str(uuid.uuid4()),'_action_id':aid},ok=False)
            await page.reload()
            await page.get_by_role('button',name='Detail Bestie 1',exact=True).wait_for()
            await page.set_viewport_size({'width':770,'height':674})
            await page.screenshot(path='/tmp/browser/battle-undo/small.png')
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            print('PASS: UI undo 23 HP / 57 XP; replay guard; kill + map + initiative restored; new kill; area 46 HP / 114 XP; stale stats/correction and world guard; 770px')
        finally:
            await req('DELETE','worlds?id=eq.'+wid)
            await browser.close()

if __name__=='__main__':
    Path('/tmp/browser/battle-undo').mkdir(parents=True,exist_ok=True)
    asyncio.run(main())