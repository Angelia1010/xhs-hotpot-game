"""离线渲染一段 16 秒的音效试听（publish/sound_preview.wav）并画频谱图检查。
用法：先在项目根目录起 http.server 8765，再运行 python3 tools/tests/sound_preview.py"""
import asyncio, base64, wave, sys
import numpy as np
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
JS = r"""
(async function(){
  var SR = 44100, LEN = 16, off = new OfflineAudioContext(1, SR * LEN, SR);
  var a = new HP.Audio(); a.init(off);
  function at(t, fn){ a.t0 = t; fn(); }
  for (var t = 0.05; t < 4; t += 1/30) if (Math.random() < 0.6) at(t + Math.random()/30, function(){ a.pop(2 + Math.random()*9); });
  at(4.4, function(){ a.splash(); });
  at(5.3, function(){ a.dip(); }); at(5.75, function(){ a.dip(); }); at(6.2, function(){ a.dip(); });
  at(7.0, function(){ a.crunch(true); }); at(8.0, function(){ a.crunch(false); });
  at(8.9, function(){ a.clack(); }); at(9.7, function(){ a.clink(); });
  at(10.9, function(){ a.pour(); }); at(12.7, function(){ a.whoosh(); }); at(14.2, function(){ a.crunch(true); });
  var d = (await off.startRendering()).getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n*2), v = new DataView(ab);
  function s(o, str){ for (var i=0;i<str.length;i++) v.setUint8(o+i, str.charCodeAt(i)); }
  s(0,'RIFF'); v.setUint32(4,36+n*2,true); s(8,'WAVE'); s(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,SR,true); v.setUint32(28,SR*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); s(36,'data'); v.setUint32(40,n*2,true);
  var peak = 0;
  for (var i=0;i<n;i++){ var x = Math.max(-1, Math.min(1, d[i])); peak = Math.max(peak, Math.abs(x)); v.setInt16(44+i*2, x<0 ? x*0x8000 : x*0x7FFF, true); }
  var b = new Uint8Array(ab), bin = ''; for (var i=0;i<b.length;i+=8192) bin += String.fromCharCode.apply(null, b.subarray(i, i+8192));
  return { b64: btoa(bin), peak: peak };
})()
"""
LABELS = [(0.2,'bubbles'),(4.4,'splash'),(5.3,'dip x3'),(7.0,'perfect'),(8.0,'normal'),(8.9,'clack'),(9.7,'clink'),(10.9,'pour'),(12.7,'whoosh'),(14.2,'perfect')]
async def main(out_wav, out_png):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(); await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(1500)
        r = await pg.evaluate(JS); await b.close()
    open(out_wav, 'wb').write(base64.b64decode(r['b64']))
    w = wave.open(out_wav); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0
    N, H = 1024, 256
    S = np.abs(np.fft.rfft([x[i:i+N]*np.hanning(N) for i in range(0, len(x)-N, H)], axis=1))[:, :int(8000/(sr/N))]
    S = np.clip((20*np.log10(S+1e-6)+60)/60, 0, 1)
    im = Image.fromarray((np.flipud(S.T)*255).astype(np.uint8)).resize((1600, 360)).convert('RGB'); d = ImageDraw.Draw(im)
    for t, l in LABELS:
        X = int(t/16*1600); d.line([(X,0),(X,360)], fill=(255,80,80)); d.text((X+3,3), l, fill=(255,255,0))
    im.save(out_png)
    print('peak', round(r['peak'], 3), 'RMS', [(l, round(float(np.sqrt(np.mean(x[int(t*sr):int((t+0.5)*sr)]**2))), 3)) for t, l in LABELS])
asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'publish/sound_preview.wav', sys.argv[2] if len(sys.argv) > 2 else '/tmp/spec.png'))
