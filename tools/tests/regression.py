"""火锅局回归测试（Playwright + Chrome）。
用法：项目根目录 python3 -m http.server 8765，然后 python3 tools/tests/regression.py
覆盖：火锅日记逐天解锁 / 每天最多 3 天 / 第一天就有抢菜、暂停与返回（任何返回都回首页）、各剧本 × 锅底、饭局卡三选一、每张卡、饭局夜叠卡、翻台挑战、
11 道菜的特殊玩法、每日一锅确定性、挑战码、丢分分析、纪录线、结算页、平台接口（模拟小红书容器）、存档迁移、渲染节流、布局。"""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = 'http://localhost:8765/index.html'
R = []
def ok(name, cond, info=''):
    R.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ') + name + (' | ' + str(info)[:300] if info else ''))

# 老玩家：日记全开、所有说明都看过
VETERAN = """() => { var p=HP.profile(); p.tutorialDone=true; p.games=9; p.day=HP.DAY_MAX;
  for (var i=1;i<=HP.DAY_MAX;i++){ p.seen['lesson_'+i]=1; p.seen['dayintro_'+i]=1; }
  Object.keys(HP.SCENES).forEach(function(k){p.seen['scene_'+k]=1}); p.seen.serve=1; p.seen.heat_jiugong=1; p.seen.heat_yuanyang=1; }"""
# 结束当前这局：给够 2 颗星需要的数据
FINISH_2STAR = "(()=>{var s=HP.game.stats; s.self=Math.max(s.self,5); s.orders=Math.max(s.orders,2); s.ordersDone=s.orders; if(HP.game.endless){s.strikes=3}else{HP.game.elapsed=60}})()"
PICK_FIRST_CARD = "(()=>{var b=document.querySelector('#ch-list .ch-card'); if(b) b.click();})()"

# 模拟小红书容器：所有调用记到 window.__calls
XHS_MOCK = r"""
(function(){
  window.__calls=[]; var store={}, rankTries=0, best={};
  function ok(n,x){ var r={errMsg:n+':ok'}; for(var k in (x||{})) r[k]=x[k]; return Promise.resolve(r); }
  window.xhs={ launchOptions:{ miniToolEnv:{ buildVersion: 9562004 } }, miniTool:{
    setStorage:function(o){ store[o.key]=o.data; return ok('setStorage'); },
    getStorage:function(o){ return store[o.key]!=null? ok('getStorage',{data:store[o.key]}) : Promise.reject({errMsg:'getStorage:fail'}); },
    getWindowInfo:function(){ return ok('getWindowInfo',{windowWidth:390,windowHeight:844,statusBarHeight:44,safeArea:{top:44,bottom:810},
      menuButtons:{capsule:{left:300,top:48,right:380,bottom:80,width:80,height:32},back:null,me:null,share:null}}); },
    vibrateShort:function(o){ __calls.push(['vibrateShort',o.type]); return ok('vibrateShort'); },
    setKeepScreenOn:function(o){ __calls.push(['keep',o.keepScreenOn]); return ok('setKeepScreenOn'); },
    saveImageToPhotosAlbum:function(o){ __calls.push(['save',o.filePath.slice(0,22)]); return ok('saveImageToPhotosAlbum'); },
    writeTempFile:function(o){ __calls.push(['temp',o.data.slice(0,22)]); return ok('writeTempFile',{filePath:'ttfile://tmp/card.jpg'}); },
    postNote:function(o){ __calls.push(['post',o]); return ok('postNote'); },
    share:function(o){ __calls.push(['share',o.type]); return ok('share'); },
    submitScore:function(o){ __calls.push(['submit',o.board,o.score]); best[o.board]=Math.max(best[o.board]==null?-1e9:best[o.board],o.score); return ok('submitScore',{score:best[o.board]}); },
    getRankList:function(o){ __calls.push(['list',o.board,o.period]); if(rankTries++===0) return Promise.reject({errMsg:'getRankList:fail',errCode:2002});
      var d=[]; for(var i=1;i<=100;i++) d.push({rank:i,score:5000-i*30,nickname:i%9===0?null:'小红薯'+i}); return ok('getRankList',{data:d}); },
    getMyRank:function(o){ __calls.push(['my',o.board,o.period]); if(window.__deny) return Promise.reject({errMsg:'getMyRank:fail',errCode:1005});
      return ok('getMyRank', window.__my || {status:'EXACT',rank:7,score:4790}); }
  }, AI:{ createModel:function(n){ return { generateText:function(o){ __calls.push(['ai',n,o.messages.length]);
      return Promise.resolve({choices:[{message:{content:'涮得像在做实验，吃得像在赶飞机'}}]}); } }; } } };
})();"""
XHS_OLD_CLIENT = XHS_MOCK.replace('9562004', '9500001')
XHS_NO_STORAGE = "window.xhs={miniTool:{vibrateShort:function(){return Promise.resolve({})}}};"

async def page(b, vw=390, vh=844, init=None):
    pg = await b.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=True)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(m.text))
    if init: await pg.add_init_script(init)
    await pg.goto(URL); await pg.wait_for_timeout(2200)
    return pg, errs

