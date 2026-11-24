import asyncio, json
from playwright.async_api import async_playwright
R=[]
def ok(name, cond, info=''):
    R.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ')+name+(' | '+str(info) if info else ''))
SETUP="""(o) => { var p=HP.profile(); p.tutorialDone=true; p.games=9; Object.keys(HP.SCENES).forEach(function(k){p.seen['scene_'+k]=1}); p.seen.serve=1; p.seen.heat_jiugong=1; p.seen.heat_yuanyang=1; if(o.pot){p.pots=['jiugong','yuanyang']; p.pot=o.pot;} if(o.bond) p.bond=o.bond;
  var orig=HP.pickCard; if(o.card) HP.pickCard=function(){ return HP.cardById(o.card); }; document.querySelector('[data-scene='+o.scene+']').click(); HP.pickCard=orig; }"""
async def page(b, vw=390, vh=844, init=None):
    pg = await b.new_page(viewport={'width':vw,'height':vh}, device_scale_factor=2, has_touch=True)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and 'Failed to load resource' not in m.text and errs.append(m.text))
    if init: await pg.add_init_script(init)
    await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(2500)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # 1 首次进入：教学
        pg, errs = await page(b)
        await pg.evaluate("document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(600)
        t = await pg.evaluate("document.getElementById('coach-title').textContent")
        ok('首次进入直接进教学', '第 1 步' in t, t)
        # 走完教学：用游戏接口完成每步
        steps=[]
        for i in range(8):
            title = await pg.evaluate("document.getElementById('coach-title').textContent")
            steps.append(title)
            if '学会了' in title:
                await pg.evaluate("document.getElementById('coach-btn').click()"); break
            await pg.evaluate("""() => { var g=HP.game, t=document.getElementById('coach-title').textContent;
              function plate(id){ var r=document.getElementById('plate-'+id).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }
              function drop(id,c){ var p=plate(id); g.dragStart(id,p.x,p.y); var z=g.zones[c||4], q=g.toScreen(z.cx,z.cy); g.dragMove(q.x,q.y+54*g.unit); return q; }
              if (t.indexOf('第 1 步')>=0) { var q=drop('beef'); g.hold && (g.hold.d=HP.FOODS.beef.a+0.3); window.__q=q; }
              else if (t.indexOf('第 2 步')>=0) { var q=drop('maodu'); window.__q=q; }
              else if (t.indexOf('第 3 步')>=0) { var p=plate('luncheon'); g.dragStart('luncheon',p.x,p.y); var z=g.zones[3], q=g.toScreen(z.cx,z.cy); g.dragMove(q.x,q.y+54*g.unit); g.dragEnd(); }
              else if (t.indexOf('第 4 步')>=0) { var n=g.npcs.filter(x=>x.tip)[0]; if(n) g.pointerDown(n.tip.x+n.dir.x*20,n.tip.y+n.dir.y*20,true); }
              else if (t.indexOf('第 5 步')>=0) { var f=g.foods.filter(x=>x.state==='in'&&x.type==='luncheon')[0], d=g.diners.filter(x=>x.id==='friend')[0]; if(f&&d){ var p=g.toScreen(f.nx,f.ny); g.pointerDown(p.x,p.y); g.pointerMove(p.x+20,p.y-30); g.pointerMove(d.x,d.y+54*g.unit); g.pointerUp(); } }
            }""")
            if '第 1 步' in title:
                await pg.wait_for_timeout(700); await pg.evaluate("HP.game.hold && (HP.game.hold.d=HP.FOODS.beef.a+0.3); HP.game.dragEnd()")
            elif '第 2 步' in title:
                for k in range(8):
                    await pg.evaluate("(()=>{var g=HP.game,q=window.__q; g.dragMove(q.x,q.y+54*g.unit-40*g.unit);})()"); await pg.wait_for_timeout(180)
                    await pg.evaluate("(()=>{var g=HP.game,q=window.__q; g.dragMove(q.x,q.y+54*g.unit);})()"); await pg.wait_for_timeout(220)
                await pg.evaluate("var h=HP.game.hold; if(h){ if(h.d<5) h.d=6; } HP.game.dragEnd()")
            elif '第 3 步' in title:
                await pg.wait_for_timeout(300)
                await pg.evaluate("(()=>{var g=HP.game,f=g.foods.filter(x=>x.state==='in')[0]; if(f){ var F=HP.FOODS[f.type]; f.d=F.a+1; var p=g.toScreen(f.nx,f.ny); g.pointerDown(p.x,p.y); g.pointerUp(); }})()")
            elif '第 4 步' in title:
                await pg.wait_for_timeout(2500)
                await pg.evaluate("(()=>{var g=HP.game,n=g.npcs.filter(x=>x.tip&&x.phase!=='idle')[0]; if(n) g.pointerDown(n.tip.x+n.dir.x*20,n.tip.y+n.dir.y*20,true);})()")
            await pg.wait_for_timeout(2200)
        ok('教学能走完', any('学会了' in s for s in steps), ' → '.join(s[:6] for s in steps))
        await pg.wait_for_timeout(800)
        ok('教学后进入正式一局', await pg.evaluate("HP.game.mode==='play' && HP.profile().tutorialDone"))
        ok('教学无报错', not errs, errs[:3]); await pg.close()

        # 2 每个剧本 × 两种锅 都能开局、出单、结束、出结算
        for sc in ['bros','team','date','family','solo']:
            for pot in ['jiugong','yuanyang']:
                pg, errs = await page(b)
                await pg.evaluate(SETUP, {'scene':sc,'pot':pot}); await pg.wait_for_timeout(500)
                flip = await pg.evaluate("!document.getElementById('flip').classList.contains('hidden')")
                await pg.evaluate("document.getElementById('flip').click()"); await pg.wait_for_timeout(7000)
                st = json.loads(await pg.evaluate("JSON.stringify({orders:HP.game.stats.orders, diners:HP.game.diners.length, card:HP.game.stats.card, pot:HP.game.potId, running:HP.game.running})"))
                await pg.evaluate("HP.game.elapsed=60"); await pg.wait_for_timeout(1500)
                res = await pg.evaluate("!document.getElementById('result').classList.contains('hidden') && document.getElementById('r-img').src.length>1000")
                exp_orders = sc!='solo'
                ok(f'{sc}/{pot} 开局翻卡={flip} 出单={st["orders"]} 结算={res}', res and st['running'] and (st['orders']>0)==exp_orders and st['pot']==pot, st)
                if errs: ok(f'{sc}/{pot} 无报错', False, errs[:2])
                await pg.close()

        # 3 每张饭局卡都能跑完
        for card, sc in [('heartbreak','bros'),('diet','bros'),('newbie','team'),('blackout','solo'),('aa','date'),('birthday','family'),('proposal','team'),('freemaodu','bros'),('gfdate','bros')]:
            pg, errs = await page(b)
            await pg.evaluate(SETUP, {'scene':sc,'card':card,'bond':{'laowang':60}}); await pg.wait_for_timeout(300)
            await pg.evaluate("document.getElementById('flip').click()")
            await pg.evaluate("HP.game.propAt=4")
            await pg.wait_for_timeout(5500)
            mid = json.loads(await pg.evaluate("JSON.stringify({ev: HP.game.event&&HP.game.event.type, goal: document.getElementById('goal').textContent, diners: HP.game.diners.map(d=>d.id)})"))
            await pg.evaluate("HP.game.elapsed=50"); await pg.wait_for_timeout(3500)
            late = await pg.evaluate("HP.game.event&&HP.game.event.type")
            await pg.evaluate("HP.game.elapsed=60"); await pg.wait_for_timeout(1500)
            res = await pg.evaluate("!document.getElementById('result').classList.contains('hidden')")
            extra = ''
            if card=='proposal': extra = 'ev=' + str(mid['ev'])
            if card=='birthday': extra = 'late=' + str(late)
            good = res and mid['goal']!='' and not errs
            if card=='proposal': good = good and mid['ev']=='proposal'
            if card=='birthday': good = good and late in ('song','toast')
            if card=='newbie': good = good and 'newbie' in mid['diners']
            if card=='gfdate': good = good and 'gf' in mid['diners']
            ok(f'饭局卡 {card}', good, (mid, extra, errs[:2]))
            await pg.close()

        # 4 旧存档迁移
        pg, errs = await page(b, init="try{localStorage.setItem('hp_profile', JSON.stringify({v:2,rules:2,tutorialDone:true,best:11500,bestBy:{solo:11500},games:5,coins:900,daily:{day:0,best:11500,plays:0},seen:{}}))}catch(e){}")
        pr = json.loads(await pg.evaluate("JSON.stringify({best:HP.profile().best, coins:HP.profile().coins, personas:typeof HP.profile().personas, moments:Array.isArray(HP.profile().moments), ver:document.getElementById('h-ver').textContent})"))
        ok('旧存档：最高分清零、金币保留、新字段补齐', pr['best']==0 and pr['coins']==900 and pr['personas']=='object' and pr['moments'], pr)
        await pg.close()

        # 5 今日饭局：第二局是练习
        pg, errs = await page(b)
        await pg.evaluate("var p=HP.profile(); p.tutorialDone=true; p.games=9; Object.keys(HP.SCENES).forEach(function(k){p.seen['scene_'+k]=1}); p.seen.serve=1;")
        for i in range(2):
            await pg.evaluate("document.getElementById('btn-daily').click()"); await pg.wait_for_timeout(400)
            await pg.evaluate("document.getElementById('flip').click()"); await pg.wait_for_timeout(1500)
            sub = await pg.evaluate("document.getElementById('hud-sub').textContent")
            await pg.evaluate("HP.game.stats.score = %d; HP.game.elapsed=60" % (500 if i==0 else 9000)); await pg.wait_for_timeout(1500)
            if i==1: ok('今日饭局第二局标「练习」、不刷新今日成绩', '练习' in sub and await pg.evaluate("HP.profile().daily.best")==500, sub)
            await pg.evaluate("document.getElementById('btn-home').click()"); await pg.wait_for_timeout(400)
        dlab = await pg.evaluate("document.getElementById('d-date').textContent + ' | ' + document.getElementById('d-best').textContent")
        ok('首页今日饭局显示期数和饭局卡', '第' in dlab and '期' in dlab, dlab)
        # 6 图鉴/商店/怎么玩/配对 都能打开
        for btn, ov in [('btn-codex','codex'),('btn-shop','shop'),('btn-howto','howto')]:
            await pg.evaluate(f"document.getElementById('{btn}').click()"); await pg.wait_for_timeout(300)
            vis = await pg.evaluate(f"!document.getElementById('{ov}').classList.contains('hidden')")
            if ov=='codex':
                for tab in ['per','dex','mom','ach']:
                    await pg.evaluate(f"document.querySelector('[data-tab={tab}]').click()"); await pg.wait_for_timeout(100)
            await pg.evaluate(f"document.querySelector('#{ov} .close, #{ov} [data-close]') && document.querySelector('#{ov} [data-close]').click()"); await pg.wait_for_timeout(200)
            ok(f'{ov} 面板能打开关闭', vis)
        ok('面板操作无报错', not errs, errs[:3]); await pg.close()

        # 7 羁绊满级才出现羁绊卡
        pg, errs = await page(b)
        a = await pg.evaluate("HP.cardPool('bros', {bond:{laowang:10}}).some(c=>c.id==='gfdate')")
        c = await pg.evaluate("HP.cardPool('bros', {bond:{laowang:60}}).some(c=>c.id==='gfdate')")
        ok('羁绊卡：老王满级前不出现、满级后出现', (not a) and c)
        # 8 人格：每个人格都有线索；稀有度合法；最佳/最差饭搭子都存在
        bad = await pg.evaluate("HP.PERSONAS.filter(p=>!p.hint || !HP.RARE[p.rare] || !HP.personaById(p.best) || !HP.personaById(p.worst)).map(p=>p.id)")
        ok('32 个人格数据完整', not bad, bad)
        await pg.close()

        # 9 小屏 / 大屏 布局截图
        for vw,vh,tag in [(360,640,'small'),(430,932,'big')]:
            pg, errs = await page(b, vw, vh)
            await pg.evaluate(SETUP, {'scene':'team','card':'proposal'}); await pg.wait_for_timeout(300)
            await pg.evaluate("document.getElementById('flip').click()"); await pg.wait_for_timeout(5000)
            lay = json.loads(await pg.evaluate("JSON.stringify({potTop:HP.game.potY, potBottom:HP.game.potY+HP.game.potSize, seatTop:HP.game.seatTop, band:HP.game.seatBand, tray:document.getElementById('tray').getBoundingClientRect().top, tools:document.getElementById('tools').getBoundingClientRect().bottom, goal:document.getElementById('goal').getBoundingClientRect()})"))
            await pg.screenshot(path=f'/tmp/lay_{tag}.png')
            ok(f'{tag} {vw}x{vh} 锅不压托盘、座位不压工具栏', lay['potBottom'] <= lay['tray']+30 and lay['seatTop'] >= lay['tools']-2, lay)
            await pg.close()
        await b.close()
    print('\n总计', sum(1 for r in R if r[1]), '/', len(R), '通过')
asyncio.run(main())
