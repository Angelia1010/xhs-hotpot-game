/* 音效：小工具不允许打包音频文件，全部用 Web Audio 实时合成。
   思路：模拟真实声音的物理特征，而不是用电子音代替。
   - 气泡：液体里的气泡破裂时音调会快速上扬（「啵噜」），一颗颗随机出现
   - 脆响：几下极短的高频瞬态叠在一起
   - 木筷：两个很快衰减的木质共振
   - 玻璃杯：几个不成倍数的泛音，余音长 */
var HP = window.HP = window.HP || {};

(function () {
  function rand(a, b) { return a + Math.random() * (b - a); }

  function Audio() {
    this.ctx = null; this.on = true; this.lastPop = 0; this.master = null; this.t0 = null;
  }
  HP.Audio = Audio;

  /* 必须在用户第一次点击时调用（浏览器限制） */
  Audio.prototype.unlock = function () {
    if (this.ctx) {
      // iOS 切到后台后会挂起音频，回来时需要在用户操作里恢复
      if (this.ctx.state === 'suspended' && this.ctx.resume) { try { this.ctx.resume(); } catch (e) {} }
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.init(new AC()); } catch (e) { this.ctx = null; }
  };

  /* 接上输出链：总音量 → 压缩器（防止叠加时爆音）→ 扬声器 */
  Audio.prototype.init = function (ctx) {
    this.ctx = ctx;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.85 : 0;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.white = this.makeNoise(2, false);
    this.brown = this.makeNoise(4, true);
    this.startSimmer();
  };

  Audio.prototype.now = function () { return this.t0 != null ? this.t0 : this.ctx.currentTime; };
  Audio.prototype.ok = function () { return this.ctx && this.on; };

  Audio.prototype.makeNoise = function (sec, brown) {
    var c = this.ctx, n = Math.floor(c.sampleRate * sec), buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  };

  /* 一段滤波后的噪音，freq 可以是 [起, 止] 做扫频 */
  Audio.prototype.noise = function (t, dur, type, freq, q, vol, attack) {
    var c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.white;
    f.type = type; f.Q.value = q;
    if (freq.length) { f.frequency.setValueAtTime(freq[0], t); f.frequency.exponentialRampToValueAtTime(freq[1], t + dur); }
    else f.frequency.value = freq;
    var a = attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  };

  /* 一个正弦音：频率从 f0 滑到 f1，按指数衰减 */
  Audio.prototype.tone = function (t, f0, f1, dur, vol, type) {
    var c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  };

  /* 一颗气泡的「啵噜」：音调快速上扬，红油汤比较稠，声音偏低偏闷 */
  Audio.prototype.blop = function (t, size, vol) {
    var c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    var f0 = 520 - Math.min(10, size) * 30 + rand(-60, 60), dur = rand(0.05, 0.09) + size * 0.004;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * rand(1.7, 2.3), t + dur);
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  /* 背景：很轻的低沉翻滚声，真正的「咕嘟」来自一颗颗气泡 */
  Audio.prototype.startSimmer = function () {
    var c = this.ctx, src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.brown; src.loop = true;
    lp.type = 'lowpass'; lp.frequency.value = 260;
    g.gain.value = 0.06;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(this.now());
  };

  /* 汤面上的气泡破裂（特效每破一颗泡就调一次，这里抽一部分出声） */
  Audio.prototype.pop = function (size) {
    if (!this.ok()) return;
    var t = this.now();
    if (t - this.lastPop < 0.045 || Math.random() > 0.45) return;
    this.lastPop = t;
    this.blop(t, size, 0.05 + Math.min(10, size) * 0.006);
    if (size > 6 && Math.random() < 0.5) this.blop(t + rand(0.03, 0.07), size * 0.6, 0.035);
  };

  /* 菜下锅：水声 + 一串气泡 */
  Audio.prototype.splash = function () {
    if (!this.ok()) return;
    var t = this.now();
    this.noise(t, 0.3, 'lowpass', [2600, 380], 0.8, 0.3, 0.004);
    for (var i = 0; i < 4; i++) this.blop(t + rand(0.02, 0.2), rand(3, 8), rand(0.04, 0.07));
  };

  /* 涮的时候放下去一次 */
  Audio.prototype.dip = function () {
    if (!this.ok()) return;
    var t = this.now();
    this.noise(t, 0.14, 'lowpass', [1600, 500], 0.7, 0.14, 0.004);
    this.blop(t + 0.03, 4, 0.04);
  };

  /* 捞起：完美时是脆生生的「嘎吱」，其他是软一点的一声 */
  Audio.prototype.crunch = function (perfect) {
    if (!this.ok()) return;
    var t = this.now(), i;
    if (perfect) {
      var n = 4 + Math.floor(Math.random() * 2), tt = t;
      for (i = 0; i < n; i++) {
        this.noise(tt, rand(0.008, 0.016), 'bandpass', rand(2200, 4200), 1.6, rand(0.25, 0.4), 0.0008);
        tt += rand(0.014, 0.03);
      }
      this.tone(t, 150, 110, 0.05, 0.08);
      // 一点点上扬的高音，像「叮」一声的满足感
      this.tone(t + 0.06, 1320, 1320, 0.25, 0.035);
      this.tone(t + 0.06, 1980, 1980, 0.2, 0.02);
    } else {
      this.noise(t, 0.1, 'lowpass', [900, 400], 0.7, 0.16, 0.003);
      this.blop(t, 5, 0.035);
    }
  };

  /* 筷子相碰：短促的木头「嗒」 */
  Audio.prototype.clack = function () {
    if (!this.ok()) return;
    var t = this.now();
    this.noise(t, 0.012, 'highpass', 3000, 0.7, 0.18, 0.0005);
    this.tone(t, 1850, 1800, 0.035, 0.12, 'triangle');
    this.tone(t, 3050, 3000, 0.022, 0.06, 'triangle');
    this.tone(t + 0.045, 1950, 1900, 0.03, 0.07, 'triangle');
  };

  /* 碰杯：玻璃杯的几个泛音，余音长 */
  Audio.prototype.clink = function () {
    if (!this.ok()) return;
    var t = this.now(), k = rand(0.98, 1.02), self = this;
    this.noise(t, 0.01, 'highpass', 4000, 0.7, 0.12, 0.0005);
    [[2240, 0.9, 0.09], [3450, 0.7, 0.06], [5180, 0.5, 0.035], [7320, 0.35, 0.02]].forEach(function (p) {
      self.tone(t, p[0] * k, p[0] * k, p[1], p[2]);
      self.tone(t, p[0] * k * 1.004, p[0] * k * 1.004, p[1] * 0.9, p[2] * 0.5);   // 轻微拍频，更像真的玻璃
    });
  };

  /* 服务员加汤：一段倒水声，带咕噜 */
  Audio.prototype.pour = function () {
    if (!this.ok()) return;
    var c = this.ctx, t = this.now(), dur = 1.3;
    // 倒水：低沉的水流 + 带一点起伏，避免变成「沙沙」的白噪音
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
    var lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = this.brown; bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.6;
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    lfo.frequency.value = 7; lg.gain.value = 160; lfo.connect(lg); lg.connect(bp.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.15);
    g.gain.setValueAtTime(0.45, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, 0, dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
    for (var i = 0; i < 6; i++) this.blop(t + rand(0.1, dur), rand(2, 7), rand(0.03, 0.06));
  };

  /* 火开大：呼的一声 */
  Audio.prototype.whoosh = function () {
    if (!this.ok()) return;
    var c = this.ctx, t = this.now();
    var src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.brown; lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1500, t + 0.25);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 2, 1);
    for (var i = 0; i < 5; i++) this.blop(t + rand(0.2, 0.8), rand(5, 10), rand(0.04, 0.07));
  };

  Audio.prototype.toggle = function () {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.85 : 0;
    return this.on;
  };
})();
