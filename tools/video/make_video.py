"""录制「火锅局」演示视频（1080x1920 30fps）
用法：项目根目录起 python3 -m http.server 8765，然后
  python3 tools/video/make_video.py            # 全片
  python3 tools/video/make_video.py --stills 4,9,14,18,21,25,29   # 只截关键帧检查
"""
import asyncio, json, os, subprocess, sys, base64
from playwright.async_api import async_playwright

OUT = 'publish/video'
FPS, PLAY_END, END_HOLD = 30, 30.6, 2.6
INIT = r"""
(function(){
  var cbs=[], T=1000;
  window.requestAnimationFrame=function(cb){cbs.push(cb);return cbs.length;};
  window.__step=function(){ T+=1000/30; var c=cbs; cbs=[]; for(var i=0;i<c.length;i++) c[i](T); };
  var s=20261123; Math.random=function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  try{ localStorage.clear(); }catch(e){}
})();
"""
X264 = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS)]

AUDIO_JS = r"""
(async function(S, LEN){
  var SR = 44100, off = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR);
  var a = new HP.Audio(); a.init(off);
  S.forEach(function(e){ if (e.t < LEN - 0.3) { a.t0 = e.t + 0.005; a[e.n].apply(a, e.a); } });
  var buf = await off.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  // 首尾淡入淡出
  for (var i = 0; i < n; i++) { var k = Math.min(1, i / (SR * 0.3), (n - i) / (SR * 0.8)); L[i] *= k; R[i] *= k; }
  var ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
  function s(o, str){ for (var i=0;i<str.length;i++) v.setUint8(o+i, str.charCodeAt(i)); }
  s(0,'RIFF'); v.setUint32(4,36+n*4,true); s(8,'WAVE'); s(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,2,true);
  v.setUint32(24,SR,true); v.setUint32(28,SR*4,true); v.setUint16(32,4,true); v.setUint16(34,16,true); s(36,'data'); v.setUint32(40,n*4,true);
  var peak = 0;
  for (var i=0;i<n;i++){ var x = Math.max(-1, Math.min(1, L[i])), y = Math.max(-1, Math.min(1, R[i])); peak = Math.max(peak, Math.abs(x));
    v.setInt16(44+i*4, x<0?x*0x8000:x*0x7FFF, true); v.setInt16(46+i*4, y<0?y*0x8000:y*0x7FFF, true); }
  var b = new Uint8Array(ab), bin = ''; for (var i=0;i<b.length;i+=8192) bin += String.fromCharCode.apply(null, b.subarray(i, i+8192));
  return { b64: btoa(bin), peak: peak };
})
"""

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0: print(r.stderr[-2000:]); raise SystemExit('ffmpeg failed')

async def main():
    stills = None
    if '--stills' in sys.argv: stills = [float(x) for x in sys.argv[sys.argv.index('--stills') + 1].split(',')]
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 540, 'height': 960}, device_scale_factor=2, has_touch=True)
        pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.HP && HP.game && HP.profile')
        await pg.add_script_tag(path='tools/video/director.js')
        # 资料：教学已完成、解锁视频要用的菜
        await pg.evaluate("""() => {
          var p = HP.profile(); p.tutorialDone = true; p.games = 3;
          // 1.3：火锅日记停在第 5 天（机制全开、还没有饭局卡三选一），录一局标准的朋友局
          p.day = 5; for (var i = 1; i <= 5; i++) { p.seen['lesson_' + i] = 1; p.seen['dayintro_' + i] = 1; }
          var ids = ['maodu','beef','luncheon','duckblood','enoki','shrimp','lettuce','jianshouqing'];
          ids.forEach(function(id){ if (p.unlocked.indexOf(id) < 0) p.unlocked.push(id); });
          p.loadout = ['maodu','luncheon','duckblood','enoki','shrimp','lettuce','jianshouqing','beef'];
          p.seen.scene_bros = 1;
          document.querySelector('[data-scene=bros]').click();
        }""")
        for _ in range(3): await pg.evaluate('window.__step()')
        await pg.evaluate('__dir.start()')
        if '--nocap' in sys.argv: await pg.add_style_tag(content='#vcap,#vfinger{display:none!important}')
        total = int(PLAY_END * FPS)
        ff = None
        if not stills:
            tmp = f'{OUT}/s1_play.tmp.mp4'
            ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-'] + X264 + [tmp], stdin=subprocess.PIPE)
        want = set(int(round(s * FPS)) for s in (stills or []))
        for i in range(total):
            await pg.evaluate(f'__dir.frame({i})')
            if stills:
                if i in want: await pg.screenshot(path=f'/tmp/vf_{i/FPS:05.2f}.jpg', type='jpeg', quality=94)
                if i > max(want): break
            else:
                ff.stdin.write(await pg.screenshot(type='jpeg', quality=92))
                if i % 150 == 0: print('frame', i, '/', total, flush=True)
        log = await pg.evaluate('__dir.log')
        print('log', log, 'errors', errs[:5])
        if stills:
            await b.close(); return
        ff.stdin.close()
        if ff.wait() != 0: raise SystemExit('ffmpeg play failed')
        os.replace(tmp, f'{OUT}/s1_play.mp4')
        # 结尾卡：静帧
        await pg.evaluate('__dir.end()'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/end.png')
        tmp = f'{OUT}/s2_end.tmp.mp4'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{OUT}/end.png', '-vf', f'format=yuv420p,loop=-1:1,trim=duration={END_HOLD},fade=in:st=0:d=0.25'] + X264 + [tmp])
        os.replace(tmp, f'{OUT}/s2_end.mp4')
        # 音效
        sounds = await pg.evaluate('__dir.sounds')
        print('sounds', len(sounds), {n: sum(1 for s in sounds if s['n'] == n) for n in set(s['n'] for s in sounds)})
        r = await pg.evaluate(AUDIO_JS + f'({json.dumps(sounds)}, {PLAY_END + END_HOLD})')
        open(f'{OUT}/sfx.wav', 'wb').write(base64.b64decode(r['b64']))
        print('audio peak', round(r['peak'], 3))
        await b.close()
    open(f'{OUT}/list.txt', 'w').write("file 's1_play.mp4'\nfile 's2_end.mp4'\n")
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/list.txt', '-c', 'copy', f'{OUT}/video_noaudio.mp4'])
    tmp = 'publish/huoguoju_demo.tmp.mp4'
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/video_noaudio.mp4', '-i', f'{OUT}/sfx.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', tmp])
    os.replace(tmp, 'publish/huoguoju_demo.mp4')
    print('done', errs[:5])

asyncio.run(main())
