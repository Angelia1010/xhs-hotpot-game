import asyncio, json, statistics as st, collections
from playwright.async_api import async_playwright
SIM = open('tools/tests/sim.js').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':390,'height':844})
        perr=[]; pg.on('pageerror', lambda e: perr.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(2500)
        rounds=[]
        SC=['bros','team','date','family','solo']
        for skill in ['good','avg','bad']:
            for scene in SC:
                for pot in ['jiugong','yuanyang']:
                    for k in range(4): rounds.append({'skill':skill,'scene':scene,'pot':pot, 'style': ['', '', 'carer', 'glutton'][k]})
        res = {'out':[], 'errors':[]}
        for i in range(0, len(rounds), 10):
            r = await pg.evaluate(SIM + '(' + json.dumps({'rounds': rounds[i:i+10]}) + ')')
            res['out'] += r['out']; res['errors'] += r['errors']
        json.dump(res, open('/tmp/simres.json','w'), ensure_ascii=False)
        print('rounds', len(res['out']), 'errors', len(res['errors']), res['errors'][:5], 'pageerrors', perr[:3])
        O=res['out']
        print('not ended', sum(1 for o in O if not o['ended']), 'nan', sum(o['nan'] for o in O), 'maxFx', max(o['maxFx'] for o in O), 'maxFoods', max(o['maxFoods'] for o in O))
        for skill in ['good','avg','bad']:
            for scene in SC:
                for pot in ['jiugong']:
                    xs=[o for o in O if o['skill']==skill and o['scene']==scene]
                    sc=[o['score'] for o in xs]
                    print(f"{skill:4} {scene:4} {pot:8} score med {st.median(sc):6.0f} [{min(sc)}-{max(sc)}]  eaten {st.mean([o['eaten'] for o in xs]):4.1f} perfect {st.mean([o['perfect'] for o in xs]):4.1f} served {st.mean([o['served'] for o in xs]):4.1f} orders {st.mean([o['ordersDone'] for o in xs]):3.1f}/{st.mean([o['orders'] for o in xs]):3.1f} miss {st.mean([o['orderMiss'] for o in xs]):3.1f} stolen {st.mean([o['stolen'] for o in xs]):3.1f}")
        pc=collections.Counter(o['persona'] for o in O); print('personas', pc.most_common())
        await b.close()
asyncio.run(main())