async def js(pg, code, arg=None):
    return await pg.evaluate(code, arg) if arg is not None else await pg.evaluate(code)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

        # ---------- 1. 新玩家：火锅日记第 1 天 ----------
        pg, errs = await page(b)
        ok('新玩家首页：日记第 1 天、今日火锅锁着', await js(pg, "document.getElementById('dy-n').textContent.indexOf('第 1 ')===0 && !document.getElementById('d-lock').classList.contains('hidden')"))
        await js(pg, "document.getElementById('diary').click()"); await pg.wait_for_timeout(500)
        t = await js(pg, "document.getElementById('coach-title').textContent")
        ok('第 1 天先教「煮」（编号从第 1 步开始）', '第 1 步 · 煮' in t, t)
        # 用游戏接口走完第 1 天的三步：煮下锅 → 捞起 → 夹给闺蜜
        await js(pg, """() => { var g=HP.game; var r=document.getElementById('plate-luncheon').getBoundingClientRect(), c=document.getElementById('cv').getBoundingClientRect();
          g.dragStart('luncheon', r.left-c.left+r.width/2, r.top-c.top+r.height/2); var z=g.zones[3], q=g.toScreen(z.cx,z.cy); g.dragMove(q.x,q.y+54*g.unit); g.dragEnd(); }""")
        await pg.wait_for_timeout(400)
        await js(pg, "(()=>{var g=HP.game,f=g.foods.filter(x=>x.state==='in')[0]; f.d=HP.FOODS[f.type].a+1; var p=g.toScreen(f.nx,f.ny); g.pointerDown(p.x,p.y); g.pointerUp();})()")
        await pg.wait_for_timeout(1800)
        t = await js(pg, "document.getElementById('coach-title').textContent")
        ok('第 1 天教「护食」：老王来抢鸭血', '第 2 步 · 护食' in t and await js(pg, "HP.game.npcs.length>0 && HP.game.npcs[0].phase!=='idle'"), t)
        # 点老王的筷子挡开（等筷子伸到看得见的地方）
        await pg.wait_for_timeout(1200)
        await js(pg, "(()=>{var g=HP.game,n=g.npcs[0]; if(n.tip){g.pointerDown(n.tip.x,n.tip.y); g.pointerUp();}})()")
        await pg.wait_for_timeout(5000)
        t = await js(pg, "document.getElementById('coach-title').textContent")
        ok('护食学完进入「照顾同桌」', '第 3 步 · 照顾同桌' in t, t)
        await js(pg, "(()=>{var g=HP.game,f=g.foods.filter(x=>x.state==='in'&&x.type==='luncheon')[0], d=g.diners.filter(x=>x.id==='friend')[0]; var p=g.toScreen(f.nx,f.ny); g.pointerDown(p.x,p.y); g.pointerMove(p.x+20,p.y-30); g.pointerMove(d.x,d.y+54*g.unit); g.pointerUp();})()")
        await pg.wait_for_timeout(1900)
        t = await js(pg, "document.getElementById('coach-title').textContent")
        ok('第 1 天教学走到「学会了」', '第 1 天' in t, t)
        await js(pg, "document.getElementById('coach-btn').click()"); await pg.wait_for_timeout(600)
        st = json.loads(await js(pg, "JSON.stringify({mode:HP.game.mode,run:HP.game.running,npcs:HP.game.npcs.length,cards:HP.game.cards.length,tray:[].map.call(document.querySelectorAll('.plate'),e=>e.dataset.food)})"))
        swish = await js(pg, "[].some.call(document.querySelectorAll('.plate'),e=>HP.FOODS[e.dataset.food].mode==='swish')")
        ok('第 1 天正式局：只有煮的菜、老王会抢菜、没饭局卡', st['mode'] == 'play' and st['run'] and st['npcs'] > 0 and st['cards'] == 0 and not swish, st)
        await pg.wait_for_timeout(1500)
        await js(pg, FINISH_2STAR); await pg.wait_for_timeout(1400)
        r1 = json.loads(await js(pg, "JSON.stringify({day:HP.profile().day, txt:document.getElementById('r-day').textContent, top:document.getElementById('btn-again').getBoundingClientRect().top, img:document.getElementById('r-img').getBoundingClientRect().top, next:document.getElementById('r-next-text').textContent})"))
        ok('拿 2 星日记翻到第 2 天', r1['day'] == 2 and '第 2 天' in r1['txt'], r1)
        ok('结算页：「再来一局」在结算卡上面、有下一个解锁', r1['top'] < r1['img'] and '解锁' in r1['next'], r1)
        # 第 2 天：先教涮；然后连续拿星，第 4 天后今天写满
        for i in range(4):
            await js(pg, "document.getElementById('btn-home').click()"); await pg.wait_for_timeout(300)
            await js(pg, "document.getElementById('diary').click()"); await pg.wait_for_timeout(500)
            if await js(pg, "!document.getElementById('coach').classList.contains('hidden')"):
                await js(pg, "document.getElementById('coach-skip').click()"); await pg.wait_for_timeout(500)
            if await js(pg, "!document.getElementById('intro').classList.contains('hidden')"):
                await js(pg, "document.getElementById('btn-intro').click()"); await pg.wait_for_timeout(400)
            await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(2200)
            await js(pg, FINISH_2STAR); await pg.wait_for_timeout(1400)
        cap = json.loads(await js(pg, "JSON.stringify({day:HP.profile().day, txt:document.getElementById('r-day').textContent})"))
        ok('一个自然日最多翻 3 天（停在第 4 天，提示明天）', cap['day'] == 4 and '明天' in cap['txt'], cap)
        ok('第 4 天也照样有人抢菜', await js(pg, "HP.game.npcs.length>0"))
        ok('新玩家流程无报错', not errs, errs[:3]); await pg.close()

        # ---------- 2. 每个剧本 × 两种锅：三选一、开局、出单、结算 ----------
        for sc in ['bros', 'team', 'date', 'family', 'solo']:
            for pot in ['jiugong', 'yuanyang']:
                pg, errs = await page(b)
                await js(pg, VETERAN)
                await js(pg, "(o)=>{var p=HP.profile(); p.pots=['jiugong','yuanyang']; p.pot=o.pot; document.querySelector('[data-scene='+o.sc+']').click();}", {'sc': sc, 'pot': pot})
                await pg.wait_for_timeout(400)
                choices = await js(pg, "document.querySelectorAll('#ch-list .ch-card').length")
                await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(8000 if sc == 'team' else 6000)
                st = json.loads(await js(pg, "JSON.stringify({orders:HP.game.stats.orders, card:HP.game.cards.length, pot:HP.game.potId, run:HP.game.running})"))
                await js(pg, "HP.game.elapsed=60"); await pg.wait_for_timeout(1400)
                res = await js(pg, "!document.getElementById('result').classList.contains('hidden') && document.getElementById('r-img').src.length>1000")
                ok(f'{sc}/{pot} 三选一={choices} 出单={st["orders"]} 结算={res}', res and st['run'] and choices >= 2 and st['card'] == 1 and (st['orders'] > 0) == (sc != 'solo') and st['pot'] == pot, st)
                if errs: ok(f'{sc}/{pot} 无报错', False, errs[:2])
                await pg.close()

        # ---------- 3. 每张饭局卡 ----------
        for card, sc in [('heartbreak', 'bros'), ('diet', 'bros'), ('newbie', 'team'), ('blackout', 'solo'), ('aa', 'date'), ('birthday', 'family'), ('proposal', 'team'), ('freemaodu', 'bros'), ('gfdate', 'bros')]:
            pg, errs = await page(b)
            await js(pg, VETERAN)
            await js(pg, "(o)=>{var p=HP.profile(); p.bond={laowang:60}; var orig=HP.pickCards; HP.pickCards=function(){return [HP.cardById(o.card)]}; document.querySelector('[data-scene='+o.sc+']').click(); HP.pickCards=orig;}", {'sc': sc, 'card': card})
            await pg.wait_for_timeout(300); await js(pg, PICK_FIRST_CARD)
            await js(pg, "HP.game.propAt=4"); await pg.wait_for_timeout(5500)
            mid = json.loads(await js(pg, "JSON.stringify({ev:HP.game.event&&HP.game.event.type, goal:document.getElementById('goal').textContent, diners:HP.game.diners.map(d=>d.id)})"))
            await js(pg, "HP.game.elapsed=50"); await pg.wait_for_timeout(3500)
            late = await js(pg, "HP.game.event&&HP.game.event.type")
            await js(pg, "HP.game.elapsed=60"); await pg.wait_for_timeout(1400)
            res = await js(pg, "!document.getElementById('result').classList.contains('hidden')")
            good = res and mid['goal'] != '' and not errs
            if card == 'proposal': good = good and mid['ev'] == 'proposal'
            if card == 'birthday': good = good and late in ('song', 'toast')
            if card == 'newbie': good = good and 'newbie' in mid['diners']
            if card == 'gfdate': good = good and 'gf' in mid['diners']
            ok(f'饭局卡 {card}', good, (mid, late, errs[:2]))
            await pg.close()

        # ---------- 4. 饭局夜：三桌、卡一路叠加、总分 ----------
        pg, errs = await page(b, init=XHS_MOCK)
        await js(pg, VETERAN)
        await js(pg, "document.getElementById('btn-night').click()"); await pg.wait_for_timeout(400)
        scores, stacks, scenes = [], [], []
        for i in range(3):
            await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1500)
            stacks.append(await js(pg, "HP.game.cards.length")); scenes.append(await js(pg, "HP.game.sceneId"))
            await js(pg, "HP.game.stats.score=%d; HP.game.elapsed=60" % (300 + i * 100)); await pg.wait_for_timeout(1400)
            if i < 2:
                ok(f'饭局夜第 {i+1} 桌后出中场', await js(pg, "!document.getElementById('night').classList.contains('hidden')"))
                await js(pg, "document.getElementById('btn-next-table').click()"); await pg.wait_for_timeout(400)
        tot = await js(pg, "+document.getElementById('r-score').textContent")
        ok('饭局夜：朋友局→团建→家宴，卡叠到 3 张，总分=三桌之和', scenes == ['bros', 'team', 'family'] and stacks == [1, 2, 3] and tot >= 300 + 400 + 500, (scenes, stacks, tot))
        ok('饭局夜记最高分', await js(pg, "HP.profile().bestBy.night") == tot)
        await pg.wait_for_timeout(2500)
        ok('饭局夜整晚总分提交到 3 号榜（本周名次显示在结算页）', await js(pg, "__calls.some(c=>c[0]==='submit'&&c[1]===3&&c[2]===%d)" % tot) and '饭局夜本周排名' in await js(pg, "document.getElementById('r-rank').textContent"))
        ok('饭局夜无报错', not errs, errs[:3]); await pg.close()

        # ---------- 5. 翻台挑战：没有倒计时，离席 3 次结束 ----------
        pg, errs = await page(b, init=XHS_MOCK)
        await js(pg, VETERAN)
        await js(pg, "document.getElementById('btn-rush').click()"); await pg.wait_for_timeout(1500)
        e1 = json.loads(await js(pg, "JSON.stringify({endless:HP.game.endless, tl:HP.game.timeLeft, run:HP.game.running})"))
        await js(pg, "HP.game.elapsed=200"); await pg.wait_for_timeout(500)
        still = await js(pg, "HP.game.running")
        await js(pg, "(()=>{var g=HP.game; for(var i=0;i<3;i++){ var d=g.diners[i%g.diners.length]; d.away=0; d.order={type:g.menu[0],auth:false,t:0,ttl:1}; g.missOrder(d);} })()")
        await pg.wait_for_timeout(1200)
        e2 = json.loads(await js(pg, "JSON.stringify({run:HP.game.running, res:!document.getElementById('result').classList.contains('hidden'), best:HP.profile().bestBy.rush, cell:document.querySelector('#r-img')!=null})"))
        ok('翻台挑战：200 秒还没结束，离席 3 次就结算', e1['endless'] and still and not e2['run'] and e2['res'], (e1, e2))
        ok('翻台挑战成绩提交到 2 号榜', await js(pg, "__calls.some(c=>c[0]==='submit'&&c[1]===2)"))
        ok('翻台挑战无报错', not errs, errs[:3]); await pg.close()

        # ---------- 6. 每道解锁菜的特殊玩法（直接驱动游戏逻辑） ----------
        pg, errs = await page(b)
        await js(pg, VETERAN)
        await js(pg, "document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(800)
        sp = json.loads(await js(pg, """JSON.stringify((function(){
          var g=HP.game, F=HP.FOODS, mid=function(t){return (F[t].a+F[t].b)/2}, R=function(o){return g.rate(o).kind+':'+g.rate(o).label};
          var out={};
          out.shake0=R({type:'tenderbeef',d:mid('tenderbeef'),shakes:1,dips:0}); out.shake3=R({type:'tenderbeef',d:mid('tenderbeef'),shakes:3,dips:0});
          out.still0=R({type:'goose',d:mid('goose'),dips:0}); out.still1=R({type:'goose',d:mid('goose'),dips:2});
          out.hotY=R({type:'kidney',d:mid('kidney'),dips:0,hot:0.9}); out.hotN=R({type:'kidney',d:mid('kidney'),dips:0,hot:0.2});
          out.duck3=R({type:'duckintestine',d:mid('duckintestine'),dips:3}); out.duck0=R({type:'duckintestine',d:mid('duckintestine'),dips:0});
          out.maodu=g.rate({type:'maodu',d:6,dips:7}).authentic===true && g.rate({type:'duckintestine',d:4,dips:3}).authentic!==true;
          out.crispE=R({type:'lotus',d:F.lotus.a+0.5}); out.crispL=R({type:'lotus',d:F.lotus.b-0.5});
          out.soak=R({type:'tofu',d:F.tofu.b+3}); out.soakOver=R({type:'tofu',d:F.tofu.b+12});
          // 冬瓜占两格：九宫格一格最多两块
          var z=g.zones[0], ok1=g.addFood('wintermelon',z.cx,z.cy), ok2=g.addFood('potato',z.cx,z.cy); out.bulky=[ok1,ok2];
          // 黄喉会漂
          var z4=g.zones[4]; g.addFood('huanghou',z4.cx,z4.cy); var hh=g.foods[g.foods.length-1], x0=hh.nx, y0=hh.ny; for(var i=0;i<60;i++) g.update(1/30);
          out.drift=Math.hypot(hh.nx-x0,hh.ny-y0)>0.02 && g.cellAt(hh.nx,hh.ny)>=0;
          // 牛肉丸煮过头会爆
          var z2=g.zones[2]; g.addFood('beefball',z2.cx,z2.cy); var bb=g.foods[g.foods.length-1]; bb.d=F.beefball.b+2.4; var sc0=g.stats.score; for(var j=0;j<30;j++) g.update(1/30);
          out.burst=g.foods.indexOf(bb)<0 && g.stats.burst===1 && g.stats.log.indexOf('B')>=0;
          // 香菇熟透会沉
          var z6=g.zones[6]; g.addFood('shiitake',z6.cx,z6.cy); var sh=g.foods[g.foods.length-1]; sh.d=F.shiitake.b+0.5; for(var k=0;k<60;k++) g.update(1/30); out.sink=sh.depth>0.6;
          // 贡菜：夹给同桌 ×2，自己吃 ×0.5
          var d=g.diners[0]; d.order=null; var s1=g.stats.score; g.serve({type:'gongcai',d:3,dips:0},d,100,100); var gainServe=g.stats.score-s1;
          var s2=g.stats.score; g.stats.pickedBy={}; g.stats.combo=0; g.award({type:'gongcai',d:3,dips:0,cell:4},100,100); var gainSelf=g.stats.score-s2;
          out.share=[gainServe,gainSelf];
          return out; })())"""))
        ok('嫩牛肉要抖散', sp['shake0'].startswith('ok') and sp['shake3'].startswith('perfect'), (sp['shake0'], sp['shake3']))
        ok('鹅肠别提起来', sp['still0'].startswith('perfect') and sp['still1'].startswith('ok'), (sp['still0'], sp['still1']))
        ok('腰片要大火', sp['hotY'].startswith('perfect') and sp['hotN'].startswith('ok'), (sp['hotY'], sp['hotN']))
        ok('鸭肠三上三下（不算七上八下）', '三上三下' in sp['duck3'] and sp['duck0'].startswith('ok') and sp['maodu'], (sp['duck3'], sp['duck0']))
        ok('藕片要脆', '脆' in sp['crispE'] and sp['crispL'].startswith('ok'), (sp['crispE'], sp['crispL']))
        ok('冻豆腐越煮越入味', '吸饱' in sp['soak'] and sp['soakOver'].startswith('over'), (sp['soak'], sp['soakOver']))
        ok('冬瓜占两格', sp['bulky'][0] is True and sp['bulky'][1] == 'full', sp['bulky'])
        ok('黄喉会漂', sp['drift']); ok('牛肉丸会爆汁', sp['burst']); ok('香菇会沉', sp['sink'])
        ok('贡菜：夹给同桌分数高于自己吃', sp['share'][0] > sp['share'][1] > 0, sp['share'])
        ok('特殊玩法无报错', not errs, errs[:3]); await pg.close()

        # ---------- 7. 每日一锅：玩家怎么玩都不影响事件和点单顺序 ----------
        pg, errs = await page(b)
        det = json.loads(await js(pg, """JSON.stringify((function(){
          function run(active){
            var g=HP.game, D=HP.dailySetup(20261124), c=HP.pickCard(D.scene,null,HP.rng(D.seed+7));
            g.mode='play'; g.setup({scene:D.scene,seed:D.seed,pot:D.pot,menu:D.menu,cards:c?[c]:[]}); g.reset(); g.running=true;
            var end=g.hooks.onEnd; g.hooks.onEnd=function(){};
            var evs=[], orders={}, st=g.startEvent, no=g.newOrder;
            g.startEvent=function(t,o){ evs.push(t); return st.call(this,t,o); };
            g.newOrder=function(d){ no.call(this,d); if(d.order) (orders[d.id]=orders[d.id]||[]).push(d.order.type); };
            for(var f=0; f<30*60 && g.running; f++){
              if(active){
                if(g.event && g.event.type==='toast' && g.event.t>0.3) g.toast();
                g.diners.forEach(function(d){ if(d.order && d.order.t>1.5){ var F=HP.FOODS[d.order.type]; g.serve({type:d.order.type,d:(F.a+F.b)/2,dips:F.dips?F.dips[0]:0,shakes:5,hot:1},d,50,50); } });
              }
              g.update(1/30);
            }
            g.hooks.onEnd=end; delete g.startEvent; delete g.newOrder; g.running=false;
            return {evs:evs, orders:orders};
          }
          var a=run(false), b=run(true), same=true, n=0;
          for(var k in a.orders){ var x=a.orders[k], y=b.orders[k]||[], m=Math.min(x.length,y.length); n+=m; for(var i=0;i<m;i++) if(x[i]!==y[i]) same=false; }
          return {evA:a.evs, evB:b.evs, same:same, n:n};
        })())"""))
        ok('每日一锅：挂机和认真玩，突发事件顺序一样', det['evA'] == det['evB'] and len(det['evA']) >= 2, det)
        ok('每日一锅：每个同桌点单顺序一样', det['same'] and det['n'] >= 4, det)
        await pg.close()

        # ---------- 8. 挑战码 ----------
        pg, errs = await page(b)
        cc = json.loads(await js(pg, """JSON.stringify((function(){
          var bad=0;
          for(var i=0;i<500;i++){ var c={seed:1+Math.floor(Math.random()*1048575), scene:HP.SCENE_ORDER[i%6], pot:i%2?'yuanyang':'jiugong', score:Math.floor(Math.random()*16000)};
            var d=HP.decodeChallenge(HP.prettyCode(HP.encodeChallenge(c)).toLowerCase());
            if(!d||d.kind!=='custom'||d.seed!==c.seed||d.scene!==c.scene||d.pot!==c.pot||d.score!==c.score) bad++; }
          var dd=HP.decodeChallenge(HP.encodeChallenge({issue:42,score:2380}));
          var code=HP.encodeChallenge({seed:12345,scene:'team',pot:'jiugong',score:999}), t=(code[0]==='Z'?'Y':'Z')+code.slice(1);
          var a=HP.challengeSetup(777,'bros','jiugong'), b2=HP.challengeSetup(777,'bros','jiugong');
          return {bad:bad, daily:dd, tamper:HP.decodeChallenge(t), len:code.length, same:JSON.stringify(a.menu)===JSON.stringify(b2.menu)&&(a.card&&a.card.id)===(b2.card&&b2.card.id)};
        })())"""))
        ok('挑战码：500 个随机码往返无误、9 位、改一位就失效', cc['bad'] == 0 and cc['len'] == 9 and cc['tamper'] is None, cc)
        ok('挑战码：今日火锅期数码', cc['daily'] == {'kind': 'daily', 'issue': 42, 'score': 2380}, cc['daily'])
        ok('挑战码：同一种子菜单和卡一样', cc['same'])
        await js(pg, VETERAN)
        code = await js(pg, "HP.prettyCode(HP.encodeChallenge({seed:4242,scene:'bros',pot:'jiugong',score:5000}))")
        await js(pg, "document.getElementById('btn-code').click()"); await pg.wait_for_timeout(200)
        await pg.fill('#cb-field', code); await js(pg, "document.getElementById('cb-go').click()"); await pg.wait_for_timeout(2500)
        ch = json.loads(await js(pg, "JSON.stringify({seed:HP.game.seed, best:HP.game.best, rec:!document.getElementById('rec').classList.contains('hidden'), txt:document.getElementById('rec-text').textContent})"))
        ok('输入挑战码进同一锅，纪录线显示对方分数', ch['seed'] == 4242 and ch['best'] == 5000 and ch['rec'] and '对方' in ch['txt'], ch)
        await js(pg, "HP.game.stats.score=1200; HP.game.elapsed=60"); await pg.wait_for_timeout(1400)
        vs = await js(pg, "document.getElementById('r-vs').textContent")
        ok('挑战结算显示胜负', '惜败' in vs and '5000' in vs, vs)
        await js(pg, "document.getElementById('btn-challenge').click()"); await pg.wait_for_timeout(200)
        back = await js(pg, "HP.decodeChallenge(document.getElementById('cb-code').textContent)")
        ok('回敬的挑战码带上自己的分数', back and back['seed'] == 4242 and back['score'] == 1200, back)
        await js(pg, "document.getElementById('cb-field').value='ABC'; document.getElementById('cb-back').click()")
        ok('挑战码流程无报错', not errs, errs[:3]); await pg.close()

        # ---------- 9. 丢分分析、纪录线 ----------
        pg, errs = await page(b)
        await js(pg, VETERAN)
        await js(pg, "HP.profile().bestBy.bros=1000; document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(800)
        await js(pg, "(()=>{var g=HP.game; g.award({type:'beef',d:0.5,dips:0,cell:4},100,100); g.award({type:'beef',d:1,dips:0,cell:4},100,100); g.stats.score=900; g.elapsed=52;})()")
        await pg.wait_for_timeout(500)
        rec = json.loads(await js(pg, "JSON.stringify({cls:document.getElementById('rec').className, txt:document.getElementById('rec-text').textContent})"))
        ok('最后 10 秒纪录线提示还差多少', 'close' in rec['cls'] and '还差' in rec['txt'], rec)
        await js(pg, "HP.game.elapsed=60"); await pg.wait_for_timeout(1400)
        loss = await js(pg, "document.getElementById('r-loss').textContent")
        rr = await js(pg, "document.getElementById('r-rec').textContent")
        ok('丢分分析指出吃了生的', '吃了生的' in loss and '下次试试' in loss, loss)
        ok('结算显示差多少分破纪录', '破纪录' in rr, rr)
        await pg.close()

        # ---------- 10. 模拟小红书容器：发笔记、亮屏、排行榜、AI 锐评、存档 ----------
        pg, errs = await page(b, init=XHS_MOCK)
        await js(pg, VETERAN)
        await js(pg, "document.getElementById('btn-daily').click()"); await pg.wait_for_timeout(2600)
        keep_on = await js(pg, "__calls.some(c=>c[0]==='keep'&&c[1]===true)")
        await js(pg, "HP.game.stats.self=5; HP.game.stats.orders=2; HP.game.stats.ordersDone=2; HP.game.stats.log=['P','P','O','R','S']; HP.game.elapsed=60"); await pg.wait_for_timeout(1800)
        keep_off = await js(pg, "__calls.some(c=>c[0]==='keep'&&c[1]===false)")
        ok('对局中保持亮屏、结束关掉', keep_on and keep_off)
        ok('今日火锅正式成绩提交排行榜', await js(pg, "__calls.some(c=>c[0]==='submit'&&c[1]===1)"))
        await pg.wait_for_timeout(2500)
        rr = await js(pg, "document.getElementById('r-rank').classList.contains('hidden') ? '' : document.getElementById('r-rank').textContent")
        ok('结算页：今日排名 + 离上一名差多少', '今日火锅排名：第 7 名' in rr and '再多 31 分超过第 6 名' in rr, rr)
        await js(pg, "document.getElementById('r-rank').click()"); await pg.wait_for_timeout(600)
        ok('结算页点名次打开今日榜', await js(pg, "!document.getElementById('rank').classList.contains('hidden') && document.querySelectorAll('#rk-body .rk-row').length===100"))
        await js(pg, "document.querySelector('#rank [data-close]').click()"); await pg.wait_for_timeout(300)
        ok('从结算页打开的榜，返回回到结算页', await js(pg, "!document.getElementById('result').classList.contains('hidden')"))
        ok('AI 锐评显示在结算页', '赶飞机' in await js(pg, "document.getElementById('r-ai').textContent"))
        await js(pg, "document.getElementById('btn-post').click()"); await pg.wait_for_timeout(600)
        post = json.loads(await js(pg, "JSON.stringify(__calls.filter(c=>c[0]==='post').map(c=>c[1])[0]||null)"))
        ok('一键发笔记：标题≤20字、正文带格子图和挑战码、图片走临时文件',
           post and len(post['title']) <= 20 and '🟩' in post['content'] and '挑战码' in post['content'] and post['mediaInfo']['image_resources'][0]['url'].startswith('ttfile://') and post['pageType'] == 'photo_publish', post and {'title': post['title'], 'content': post['content'][:80]})
        await js(pg, "document.getElementById('btn-home').click()"); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(300)
        ok('首页排行榜入口显示今日名次、今日格子图', await js(pg, "!document.getElementById('h-rank').classList.contains('hidden') && document.getElementById('h-rank-text').textContent.indexOf('第 7 名')>=0 && document.getElementById('d-grid').textContent.indexOf('🟩')>=0"),
           await js(pg, "document.getElementById('h-rank-text').textContent"))
        await js(pg, "document.getElementById('h-rank').click()"); await pg.wait_for_timeout(2200)
        ok('排行榜：前 100 名、前三名有奖牌、昵称为空显示「神秘食客」', '小红薯1' in await js(pg, "document.getElementById('rk-body').textContent") and await js(pg, "document.querySelectorAll('#rk-body .rk-row.top1,#rk-body .rk-row.top2,#rk-body .rk-row.top3').length===3 && document.getElementById('rk-body').textContent.indexOf('神秘食客')>=0"))
        me = json.loads(await js(pg, "JSON.stringify({row:(document.querySelector('#rk-body .rk-row.me')||{}).textContent, pin:document.getElementById('rk-me').textContent})"))
        ok('我的那一行高亮，底部钉着我的名次和差距', me['row'] and '（我）' in me['row'] and '我 · 第 7 名' in me['pin'] and '再多 31 分' in me['pin'], me)
        await js(pg, "document.querySelector('[data-rk=rush]').click()"); await pg.wait_for_timeout(500)
        await js(pg, "document.querySelector('#rk-per [data-per=all]').click()"); await pg.wait_for_timeout(500)
        ok('翻台榜：本周 / 总榜切换', await js(pg, "__calls.some(c=>c[0]==='list'&&c[1]===2&&c[2]==='week') && __calls.some(c=>c[0]==='list'&&c[1]===2&&c[2]==='all') && document.querySelector('#rk-per .on').textContent==='总榜'"))
        await js(pg, "document.querySelector('[data-rk=night]').click()"); await pg.wait_for_timeout(500)
        ok('饭局夜榜查 3 号榜本周', await js(pg, "__calls.some(c=>c[0]==='list'&&c[1]===3&&c[2]==='week')"))
        await js(pg, "document.querySelector('[data-rk=daily]').click()"); await pg.wait_for_timeout(500)
        await js(pg, "document.querySelector('#rk-me [data-go]').click()"); await pg.wait_for_timeout(2600)
        ok('「去冲榜」直接开今日火锅', await js(pg, "HP.game.running && document.getElementById('hud-scene').textContent==='今日火锅'"))
        await js(pg, "document.getElementById('btn-pause').click()"); await pg.wait_for_timeout(200)
        await js(pg, "document.getElementById('btn-quit').click()"); await pg.wait_for_timeout(300)
        await js(pg, "document.getElementById('h-rank').click()"); await pg.wait_for_timeout(600)
        await js(pg, "document.querySelector('[data-rk=round]').click()"); await pg.wait_for_timeout(800)
        ok('剧本局榜：查 4 号榜本周，写明火锅日记的局也算', await js(pg, "__calls.some(c=>c[0]==='list'&&c[1]===4&&c[2]==='week')") and '火锅日记的局也算' in await js(pg, "document.getElementById('rk-body').textContent"))
        saved = await js(pg, "HP.platform.load('profile').then(p=>p&&p.day)")
        ok('存档写进小红书 Storage', saved == 10, saved)
        ok('模拟容器无报错', not errs, errs[:3]); await pg.close()

        # 新号（小红书容器）：第一局火锅日记打完就上剧本局榜
        pg, errs = await page(b, init=XHS_MOCK + "window.__my={status:'NOT_PARTICIPATING',rank:null,score:null};")
        await pg.wait_for_timeout(300)
        t0 = await js(pg, "document.getElementById('h-rank').classList.contains('hidden') ? '' : document.getElementById('h-rank-text').textContent")
        ok('新号首页：排行榜入口在，提示吃完一局剧本局就能上榜', '剧本局就能上榜' in t0, t0)
        await js(pg, "document.getElementById('diary').click()"); await pg.wait_for_timeout(500)
        await js(pg, "document.getElementById('coach-skip').click()"); await pg.wait_for_timeout(1500)
        await js(pg, "window.__my={status:'EXACT',rank:3,score:900}")
        await js(pg, FINISH_2STAR); await pg.wait_for_timeout(3000)
        rr = await js(pg, "document.getElementById('r-rank').classList.contains('hidden') ? '' : document.getElementById('r-rank').textContent")
        ok('新号第一局：成绩提交到 4 号剧本局榜，结算页显示本周名次', await js(pg, "__calls.some(c=>c[0]==='submit'&&c[1]===4)") and '剧本局本周排名：第 3 名' in rr, rr)
        await js(pg, "document.querySelector('#r-rank').click()"); await pg.wait_for_timeout(600)
        await js(pg, "document.querySelector('#rk-me [data-go]').click()"); await pg.wait_for_timeout(1200)
        ok('剧本局榜「去冲榜」直接开火锅日记这一局', await js(pg, "(HP.game.running && HP.game.mode==='play') || !document.getElementById('intro').classList.contains('hidden') || !document.getElementById('coach').classList.contains('hidden')"))
        ok('新号上榜流程无报错', not errs, errs[:3]); await pg.close()

        # 普通浏览器预览：首页照样有排行榜入口，点开说明要在小红书 App 里看
        pg, errs = await page(b)
        await js(pg, VETERAN)
        hb = json.loads(await js(pg, "JSON.stringify({show:!document.getElementById('h-rank').classList.contains('hidden'), txt:document.getElementById('h-rank-text').textContent, y:document.getElementById('h-rank').getBoundingClientRect().top})"))
        await js(pg, "document.getElementById('h-rank').click()"); await pg.wait_for_timeout(400)
        off = await js(pg, "document.getElementById('rk-body').textContent")
        ok('浏览器预览：首页有排行榜入口，点开说明去小红书 App 里看', hb['show'] and '小红书 App' in hb['txt'] and '要在小红书 App 里看' in off and await js(pg, "document.getElementById('rk-me').classList.contains('hidden')"), (hb, off[:40]))
        await js(pg, "document.querySelector('#rank [data-close]').click()"); await pg.wait_for_timeout(300)
        ok('浏览器预览：排行榜返回回首页、无报错', await js(pg, "!document.getElementById('home').classList.contains('hidden')") and not errs, errs[:2])
        await pg.close()

        # 客户端版本低于 9.51：入口提示升级，不提交；没授权（1005）：按文档隐藏入口
        pg, errs = await page(b, init=XHS_OLD_CLIENT)
        await js(pg, VETERAN)
        old = await js(pg, "HP.platform.rankOk===false && !document.getElementById('h-rank').classList.contains('hidden') && document.getElementById('h-rank-text').textContent.indexOf('9.51')>=0")
        await js(pg, "document.getElementById('btn-daily').click()"); await pg.wait_for_timeout(2600)
        await js(pg, FINISH_2STAR); await pg.wait_for_timeout(1500)
        ok('客户端 9.50：首页入口提示升级到 9.51，不提交成绩、结算页不显示名次', old and await js(pg, "!__calls.some(c=>c[0]==='submit') && document.getElementById('r-rank').classList.contains('hidden')"))
        await pg.close()
        # 版本够、但小红书没给排行榜接口（上传时没选「排行榜」能力）：卡片照样在，写「暂未开放」，点版本号能看原因
        pg, errs = await page(b, init=XHS_MOCK + "delete window.xhs.miniTool.submitScore; delete window.xhs.miniTool.getRankList; delete window.xhs.miniTool.getMyRank;")
        nf = json.loads(await js(pg, "JSON.stringify({st:HP.platform.rankState, show:!document.getElementById('h-rank').classList.contains('hidden'), txt:document.getElementById('h-rank-text').textContent})"))
        await js(pg, "document.getElementById('h-rank').click()"); await pg.wait_for_timeout(400)
        dg = await js(pg, "document.querySelector('#rk-body .diag').textContent")
        await js(pg, "document.querySelector('#rank [data-close]').click(); document.getElementById('h-ver').click()"); await pg.wait_for_timeout(200)
        vm = await js(pg, "document.getElementById('msg').textContent")
        ok('没给排行榜接口：首页卡片写「暂未开放」，榜单页和点版本号都能看到原因', nf['st'] == 'nofn' and nf['show'] and '暂未开放' in nf['txt'] and '没给这个小工具排行榜接口' in dg and '小红书 9.56.2' in vm, (nf, dg, vm))
        await pg.close()

        pg, errs = await page(b, init=XHS_MOCK + "window.__deny=1;")
        await pg.wait_for_timeout(500)
        ok('没勾「用户头像昵称授权」（1005）：首页入口自动藏起来', await js(pg, "HP.platform.rankOk===false && document.getElementById('h-rank').classList.contains('hidden')"))
        await js(pg, "document.getElementById('h-ver').click()"); await pg.wait_for_timeout(200)
        ok('1005 时点版本号能看到错误码', '1005' in await js(pg, "document.getElementById('msg').textContent"))
        await pg.close()

        pg, errs = await page(b, init=XHS_NO_STORAGE)
        ok('小红书版本太低存不了档：首页提示', await js(pg, "!document.getElementById('h-warn').classList.contains('hidden')"))
        await pg.close()

        # ---------- 11. 老存档迁移 ----------
        pg, errs = await page(b, init="try{localStorage.setItem('hp_profile', JSON.stringify({v:2,rules:4,tutorialDone:true,best:11500,bestBy:{solo:11500},games:5,coins:900,daily:{day:0,best:11500,plays:0},seen:{}}))}catch(e){}")
        pr = json.loads(await js(pg, "JSON.stringify({best:HP.profile().best, coins:HP.profile().coins, day:HP.profile().day, freeze:HP.profile().freeze, ver:document.getElementById('h-ver').textContent})"))
        ok('老存档：日记直接全开、最高分按新规则清零、金币保留', pr['day'] == 10 and pr['best'] == 0 and pr['coins'] == 900 and pr['freeze'] == 0 and '计分规则已更新' in pr['ver'], pr)
        await pg.close()

        # ---------- 12. 数据完整性 ----------
        pg, errs = await page(b)
        bad = await js(pg, "HP.PERSONAS.filter(p=>!p.hint || !HP.RARE[p.rare] || !HP.personaById(p.best) || !HP.personaById(p.worst) || p.best===p.worst).map(p=>p.id)")
        clash = await js(pg, "HP.PERSONAS.filter(a=>{var b=HP.personaById(a.best); return b && b.worst===a.id}).map(a=>a.id+'->'+a.best)")
        ok('人格数据完整、最佳和最差不是同一个', not bad, bad)
        ok('人格：A 的最佳饭搭子不会把 A 当最差', not clash, clash)
        sp_all = await js(pg, "HP.FOOD_ORDER.filter(id=>HP.FOODS[id].unlock && !HP.FOODS[id].special && !HP.FOODS[id].dips)")
        ok('每道解锁菜都有自己的玩法', not sp_all, sp_all)
        days = await js(pg, "HP.DAYS.every((d,i)=>d.title&&d.learn&&d.story) && HP.unlockDay('rush')===10 && HP.modeOpen({day:4},'daily') && !HP.modeOpen({day:3},'daily')")
        ok('火锅日记 10 天配置完整', days)
        await pg.close()

        # ---------- 13. 面板盖住时不渲染、首页降帧 ----------
        pg, errs = await page(b)
        await js(pg, VETERAN)
        frames = json.loads(await js(pg, """new Promise(function(res){ var g=HP.game, n=0, r=g.render; g.render=function(){ n++; return r.apply(this, arguments); };
          setTimeout(function(){ var home=n; n=0; document.getElementById('btn-shop').click();
            setTimeout(function(){ var shop=n; g.render=r; res(JSON.stringify({home:home, shop:shop})); }, 1000); }, 1000); })"""))
        ok('首页约 20 帧、商店盖住时不画', 8 <= frames['home'] <= 30 and frames['shop'] == 0, frames)
        await pg.close()

        # ---------- 15. 暂停与返回：任何返回都回游戏首页，不会退出 ----------
        BACK = "new Promise(function(r){ window.addEventListener('popstate', function f(){ window.removeEventListener('popstate', f); setTimeout(r, 120); }); history.back(); })"
        vis = lambda i: f"!document.getElementById('{i}').classList.contains('hidden')"
        pg, errs = await page(b)
        await js(pg, VETERAN)
        h0 = await js(pg, "history.length")
        await js(pg, "document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1500)
        card0 = await js(pg, "HP.game.card&&HP.game.card.id")
        ok('开局垫了一条返回记录', await js(pg, "history.length") == h0 + 1)
        await js(pg, "document.getElementById('btn-pause').click()"); await pg.wait_for_timeout(200)
        st = json.loads(await js(pg, "JSON.stringify({p:" + vis('pause') + ", run:HP.game.running, t:HP.game.elapsed})"))
        await pg.wait_for_timeout(800)
        ok('点左上角暂停：时间停住', st['p'] and not st['run'] and abs(await js(pg, "HP.game.elapsed") - st['t']) < 0.01, st)
        await js(pg, "document.getElementById('btn-resume').click()"); await pg.wait_for_timeout(500)
        ok('继续吃：接着跑', await js(pg, "HP.game.running && document.getElementById('pause').classList.contains('hidden') && HP.game.elapsed>" + str(st['t'])))
        # 返回键：局中 → 暂停；再按 → 回首页
        await js(pg, BACK)
        ok('局中按返回 → 暂停（不退出）', await js(pg, vis('pause') + " && !HP.game.running"))
        await js(pg, "document.getElementById('btn-restart').click()"); await pg.wait_for_timeout(400)
        ok('重新开始：同一张饭局卡、分数清零', await js(pg, "HP.game.running && HP.game.stats.score===0 && HP.game.elapsed<1") and await js(pg, "HP.game.card&&HP.game.card.id") == card0)
        await js(pg, BACK); await js(pg, BACK)
        ok('暂停时再按返回 → 回首页，锅清空', await js(pg, vis('home') + " && !HP.game.running && HP.game.foods.length===0 && document.getElementById('pause').classList.contains('hidden')"))
        # 结算页按返回 → 回首页
        await js(pg, "document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1200)
        await js(pg, FINISH_2STAR); await pg.wait_for_timeout(1400)
        ok('打完一局到结算页', await js(pg, vis('result')))
        await js(pg, BACK)
        ok('结算页按返回 → 回首页', await js(pg, vis('home') + " && document.getElementById('result').classList.contains('hidden')"))
        # 用页面里的按钮回到首页后，再按一次返回：留在首页，提示再按一次才退出
        await js(pg, "document.getElementById('btn-shop').click()"); await pg.wait_for_timeout(200)
        await js(pg, "document.querySelector('#shop [data-close]').click()"); await pg.wait_for_timeout(200)
        await js(pg, BACK)
        ok('首页按返回：提示再按一次退出（还留在首页）', await js(pg, vis('home') + " && document.getElementById('msg').textContent.indexOf('再按一次')>=0"))
        # 各个面板按返回 → 回首页
        for btn in ['btn-shop', 'btn-codex', 'btn-howto', 'btn-code']:
            await js(pg, f"document.getElementById('{btn}').click()"); await pg.wait_for_timeout(200)
            await js(pg, BACK)
            ok(f'{btn} 面板按返回 → 回首页', await js(pg, vis('home')))
        # 三选一、开局说明都有「返回首页」
        await js(pg, "document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, "document.getElementById('ch-back').click()"); await pg.wait_for_timeout(200)
        ok('饭局卡三选一点「返回首页」', await js(pg, vis('home') + " && document.getElementById('choose').classList.contains('hidden')"))
        await js(pg, "delete HP.profile().seen.scene_team; document.querySelector('[data-scene=team]').click()"); await pg.wait_for_timeout(300)
        ok('第一次玩的剧本说明有返回', await js(pg, vis('intro')))
        await js(pg, "document.getElementById('btn-intro-back').click()"); await pg.wait_for_timeout(200)
        ok('说明页返回首页，下次还会再看到说明', await js(pg, vis('home') + " && !HP.profile().seen.scene_team"))
        # 结算页上下都有「回首页」
        await js(pg, "document.querySelector('[data-scene=bros]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1200)
        await js(pg, FINISH_2STAR); await pg.wait_for_timeout(1400)
        await js(pg, "document.getElementById('btn-home2').click()"); await pg.wait_for_timeout(200)
        ok('结算页底部的「回首页」', await js(pg, vis('home')))
        # 切到后台自动暂停
        await js(pg, "document.querySelector('[data-scene=solo]').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1200)
        await js(pg, "Object.defineProperty(document,'hidden',{configurable:true,get:function(){return true}}); document.dispatchEvent(new Event('visibilitychange'));")
        ok('切到后台：局中自动暂停', await js(pg, vis('pause') + " && !HP.game.running"))
        await js(pg, "Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false}}); document.dispatchEvent(new Event('visibilitychange')); document.getElementById('btn-quit').click()")
        await pg.wait_for_timeout(200)
        ok('暂停页「回首页」', await js(pg, vis('home')))
        # 饭局夜中途退出：这一晚作废
        await js(pg, "document.getElementById('btn-night').click()"); await pg.wait_for_timeout(300)
        await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(1200)
        await js(pg, "document.getElementById('btn-pause').click()")
        nt = await js(pg, "document.getElementById('pz-text').textContent")
        await js(pg, "document.getElementById('btn-quit').click()"); await pg.wait_for_timeout(200)
        await js(pg, "document.getElementById('btn-night').click()"); await pg.wait_for_timeout(300)
        ok('饭局夜中途回首页，再进是第 1 桌', '散场' in nt and '第 1 桌' in await js(pg, "document.getElementById('ch-sub').textContent"), nt)
        ok('暂停与返回无报错', not errs, errs[:3]); await pg.close()

        # 新玩家：第 1 天教学中途回首页，下次还会教
        pg, errs = await page(b)
        await js(pg, "document.getElementById('diary').click()"); await pg.wait_for_timeout(500)
        await js(pg, "document.getElementById('btn-pause').click()"); await pg.wait_for_timeout(200)
        tut = json.loads(await js(pg, "JSON.stringify({p:" + vis('pause') + ", restart:document.getElementById('btn-restart').classList.contains('hidden')})"))
        await js(pg, "document.getElementById('btn-quit').click()"); await pg.wait_for_timeout(300)
        back = json.loads(await js(pg, "JSON.stringify({home:" + vis('home') + ", coach:document.getElementById('coach').classList.contains('hidden'), seen:!!HP.profile().seen.lesson_1, run:HP.game.running})"))
        ok('教学里也能暂停（不显示重新开始），回首页后下次接着教', tut['p'] and tut['restart'] and back['home'] and back['coach'] and not back['seen'] and not back['run'], (tut, back))
        await js(pg, "document.getElementById('diary').click()"); await pg.wait_for_timeout(500)
        ok('再点日记：重新开始第 1 天教学', '第 1 步 · 煮' in await js(pg, "document.getElementById('coach-title').textContent"))
        ok('教学退出无报错', not errs, errs[:3]); await pg.close()

        # ---------- 14. 小屏 / 大屏布局 ----------
        for vw, vh, tag in [(360, 640, 'small'), (430, 932, 'big')]:
            pg, errs = await page(b, vw, vh)
            await js(pg, VETERAN)
            await js(pg, "(()=>{var o=HP.pickCards; HP.pickCards=function(){return [HP.cardById('proposal')]}; document.querySelector('[data-scene=team]').click(); HP.pickCards=o;})()")
            await pg.wait_for_timeout(300); await js(pg, PICK_FIRST_CARD); await pg.wait_for_timeout(4000)
            lay = json.loads(await js(pg, "JSON.stringify({potBottom:HP.game.potY+HP.game.potSize, seatTop:HP.game.seatTop, tray:document.getElementById('tray').getBoundingClientRect().top, tools:document.getElementById('tools').getBoundingClientRect().bottom})"))
            await pg.screenshot(path=f'/tmp/lay_{tag}.png')
            ok(f'{tag} {vw}x{vh} 锅不压托盘、座位不压工具栏', lay['potBottom'] <= lay['tray'] + 30 and lay['seatTop'] >= lay['tools'] - 2, lay)
            await js(pg, "HP.game.elapsed=60"); await pg.wait_for_timeout(1400)
            await pg.screenshot(path=f'/tmp/result_{tag}.png')
            fit = await js(pg, "document.getElementById('btn-again').getBoundingClientRect().bottom <= window.innerHeight")
            ok(f'{tag} 结算页第一屏就看得到「再来一局」', fit)
            await pg.close()
        await b.close()
    passed = sum(1 for r in R if r[1])
    print('\n总计', passed, '/', len(R), '通过')
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
