/* 演示视频导演脚本：在页面里按时间轴驱动真实游戏（逐帧推进，30fps） */
(function () {
  var FPS = 30, g, U, sounds = [], now = 0;
  var D = window.__dir = { sounds: sounds, log: [] };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 叠加层：字幕 + 手指 ---------- */
  function overlay() {
    var css = document.createElement('style');
    css.textContent =
      '#vcap{position:fixed;left:0;right:0;top:15.5%;z-index:50;text-align:center;pointer-events:none;transition:opacity .2s,transform .2s;opacity:0;transform:translateY(8px)}' +
      '#vcap.on{opacity:1;transform:none}#vcap.low{top:60%}#tip{display:none!important}' +
      '#vcap b{display:inline-block;font:900 31px/1.25 "PingFang SC","Noto Sans CJK SC",sans-serif;color:#fff;padding:6px 16px;border-radius:14px;' +
      'background:rgba(20,6,2,.62);-webkit-text-stroke:0;text-shadow:0 2px 0 #b3180c,0 0 14px rgba(255,90,40,.55);letter-spacing:1px}' +
      '#vcap b em{font-style:normal;color:#ffd35c}' +
      '#vcap small{display:block;margin-top:6px;font:700 17px/1.3 "PingFang SC","Noto Sans CJK SC",sans-serif;color:#ffe9c9;text-shadow:0 1px 4px #000}' +
      '#vfinger{position:fixed;z-index:60;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;opacity:0;' +
      'border:3px solid rgba(255,255,255,.95);background:rgba(255,255,255,.25);box-shadow:0 0 12px rgba(0,0,0,.45);transition:opacity .15s}' +
      '#vfinger.down{background:rgba(255,255,255,.62);transform:scale(.82)}' +
      '#vend{position:fixed;inset:0;left:0;top:0;right:0;bottom:0;z-index:80;display:none;background:#1a0603;text-align:center;color:#fff}' +
      '#vend img{width:100%;display:block}' +
      '#vend .t{position:absolute;left:0;right:0;bottom:5.5%;font:900 34px/1.3 "PingFang SC","Noto Sans CJK SC",sans-serif}' +
      '#vend .t span{display:inline-block;padding:10px 22px;border-radius:40px;background:#ff2442;box-shadow:0 6px 20px rgba(255,36,66,.5)}' +
      '#vend .t small{display:block;margin-top:12px;font:700 18px/1.3 sans-serif;color:#ffd9b0}';
    document.head.appendChild(css);
    var c = document.createElement('div'); c.id = 'vcap'; document.body.appendChild(c);
    var f = document.createElement('div'); f.id = 'vfinger'; document.body.appendChild(f);
    var e = document.createElement('div'); e.id = 'vend';
    e.innerHTML = '<img src="publish/cover_3x4.jpg"><div class="t"><span>小红书搜「火锅局」</span><small>小工具 · 点开就能玩</small></div>';
    document.body.appendChild(e);
  }
  var capKey = null;
  function caption(main, sub, low) {
    var c = $('vcap'), k = main + '|' + (sub || '') + low;
    if (k === capKey) return; capKey = k;
    if (!main) { c.className = ''; return; }
    c.innerHTML = '<b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '');
    c.className = 'on' + (low ? ' low' : '');
  }
  var finger = { x: 0, y: 0, show: false, down: false };
  function drawFinger() {
    var f = $('vfinger');
    f.style.left = finger.x + 'px'; f.style.top = finger.y + 'px';
    f.style.opacity = finger.show ? 1 : 0;
    f.className = finger.down ? 'down' : '';
  }

  /* ---------- 坐标工具 ---------- */
  function cellPt(c, dx, dy) { var z = g.zones[c]; return g.toScreen(z.cx + (dx || 0), z.cy + (dy || 0)); }
  function plate(id) {
    var r = $('plate-' + id).getBoundingClientRect(), cr = $('cv').getBoundingClientRect();
    return { x: r.left + r.width / 2 - cr.left, y: r.top + r.height * 0.42 - cr.top };
  }
  function elPt(id) { var r = $(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function lerpP(a, b, p) { p = ease(Math.max(0, Math.min(1, p))); return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }; }
  function foodPt(f) { return g.toScreen(f.nx, f.ny); }
  // 拖菜时食材画在手指上方 54u，所以手指要比落点低 54u
  function under(p) { return { x: p.x, y: p.y + 54 * U }; }
  function lastFood() { return g.foods[g.foods.length - 1]; }
  function npc(id) { for (var i = 0; i < g.npcs.length; i++) if (g.npcs[i].cfg.id === id) return g.npcs[i]; }

  /* ---------- 动作：拖盘子下锅 ---------- */
  function dropTo(id, t0, cell, dx, dy, opt) {
    opt = opt || {};
    var from, to, dur = opt.dur || 0.55;
    at(t0, function () { from = plate(id); to = under(cellPt(cell, dx, dy)); finger.show = true; finger.down = true; finger.x = from.x; finger.y = from.y; g.dragStart(id, from.x, from.y); });
    span(t0, t0 + dur, function (p) { var q = lerpP(from, to, p); finger.x = q.x; finger.y = q.y; g.dragMove(q.x, q.y); });
    at(t0 + dur, function () {
      g.dragEnd(); finger.down = false;
      var f = lastFood(); if (opt.d != null) f.d = opt.d;
      if (opt.name) D[opt.name] = f;
    });
  }
  /* 点一下（点锅里的菜 / 点筷子） */
  function tapAt(t0, getPt, opt) {
    opt = opt || {};
    var from, to, mv = opt.move || 0.35;
    at(t0 - mv, function () { from = { x: finger.x, y: finger.y }; finger.show = true; finger.down = false; });
    span(t0 - mv, t0, function (p) { to = getPt(); var q = lerpP(from, to, p); finger.x = q.x; finger.y = q.y; });
    at(t0, function () { to = getPt(); finger.x = to.x; finger.y = to.y; finger.down = true; (opt.act || function () { g.pointerDown(to.x, to.y); })(); });
    at(t0 + 0.12, function () { finger.down = false; });
  }

  /* ---------- 时间轴 ---------- */
  var ones = [], spans = [], caps = [];
  function at(t, fn) { ones.push({ t: t, fn: fn, done: false }); }
  function span(t0, t1, fn) { spans.push({ t0: t0, t1: t1, fn: fn }); }
  function cap(t0, t1, main, sub, low) { caps.push([t0, t1, main, sub, low]); }

  function script() {
    // 0 开场：锅在滚，先下几样要煮的
    cap(0.0, 2.7, '涮得好是<em>技术</em>，吃得好是<em>情商</em>', '一桌人的火锅模拟器');
    dropTo('luncheon', 0.5, 3, 0, 0, { name: 'lunch', d: 0.5 });
    dropTo('duckblood', 1.25, 5, 0, 0, { name: 'blood', d: 9.5 });
    dropTo('enoki', 2.0, 7, 0, 0, { name: 'enoki', d: 2.2 });

    // 1 毛肚七上八下
    cap(2.8, 8.4, '毛肚要「<em>七上八下</em>」', '按住上下涮 7~8 下，松手就捞');
    var mf, mto;
    at(2.85, function () { mf = plate('maodu'); mto = under(cellPt(4, 0, 0.02)); finger.show = true; finger.down = true; finger.x = mf.x; finger.y = mf.y; g.dragStart('maodu', mf.x, mf.y); });
    span(2.85, 3.45, function (p) { var q = lerpP(mf, mto, p); finger.x = q.x; finger.y = q.y; g.dragMove(q.x, q.y); });
    span(3.8, 7.95, function (p, t) {
      var k = (t - 3.8) / 0.585, y = mto.y - (1 - Math.cos(k * 2 * Math.PI)) / 2 * 48 * U;
      finger.x = mto.x + Math.sin(k * Math.PI) * 3 * U; finger.y = y; g.dragMove(finger.x, finger.y);
    });
    at(7.98, function () {
      var h = g.hold; D.log.push('maodu d=' + h.d.toFixed(2) + ' dips=' + h.dips);
      if (h.dips < 7) h.dips = 7; if (h.dips > 8) h.dips = 8;
      if (h.d < 5) h.d = 5.5; if (h.d > 9) h.d = 8;
      g.dragEnd(); finger.down = false;
    });

    // 2 看颜色捞菜、连击
    cap(8.5, 12.3, '煮的菜看颜色，<em>熟了就捞</em>', '连着捞到完美，分数翻倍');
    tapAt(9.0, function () { return foodPt(D.lunch); });
    tapAt(9.75, function () { return foodPt(D.blood); });
    tapAt(10.7, function () { return foodPt(D.enoki); });
    tapAt(11.25, function () { return foodPt(D.enoki); }, { move: 0.15 });

    // 3 同桌抢菜
    cap(12.4, 16.3, '同桌抢肉？<em>点他筷子！</em>', '闺蜜盯上你的虾滑了');
    dropTo('shrimp', 11.6, 3, 0.01, 0, { name: 'shrimp', d: 3.2 });
    at(12.6, function () { g.sendNpc(npc('friend'), D.shrimp, 2.4); });
    tapAt(14.2, function () { var n = npc('friend'); return n.tip ? { x: n.tip.x + n.dir.x * 30 * U, y: n.tip.y + n.dir.y * 30 * U } : finger; }, { move: 0.45 });
    tapAt(15.6, function () { return foodPt(D.shrimp); });

    // 4 敬酒
    cap(16.4, 19.3, '敬酒来了，<em>3 秒内干杯</em>', '不接？领导脸色就不好看了');
    at(16.5, function () { g.startEvent('toast'); });
    tapAt(17.9, function () { return elPt('btn-toast'); }, { move: 0.5, act: function () { g.toast(); } });

    // 5 开大火，手忙脚乱
    cap(19.4, 23.3, '开大火了，<em>越吃越乱</em>', '抢的抢、涮的涮');
    at(19.45, function () { g.startEvent('fire'); });
    dropTo('luncheon', 19.6, 3, 0, 0, { name: 'l2', d: 2.8, dur: 0.45 });
    dropTo('luncheon', 20.15, 5, 0, -0.01, { name: 'l3', d: 2.6, dur: 0.45 });
    at(20.7, function () { g.sendNpc(npc('boss'), D.l3, 0.7); });
    tapAt(21.55, function () { return foodPt(D.l2); });
    var lf, lto;
    at(21.85, function () { lf = plate('lettuce'); lto = under(cellPt(4)); finger.down = true; finger.x = lf.x; finger.y = lf.y; g.dragStart('lettuce', lf.x, lf.y); });
    span(21.85, 22.3, function (p) { var q = lerpP(lf, lto, p); finger.x = q.x; finger.y = q.y; g.dragMove(q.x, q.y); });
    span(22.3, 22.95, function (p) { finger.x = lto.x + Math.sin(p * 9) * 6 * U; g.dragMove(finger.x, finger.y); });
    at(22.95, function () { var h = g.hold; D.log.push('lettuce d=' + h.d.toFixed(2)); if (h.d < 1.2) h.d = 1.6; if (h.d > 2.4) h.d = 2; g.dragEnd(); finger.down = false; });

    // 6 见手青
    cap(23.4, 27.0, '见手青没煮熟……', '<em>看见小人了</em>');
    dropTo('jianshouqing', 23.35, 4, 0, 0, { name: 'jsq', d: 1, dur: 0.45 });
    tapAt(24.35, function () { return foodPt(D.jsq); });
    at(24.6, function () { finger.show = false; });

    // 7 结算
    at(27.0, function () { caption(null); g.elapsed = HP.ROUND_TIME + 1; });
    cap(27.35, 30.6, '吃完测你的<em>火锅人格</em>', '生成结算卡，一键存图发笔记', true);
  }

  D.start = function () {
    g = HP.game; U = g.unit; overlay(); script();
    // 记录音效：时间用视频时间
    var a = g.audio;
    ['pop', 'splash', 'dip', 'crunch', 'clack', 'clink', 'pour', 'whoosh'].forEach(function (n) {
      a[n] = function () { sounds.push({ n: n, t: now, a: Array.prototype.slice.call(arguments) }); };
    });
    a.unlock = function () {};
  };
  D.frame = function (i) {
    now = i / FPS;
    g.nextNpc = 999; g.nextEvent = 999; g.fx.quality = 1;
    if (g.running && g.timeLeft < 30) g.elapsed = HP.ROUND_TIME - 60; // 视频里倒计时别走到底
    ones.forEach(function (o) { if (!o.done && now >= o.t) { o.done = true; o.fn(); } });
    spans.forEach(function (s) { if (now >= s.t0 && now <= s.t1 + 1e-6) s.fn((now - s.t0) / (s.t1 - s.t0), now); });
    var c = null; caps.forEach(function (k) { if (now >= k[0] && now < k[1]) c = k; });
    if (c) caption(c[2], c[3], c[4]); else if (now < 27 || now > 30.6) caption(null);
    drawFinger();
    window.__step();
  };
  D.end = function () { $('vend').style.display = 'block'; caption(null); finger.show = false; drawFinger(); };
})();
