/* 音效：小工具不允许打包音频文件，全部用 Web Audio 实时合成。 */
var HP = window.HP = window.HP || {};

(function () {
  function Audio() {
    this.ctx = null; this.on = true; this.lastPop = 0; this.master = null;
  }
  HP.Audio = Audio;

  /* 必须在用户第一次点击时调用（浏览器限制） */
  Audio.prototype.unlock = function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.startSimmer();
  };

  Audio.prototype.noiseBuffer = function (sec, brown) {
    var c = this.ctx, n = Math.floor(c.sampleRate * sec), buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  };

  /* 背景的「咕嘟咕嘟」低频翻滚声 */
  Audio.prototype.startSimmer = function () {
    var c = this.ctx;
    var src = c.createBufferSource(); src.buffer = this.noiseBuffer(4, true); src.loop = true;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    var g = c.createGain(); g.gain.value = 0.22;
    var lfo = c.createOscillator(); lfo.frequency.value = 2.3;
    var lfoGain = c.createGain(); lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  };

  /* 气泡破裂的「啵」 */
  Audio.prototype.pop = function (size) {
    if (!this.ctx || !this.on) return;
    var now = this.ctx.currentTime;
    if (now - this.lastPop < 0.07 || Math.random() > 0.35) return;
    this.lastPop = now;
    var c = this.ctx, o = c.createOscillator(), g = c.createGain();
    var f = 900 - size * 45 + Math.random() * 200;
    o.type = 'sine'; o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, now + 0.06);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05 + size * 0.006, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    o.connect(g); g.connect(this.master); o.start(now); o.stop(now + 0.1);
  };

  Audio.prototype.burst = function (dur, type, freq, q, vol) {
    if (!this.ctx || !this.on) return;
    var c = this.ctx, now = c.currentTime;
    var src = c.createBufferSource(); src.buffer = this.noiseBuffer(dur, false);
    var f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(now);
  };

  Audio.prototype.splash = function () { this.burst(0.28, 'lowpass', 900, 0.7, 0.5); };
  /* 捞起：完美时是清脆的「嘎吱」 */
  Audio.prototype.crunch = function (perfect) {
    if (perfect) { this.burst(0.09, 'bandpass', 3200, 1.4, 0.6); var self = this; setTimeout(function () { self.burst(0.07, 'bandpass', 2600, 1.4, 0.45); }, 70); }
    else this.burst(0.12, 'bandpass', 1200, 1, 0.35);
  };
  Audio.prototype.dip = function () { this.burst(0.12, 'lowpass', 1400, 0.8, 0.28); };
  Audio.prototype.pour = function () { this.burst(1.2, 'bandpass', 700, 0.6, 0.35); };
  Audio.prototype.whoosh = function () { this.burst(0.7, 'lowpass', 400, 0.5, 0.6); };
  /* 碰杯：两个高频正弦叠加 */
  Audio.prototype.clink = function () {
    if (!this.ctx || !this.on) return;
    var c = this.ctx, now = c.currentTime, self = this;
    [2650, 3970].forEach(function (f) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      o.connect(g); g.connect(self.master); o.start(now); o.stop(now + 0.65);
    });
  };
  Audio.prototype.clack = function () { this.burst(0.05, 'highpass', 2500, 1, 0.5); };
  Audio.prototype.toggle = function () {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.9 : 0;
    return this.on;
  };
})();
