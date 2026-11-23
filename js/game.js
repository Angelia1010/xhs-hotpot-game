/* 核心：布局、九宫格、食材熟度、触控、NPC 抢菜、绘制顺序。 */
var HP = window.HP = window.HP || {};

(function () {
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    var x = ax + dx * t - px, y = ay + dy * t - py; return Math.sqrt(x * x + y * y);
  }

  function Game(canvas, images, hooks) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.img = images; this.hooks = hooks || {};
    this.scratch = document.createElement('canvas'); this.sctx = this.scratch.getContext('2d');
    this.foods = []; this.npcs = []; this.drag = null; this.lift = [];
    this.hints = true; this.running = false; this.time = 0;
    this.audio = null;
    this.buildCells();
    this.fx = new HP.FX(this);
    this.reset();
  }
  HP.Game = Game;

  /* ---------- 九宫格几何 ---------- */
  Game.prototype.buildCells = function () {
    var P = HP.POT;
    var xs = [[P.cx - P.rx, P.vx[0] - P.half], [P.vx[0] + P.half, P.vx[1] - P.half], [P.vx[1] + P.half, P.cx + P.rx]];
    var ys = [[P.cy - P.ry, P.hy[0] - P.half], [P.hy[0] + P.half, P.hy[1] - P.half], [P.hy[1] + P.half, P.cy + P.ry]];
    this.cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++)
      this.cells.push({ x0: xs[c][0], x1: xs[c][1], y0: ys[r][0], y1: ys[r][1] });
  };
  Game.prototype.inEllipse = function (nx, ny, shrink) {
    var P = HP.POT, s = shrink || 0;
    var dx = (nx - P.cx) / (P.rx - s), dy = (ny - P.cy) / (P.ry - s);
    return dx * dx + dy * dy <= 1;
  };
  Game.prototype.cellAt = function (nx, ny) {
    if (!this.inEllipse(nx, ny, 0)) return -1;
    for (var i = 0; i < 9; i++) {
      var c = this.cells[i];
      if (nx >= c.x0 && nx <= c.x1 && ny >= c.y0 && ny <= c.y1) return i;
    }
    return -1;
  };
  /* 在某个格子（或任意格子 cell=-1）的汤面里随机取一点 */
  Game.prototype.randomSoupPoint = function (cell, margin) {
    var m = margin || 0.008;
    for (var k = 0; k < 40; k++) {
      var c = this.cells[cell >= 0 ? cell : Math.floor(Math.random() * 9)];
      var nx = rand(c.x0 + m, c.x1 - m), ny = rand(c.y0 + m, c.y1 - m);
      if (this.inEllipse(nx, ny, m)) return { nx: nx, ny: ny };
    }
    return { nx: HP.POT.cx, ny: HP.POT.cy };
  };
  Game.prototype.clipSoup = function (ctx) {
    var P = HP.POT, o = this.toScreen(P.cx, P.cy);
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, P.rx * this.potSize, P.ry * this.potSize, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    for (var i = 0; i < 9; i++) {
      var c = this.cells[i], a = this.toScreen(c.x0, c.y0);
      ctx.rect(a.x, a.y, (c.x1 - c.x0) * this.potSize, (c.y1 - c.y0) * this.potSize);
    }
    ctx.clip();
  };

  /* ---------- 布局 ---------- */
  Game.prototype.layout = function (w, h, top, bottom) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    var avail = bottom - top;
    this.potSize = Math.min(w * 1.04, avail);
    this.potX = w / 2 - this.potSize / 2;
    this.potY = top + (avail - this.potSize) / 2;
    this.unit = this.potSize / 360;
    this.bowl = { x: w / 2, y: bottom + 30 };
  };
  Game.prototype.toScreen = function (nx, ny) { return { x: this.potX + nx * this.potSize, y: this.potY + ny * this.potSize }; };
  Game.prototype.toNorm = function (x, y) { return { nx: (x - this.potX) / this.potSize, ny: (y - this.potY) / this.potSize }; };

  /* ---------- 一局的状态 ---------- */
  Game.prototype.reset = function () {
    this.foods = []; this.lift = []; this.npcs = [];
    for (var i = 0; i < HP.NPCS.length; i++) this.npcs.push({ cfg: HP.NPCS[i], phase: 'idle', t: 0 });
    this.timeLeft = HP.ROUND_TIME; this.elapsed = 0;
    this.nextNpc = HP.NPC_FIRST_DELAY;
    this.stats = { score: 0, combo: 0, bestCombo: 0, perfect: 0, raw: 0, over: 0, eaten: 0, stolen: 0, blocked: 0, spent: 0 };
  };

  Game.prototype.rate = function (f) {
    var F = HP.FOODS[f.type], d = f.d;
    if (d < F.a * 0.8) return { kind: 'raw', label: '太生了！', score: -50, color: '#8fd3ff' };
    if (d < F.a) return { kind: 'ok', label: '差一点', score: 40, color: '#ffe08a' };
    if (d <= F.b) return { kind: 'perfect', label: '完美！', score: 100, color: '#7dff9a' };
    if (d <= F.b + 3) return { kind: 'ok', label: '有点老', score: 40, color: '#ffc27a' };
    return { kind: 'over', label: '煮老了…', score: 10, color: '#ff8a6a' };
  };

  Game.prototype.addFood = function (type, nx, ny) {
    var cell = this.cellAt(nx, ny);
    if (cell < 0) return false;
    var F = HP.FOODS[type];
    this.foods.push({
      type: type, cell: cell, nx: nx, ny: ny, d: 0, t: 0, ph: rand(0, 6.28),
      rot: rand(-0.5, 0.5), depth: F.sinker ? 0.85 : F.depth, state: 'in', drop: 0.28, id: Math.random()
    });
    this.stats.spent += F.price;
    this.fx.splash(nx, ny, 1);
    if (this.audio) this.audio.splash();
    return true;
  };

  /* ---------- 玩家操作 ---------- */
  Game.prototype.pointerDown = function (x, y) {
    if (!this.running) return;
    // 1. 先看是不是在挡 NPC 的筷子
    for (var i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i];
      if ((n.phase === 'warn' || n.phase === 'reach') && n.tip) {
        var tail = { x: n.tip.x + n.dir.x * this.potSize * 0.5, y: n.tip.y + n.dir.y * this.potSize * 0.5 };
        if (segDist(x, y, n.tip.x, n.tip.y, tail.x, tail.y) < 34 * this.unit) { this.blockNpc(n); return; }
      }
    }
    // 2. 再看点到了哪块菜（取最近的）
    var best = null, bd = 1e9;
    for (i = 0; i < this.foods.length; i++) {
      var f = this.foods[i]; if (f.state !== 'in') continue;
      var p = this.toScreen(f.nx, f.ny), dx = p.x - x, dy = p.y - y, dd = Math.sqrt(dx * dx + dy * dy);
      var r = HP.FOODS[f.type].size * this.potSize * 0.6 + 12;
      if (dd < r && dd < bd) { best = f; bd = dd; }
    }
    if (best) this.pick(best);
  };

  Game.prototype.pick = function (f) {
    var r = this.rate(f), s = this.stats;
    f.state = 'lift';
    var p = this.toScreen(f.nx, f.ny);
    this.lift.push({ f: f, t: 0, x0: p.x, y0: p.y });
    var gain = r.score;
    if (r.kind === 'perfect') { s.combo++; s.perfect++; gain = Math.round(gain * Math.min(3, 1 + (s.combo - 1) * 0.5)); }
    else s.combo = 0;
    if (r.kind === 'raw') s.raw++;
    if (r.kind === 'over') s.over++;
    s.bestCombo = Math.max(s.bestCombo, s.combo); s.eaten++;
    s.score = Math.max(0, s.score + gain);
    var label = r.label + (gain >= 0 ? ' +' + gain : ' ' + gain);
    this.fx.text(p.x, p.y - 26 * this.unit, label, r.color, 20 * Math.max(0.8, this.unit));
    if (s.combo >= 2 && r.kind === 'perfect') this.fx.text(p.x, p.y - 52 * this.unit, s.combo + ' 连击 ×' + Math.min(3, 1 + (s.combo - 1) * 0.5).toFixed(1), '#ffd35c', 16 * Math.max(0.8, this.unit));
    if (this.audio) this.audio.crunch(r.kind === 'perfect');
    if (this.hooks.onScore) this.hooks.onScore(s, r);
    if (this.hooks.haptic) this.hooks.haptic(r.kind);
    for (var i = 0; i < this.npcs.length; i++) if (this.npcs[i].target === f && this.npcs[i].phase !== 'retreat') this.cancelNpc(this.npcs[i], '手慢了~');
  };

  Game.prototype.dragStart = function (type, x, y) { if (this.running) this.drag = { type: type, x: x, y: y }; };
  Game.prototype.dragMove = function (x, y) { if (this.drag) { this.drag.x = x; this.drag.y = y; } };
  Game.prototype.dragEnd = function () {
    if (!this.drag) return;
    var d = this.drag, pt = this.dragPoint(d), n = this.toNorm(pt.x, pt.y);
    if (!this.addFood(d.type, n.nx, n.ny) && this.hooks.onMiss) this.hooks.onMiss();
    this.drag = null;
  };
  /* 拖动时食材显示在手指上方，避免被手指挡住 */
  Game.prototype.dragPoint = function (d) { return { x: d.x, y: d.y - 54 * this.unit }; };

  /* ---------- NPC 抢菜 ---------- */
  var DIRS = { top: { x: 0, y: -1, rot: 0 }, left: { x: -1, y: 0, rot: -Math.PI / 2 }, right: { x: 1, y: 0, rot: Math.PI / 2 } };

  Game.prototype.scheduleNpc = function () {
    var idle = this.npcs.filter(function (n) { return n.phase === 'idle'; });
    var cands = this.foods.filter(function (f) {
      var F = HP.FOODS[f.type];
      return f.state === 'in' && !f.targeted && f.d > F.a * 0.55 && f.d < F.b + 1;
    });
    if (!idle.length || !cands.length) { this.nextNpc = 1.5; return; }
    // 优先抢最接近完美的那块
    cands.sort(function (a, b) {
      var A = HP.FOODS[a.type], B = HP.FOODS[b.type];
      return Math.abs(a.d - (A.a + A.b) / 2) - Math.abs(b.d - (B.a + B.b) / 2);
    });
    var n = idle[Math.floor(Math.random() * idle.length)], f = cands[0], D = DIRS[n.cfg.side];
    f.targeted = true;
    n.target = f; n.phase = 'warn'; n.t = 0; n.dir = D; n.rot = D.rot;
    n.reach = this.potSize * 0.95;
    this.nextNpc = rand(HP.NPC_INTERVAL[0], HP.NPC_INTERVAL[1]);
    var p = this.toScreen(f.nx, f.ny);
    this.fx.text(p.x, p.y - 34 * this.unit, n.cfg.name + '盯上了！', '#ffcf6b', 15 * Math.max(0.8, this.unit));
  };
  Game.prototype.blockNpc = function (n) {
    this.stats.blocked++;
    var p = n.tip;
    this.fx.text(p.x, p.y, '挡住了！', '#ffffff', 20 * Math.max(0.8, this.unit));
    if (this.audio) this.audio.clack();
    if (this.hooks.haptic) this.hooks.haptic('block');
    this.cancelNpc(n, null);
  };
  Game.prototype.cancelNpc = function (n, msg) {
    if (n.target) n.target.targeted = false;
    if (msg && n.tip) this.fx.text(n.tip.x, n.tip.y, n.cfg.name + '：' + msg, '#ffe6b0', 14 * Math.max(0.8, this.unit));
    if (!n.tip) { n.phase = 'idle'; n.carry = null; n.target = null; return; }
    n.carry = null; n.target = null; n.phase = 'retreat'; n.t = 0; n.from = n.tip;
  };

  Game.prototype.updateNpcs = function (dt) {
    for (var i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i]; if (n.phase === 'idle') continue;
      n.t += dt;
      var f = n.target, T = f ? this.toScreen(f.nx, f.ny) : n.tip;
      var out = function (k) { return { x: T.x + n.dir.x * n.reach * k, y: T.y + n.dir.y * n.reach * k }; };
      if (n.phase === 'warn') {
        // 筷子先在锅边探出来，晃一晃，给玩家反应时间
        var k = 0.62 + Math.sin(n.t * 9) * 0.015 + (1 - easeOut(Math.min(1, n.t / 0.35))) * 0.4;
        n.tip = out(k);
        if (n.t >= HP.NPC_WARN) { n.phase = 'reach'; n.t = 0; n.from = n.tip; }
      } else if (n.phase === 'reach') {
        var t = easeOut(Math.min(1, n.t / 0.32)), o = out(0.62);
        n.tip = { x: lerp(o.x, T.x, t), y: lerp(o.y, T.y, t) };
        if (n.t >= 0.32) {
          n.phase = 'grab'; n.t = 0;
          f.state = 'stolen'; n.carry = f; this.stats.stolen++; this.stats.combo = 0;
          this.fx.splash(f.nx, f.ny, 0.6);
          this.fx.text(T.x, T.y - 30 * this.unit, n.cfg.name + '抢走了' + HP.FOODS[f.type].name + '！', '#ff9b7a', 16 * Math.max(0.8, this.unit));
          if (this.audio) this.audio.clack();
          if (this.hooks.onScore) this.hooks.onScore(this.stats, null);
        }
      } else if (n.phase === 'grab') {
        if (n.t >= 0.12) { n.phase = 'retreat'; n.t = 0; n.from = n.tip; }
      } else if (n.phase === 'retreat') {
        var r = Math.min(1, n.t / 0.55), e = r * r;
        var far = { x: n.from.x + n.dir.x * n.reach * 1.2, y: n.from.y + n.dir.y * n.reach * 1.2 };
        n.tip = { x: lerp(n.from.x, far.x, e), y: lerp(n.from.y, far.y, e) };
        if (r >= 1) {
          if (n.carry) this.foods.splice(this.foods.indexOf(n.carry), 1);
          n.phase = 'idle'; n.carry = null; n.target = null; n.tip = null;
        }
      }
    }
  };

  /* ---------- 每帧更新 ---------- */
  Game.prototype.update = function (dt) {
    this.time += dt;
    this.fx.update(dt);
    if (!this.running) return;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, HP.ROUND_TIME - this.elapsed);

    for (var i = this.foods.length - 1; i >= 0; i--) {
      var f = this.foods[i], F = HP.FOODS[f.type];
      if (f.drop > 0) f.drop = Math.max(0, f.drop - dt);
      if (f.state !== 'in') continue;
      f.t += dt;
      f.d += dt * HP.HEAT[f.cell];
      // 虾滑：生的沉在锅底，快熟时浮上来（玩家看「浮起」判断）
      var target = F.sinker ? (f.d < F.a * 0.85 ? 0.85 : 0) : F.depth + (f.d > F.b + 4 ? 0.12 : 0);
      f.depth += (target - f.depth) * Math.min(1, dt * 1.6);
    }
    for (i = this.lift.length - 1; i >= 0; i--) {
      var L = this.lift[i]; L.t += dt;
      if (L.t > 0.55) { this.foods.splice(this.foods.indexOf(L.f), 1); this.lift.splice(i, 1); }
    }

    this.nextNpc -= dt;
    if (this.nextNpc <= 0) this.scheduleNpc();
    this.updateNpcs(dt);

    if (this.timeLeft <= 0) { this.running = false; this.drag = null; if (this.hooks.onEnd) this.hooks.onEnd(this.stats); }
  };

  /* ---------- 绘制 ---------- */
  Game.prototype.foodWeights = function (f) {
    var F = HP.FOODS[f.type];
    var s1 = smooth(F.a * 0.45, F.a, f.d), s2 = smooth(F.b, F.b + (F.b - F.a) + 5, f.d);
    return [1 - s1, s1 * (1 - s2), s2];
  };

  /* 画一块食材：三个熟度状态按权重渐变，再按「泡在汤里的深度」盖一层红汤色 */
  Game.prototype.drawFood = function (ctx, type, x, y, w, rot, depth, scale, alpha) {
    var imgs = this.img.food[type], F = HP.FOODS[type];
    var base = Math.max(imgs[0].width, imgs[0].height);
    var k = F.size * this.potSize / base * (scale || 1);
    var box = Math.ceil(F.size * this.potSize * 1.9 * (scale || 1));
    var dpr = this.dpr, sc = this.scratch, s = this.sctx;
    if (sc.width < box * dpr || sc.height < box * dpr) { sc.width = sc.height = Math.ceil(box * dpr * 1.2); }
    s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, sc.width, sc.height);
    s.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.translate(box / 2, box / 2); s.rotate(rot);
    for (var i = 0; i < 3; i++) {
      if (w[i] < 0.01) continue;
      var im = imgs[i];
      s.globalAlpha = Math.min(1, w[i] * (i === 0 ? 1 : 1.25));
      s.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k);
    }
    s.globalAlpha = 1;
    if (depth > 0.01) {
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-atop';
      s.fillStyle = 'rgba(120,8,2,' + Math.min(0.62, depth * 0.7) + ')';
      s.fillRect(0, 0, box * dpr, box * dpr);
      s.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    // 汤里的倒影阴影，让食材「浸」在汤里而不是贴在上面
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.28 * (1 - depth);
    ctx.fillStyle = '#2a0000';
    ctx.beginPath(); ctx.ellipse(x + 2 * this.unit, y + 3 * this.unit, F.size * this.potSize * 0.42 * (scale || 1), F.size * this.potSize * 0.32 * (scale || 1), rot, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * (1 - depth * 0.35);
    ctx.drawImage(sc, 0, 0, box * dpr, box * dpr, x - box / 2, y - box / 2, box, box);
    ctx.restore();
  };

  Game.prototype.drawHint = function (ctx, f, x, y) {
    var F = HP.FOODS[f.type], r = F.size * this.potSize * 0.58 + 4;
    var p = clamp(f.d / F.b, 0, 1), col;
    if (f.d < F.a) col = '#9fd8ff';
    else if (f.d <= F.b) col = 'rgba(110,255,150,' + (0.75 + 0.25 * Math.sin(this.time * 12)) + ')';
    else col = '#ff7048';
    ctx.save();
    ctx.lineWidth = 3 * Math.max(0.8, this.unit); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // 完美区间标记
    ctx.strokeStyle = 'rgba(110,255,150,0.35)';
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2 + Math.PI * 2 * F.a / F.b, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    ctx.restore();
  };

  Game.prototype.drawSprite = function (ctx, im, tipNorm, tip, rot, height, alpha) {
    var k = height / im.height;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(tip.x, tip.y); ctx.rotate(rot);
    // 投影
    ctx.save(); ctx.globalAlpha *= 0.25; ctx.filter = 'blur(6px)';
    ctx.drawImage(im, -tipNorm[0] * im.width * k + 10, -tipNorm[1] * im.height * k + 12, im.width * k, im.height * k);
    ctx.restore();
    ctx.drawImage(im, -tipNorm[0] * im.width * k, -tipNorm[1] * im.height * k, im.width * k, im.height * k);
    ctx.restore();
  };

  Game.prototype.render = function () {
    var ctx = this.ctx, S = this.img.scene, i, f, p;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 桌面
    var tb = S.table, sc = Math.max(this.W / tb.width, this.H / tb.height);
    ctx.drawImage(tb, (this.W - tb.width * sc) / 2, (this.H - tb.height * sc) / 2, tb.width * sc, tb.height * sc);
    var vg = ctx.createRadialGradient(this.W / 2, this.potY + this.potSize / 2, this.potSize * 0.4, this.W / 2, this.potY + this.potSize / 2, Math.max(this.W, this.H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,2,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, this.W, this.H);

    // 锅底下的暖光
    var glow = ctx.createRadialGradient(this.W / 2, this.potY + this.potSize / 2, this.potSize * 0.3, this.W / 2, this.potY + this.potSize / 2, this.potSize * 0.62);
    glow.addColorStop(0, 'rgba(255,90,20,0.25)'); glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, this.W, this.H);

    ctx.drawImage(S.pot, this.potX, this.potY, this.potSize, this.potSize);
    this.fx.drawSoup(ctx, this.time);

    // 食材：沉得深的先画
    var list = this.foods.filter(function (f) { return f.state === 'in'; }).sort(function (a, b) { return b.depth - a.depth; });
    for (i = 0; i < list.length; i++) {
      f = list[i];
      var heat = HP.HEAT[f.cell];
      p = this.toScreen(f.nx, f.ny);
      // 汤在翻滚，食材跟着上下浮动、轻轻打转
      var bx = Math.sin(f.t * 0.9 + f.ph) * 1.6 * heat * this.unit;
      var by = Math.cos(f.t * 1.3 + f.ph) * 1.2 * heat * this.unit;
      var rot = f.rot + Math.sin(f.t * 0.7 + f.ph) * 0.06 * heat;
      var dropS = f.drop > 0 ? 1 + f.drop * 1.6 : 1;
      this.drawFood(ctx, f.type, p.x + bx, p.y + by, this.foodWeights(f), rot, f.depth, dropS, 1);
      if (this.hints && f.depth < 0.5) this.drawHint(ctx, f, p.x + bx, p.y + by);
      if (f.targeted) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,70,50,' + (0.5 + 0.5 * Math.sin(this.time * 14)) + ')';
        ctx.lineWidth = 2.5 * this.unit; ctx.setLineDash([6 * this.unit, 5 * this.unit]);
        ctx.beginPath(); ctx.arc(p.x, p.y, HP.FOODS[f.type].size * this.potSize * 0.75 + 6, this.time * 2, this.time * 2 + Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    this.fx.drawDrops(ctx);

    // NPC 的手
    for (i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i]; if (n.phase === 'idle' || !n.tip) continue;
      if (n.carry) this.drawFood(ctx, n.carry.type, n.tip.x, n.tip.y, this.foodWeights(n.carry), n.carry.rot, 0, 1.05, 1);
      this.drawSprite(ctx, S[n.cfg.img], n.cfg.tip, n.tip, n.rot, this.potSize * 0.78, 1);
    }

    // 玩家筷子：捞起的菜
    var chopH = this.potSize * 0.62, chopRot = Math.PI - 0.38;
    for (i = 0; i < this.lift.length; i++) {
      var L = this.lift[i], t = Math.min(1, L.t / 0.55), e = easeOut(t);
      var x = lerp(L.x0, this.bowl.x, e * e), y = lerp(L.y0, this.bowl.y, e * e) - Math.sin(t * Math.PI) * 40 * this.unit;
      this.drawFood(ctx, L.f.type, x, y, this.foodWeights(L.f), L.f.rot, 0, 1 + Math.sin(t * Math.PI) * 0.35, 1 - Math.max(0, (t - 0.75) / 0.25));
      this.drawSprite(ctx, S.chopsticks_closed, [0.483, 0.999], { x: x, y: y }, chopRot, chopH, 1 - Math.max(0, (t - 0.8) / 0.2));
    }
    // 玩家筷子：从盘子夹起、正在拖动的菜
    if (this.drag) {
      var dp = this.dragPoint(this.drag), n2 = this.toNorm(dp.x, dp.y), ok = this.cellAt(n2.nx, n2.ny) >= 0;
      if (ok) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,230,180,0.6)'; ctx.lineWidth = 2 * this.unit;
        ctx.beginPath(); ctx.ellipse(dp.x, dp.y + 4 * this.unit, 22 * this.unit, 15 * this.unit, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      this.drawFood(ctx, this.drag.type, dp.x, dp.y, [1, 0, 0], -0.2, 0, 1.15, ok ? 1 : 0.85);
      this.drawSprite(ctx, S.chopsticks_closed, [0.483, 0.999], dp, chopRot, chopH, 1);
    }

    this.fx.drawSteam(ctx, this.time);
    this.fx.drawTexts(ctx);
  };
})();
