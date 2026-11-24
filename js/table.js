/* 同桌的人：坐在锅对面，点单、等菜、吃到了有反应。玩家可以把菜夹给 TA，也可以自己吃。 */
var HP = window.HP = window.HP || {};

(function () {
  var G = HP.Game.prototype;
  var SEAT_X = { L: 0.17, C: 0.5, R: 0.83 };
  var MOODS = ['wait', 'happy', 'angry'];
  function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  /* ---------- 座位布局：锅上方留一条「对面」 ---------- */
  G.seatBandH = function (w) { return this.scene && this.scene.diners ? clamp(w * 0.24, 76, 110) : 0; };
  G.layoutSeats = function () {
    var self = this, B = this.seatBand, R = B * 0.3;
    (this.diners || []).forEach(function (d) {
      d.x = self.W * SEAT_X[d.seat]; d.y = self.seatTop + B * 0.44; d.r = R;
      var side = d.seat === 'R' ? -1 : 1;
      d.bx = d.x + side * R * 1.75; d.by = d.y + R * 0.1; d.br = R * 0.72;
    });
  };

  G.initDiners = function () {
    var S = this.scene, self = this;
    var K = this.mode === 'play' ? this.card : null;
    this.diners = (S.diners || []).map(function (p, i) {
      var id = (K && K.swap && K.swap[p[0]]) || p[0], C = HP.DINERS[id], swapped = id !== p[0];
      var prefs = K && K.prefs && K.prefs[id];
      if (prefs) C = Object.assign({}, C, { prefs: prefs });
      return { id: id, cfg: C, seat: p[1], name: (!swapped && S.names && S.names[id]) || C.name, shy: !!(K && K.shy && K.shy.indexOf(id) >= 0),
               order: null, cool: HP.ORDER_FIRST + i * 2.2, mood: 'wait', moodT: 0, say: null, sayT: 0,
               fed: 0, aff: 0, bounce: 0 };
    });
    this.layoutSeats();
  };

  /* 这一局托盘上有哪些菜（点单只会点托盘上有的） */
  G.orderPool = function (d) {
    var menu = this.menu || HP.FOOD_ORDER, self = this;
    var busy = this.diners.map(function (x) { return x.order && x.order.type; });
    var ok = function (id) { return id !== 'jianshouqing' && busy.indexOf(id) < 0 && menu.indexOf(id) >= 0; };
    var pool = d.cfg.prefs.filter(ok);
    if (!pool.length) pool = menu.filter(ok);
    return pool;
  };
  G.newOrder = function (d) {
    var pool = this.orderPool(d); if (!pool.length) { d.cool = 2; return; }
    var type = pool[Math.floor(this.rng() * pool.length)], F = HP.FOODS[type];
    var auth = !!F.dips && this.rng() < d.cfg.auth;
    var ttl = clamp(F.a * 1.2 + (F.mode === 'swish' ? 11 : 12), 13, 30);
    d.order = { type: type, auth: auth, t: 0, ttl: ttl };
    d.mood = 'wait'; d.bounce = 1;
    var line = pick(d.cfg.order, this.rng).replace(/\{d\}/g, F.name);
    this.dinerSay(d, line + (auth ? '（要七上八下）' : ''), 2.2);
    this.stats.orders++;
    if (this.audio) this.audio.pop(3);
    this.emit('order', { diner: d.id, type: type });
  };
  G.dinerSay = function (d, text, dur) { d.say = text; d.sayT = dur || 1.8; };
  G.setMood = function (d, mood, dur) { d.mood = mood; d.moodT = dur || 1.6; d.bounce = 1; };

  G.updateDiners = function (dt) {
    if (!this.diners || !this.diners.length) return;
    var ph = this.phase(), active = 0, i, d, watching = this.event && this.event.type === 'proposal';
    for (i = 0; i < this.diners.length; i++) if (this.diners[i].order) active++;
    for (i = 0; i < this.diners.length; i++) {
      d = this.diners[i];
      d.bounce = Math.max(0, d.bounce - dt * 3);
      if (d.sayT > 0) d.sayT -= dt;
      if (d.moodT > 0) { d.moodT -= dt; if (d.moodT <= 0) d.mood = 'wait'; }
      if (d.order) {
        if (!watching) d.order.t += dt;
        if (d.order.t >= d.order.ttl) this.missOrder(d);
      } else if (this.waitBoss <= 0 && this.timeLeft > 5 && !d.shy && !watching) {
        d.cool -= dt;
        if (d.cool <= 0 && active < ph.maxOrders) { this.newOrder(d); active++; }
      }
    }
  };
  G.missOrder = function (d) {
    var s = this.stats, F = HP.FOODS[d.order.type], quiet = d.cfg.quiet;
    s.orderMiss++; d.aff--; if (!quiet) s.score = Math.max(0, s.score - 15);
    d.order = null; d.cool = this.rr(3, 5);
    this.setMood(d, 'angry', 2.2);
    this.dinerSay(d, pick(d.cfg.miss, this.rng), 2.2);
    this.fx.text(d.x, d.y + d.r * 1.6, '没等到' + F.name + (quiet ? '' : ' -15'), '#ff9b7a', 14 * Math.max(0.8, this.unit));
    if (this.hooks.onScore) this.hooks.onScore(s, null);
  };

  /* 手指（或菜）在不在某个人的位置上 */
  G.dinerAt = function (x, y, x2, y2) {
    var best = null, bd = 1e9;
    for (var i = 0; i < (this.diners || []).length; i++) {
      var d = this.diners[i], r = d.r * 1.7;
      [[x, y], [x2, y2], [x2, y2 + d.r]].forEach(function (p) {
        if (p[0] == null) return;
        var dd = Math.min(Math.hypot(p[0] - d.x, p[1] - d.y), Math.hypot(p[0] - d.bx, p[1] - d.by) * 1.2);
        if (dd < r && dd < bd) { bd = dd; best = d; }
      });
    }
    return best;
  };

  /* ---------- 夹给别人 ---------- */
  G.serve = function (f, d, x, y) {
    var r = this.rate(f), s = this.stats, F = HP.FOODS[f.type], big = Math.max(0.8, this.unit);
    var o = d.order, match = o && o.type === f.type, gain, good = r.kind === 'perfect' || r.kind === 'ok';
    var cid = this.mode === 'play' && this.card ? this.card.id : null;
    this.speechBreak(x, y);
    // 减肥的闺蜜：给她夹肉，嘴上说不要……
    if (cid === 'diet' && d.id === 'friend' && !F.veg && good) {
      s.dietCheat++; d.aff += 1; s.served++; d.fed++; s.servedTo[d.id] = (s.servedTo[d.id] || 0) + 1; s.servedExtra++;
      if (r.kind === 'perfect') { s.perfect++; s.perfectBy[f.type] = (s.perfectBy[f.type] || 0) + 1; }
      s.score += 30; this.setMood(d, 'happy', 1.8); this.dinerSay(d, '不要不要……（吃了）', 2);
      this.fx.text(d.x, d.y + d.r * 1.55, '偷偷投喂 +30', '#ffd35c', 18 * big);
      if (this.audio) this.audio.crunch(r.kind === 'perfect');
      if (this.hooks.onScore) this.hooks.onScore(s, r);
      this.emit('serve', { diner: d.id, type: f.type, kind: r.kind, match: false });
      return r;
    }
    if (match) {
      if (r.kind === 'perfect') {
        var authMiss = o.auth && !r.authentic;
        gain = Math.round((authMiss ? 70 : 140) * HP.ptsOf(f.type)) + (o.auth && r.authentic ? 80 : 0);
        if (!authMiss) { s.combo++; gain = Math.round(gain * Math.min(3, 1 + (s.combo - 1) * 0.5)); }
        s.ordersDone++; s.ordersPerfect++; d.aff += 2;
        this.setMood(d, authMiss ? 'wait' : 'happy', 2);
        this.dinerSay(d, authMiss ? '没七上八下啊……' : pick(d.cfg.happy, this.rng), 2);
      } else if (r.kind === 'ok') {
        gain = 50; s.ordersDone++; d.aff += 1; s.combo = 0;
        this.setMood(d, 'happy', 1.4); this.dinerSay(d, pick(d.cfg.meh, this.rng), 1.8);
      } else {
        gain = -20; s.servedBad++; d.aff -= 1; s.combo = 0;
        this.setMood(d, 'angry', 2); this.dinerSay(d, pick(d.cfg.bad, this.rng), 2);
      }
      d.order = null; d.cool = this.rr(this.phase().order[0], this.phase().order[1]);
    } else {
      // 没点这个也照收：好吃的话关系变好一点
      gain = r.kind === 'perfect' ? 30 : r.kind === 'ok' ? 10 : -10;
      if (good) { d.aff += 1; this.setMood(d, 'happy', 1.2); this.dinerSay(d, pick(d.cfg.thanks, this.rng), 1.6); }
      else { s.servedBad++; d.aff -= 1; this.setMood(d, 'angry', 1.6); this.dinerSay(d, pick(d.cfg.bad, this.rng), 1.8); }
      s.servedExtra++;
    }
    // 饭局卡：目标计数、分数加成
    if (cid === 'heartbreak' && d.id === 'laowang') { if (gain > 0) gain = Math.round(gain * 1.5); if (f.type === 'maodu' && good) s.cardGoal++; }
    if (cid === 'diet' && d.id === 'friend' && match && good) s.cardGoal++;
    if (cid === 'newbie' && d.id === 'newbie' && good) s.cardGoal++;
    if (cid === 'birthday' && this.bd === d && good) s.cardGoal++;
    if (cid === 'gfdate' && d.id === 'gf' && match && r.kind === 'perfect') s.cardGoal++;
    if (cid === 'aa' && F.price >= 20 && gain > 0) gain *= 2;
    if (cid === 'freemaodu' && r.authentic && gain > 0) gain *= 2;
    if (r.authentic) s.authentic++;
    if (r.kind === 'perfect') { s.perfect++; s.perfectBy[f.type] = (s.perfectBy[f.type] || 0) + 1; }
    if (r.kind === 'raw') s.rawServed++;
    if (r.kind === 'over') s.over++;
    if (!this.hints && gain > 0) gain = Math.round(gain * HP.HINT_OFF_BONUS);
    if (this.waitBoss > 0 && this.mode === 'play') { gain -= 30; s.rude++; }
    s.served++; d.fed++;
    s.servedTo[d.id] = (s.servedTo[d.id] || 0) + 1;
    if (F.special === 'trip' && r.kind === 'raw') { s.tripServed++; this.dinerSay(d, '我怎么看见小人了……', 2.4); }
    if (F.special === 'strawberry') s.strawberry++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.score = Math.max(0, s.score + gain);
    var lab = match ? (r.kind === 'perfect' ? '送达！' : r.kind === 'ok' ? '还行' : '翻车') : '夹给' + d.name;
    this.fx.text(d.x, d.y + d.r * 1.55, lab + (gain >= 0 ? ' +' + gain : ' ' + gain), gain > 0 ? '#ffd35c' : '#ff8a6a', 18 * big);
    if (match && s.combo >= 2 && r.kind === 'perfect') this.fx.text(d.x, d.y + d.r * 2.3, s.combo + ' 连击', '#ffd35c', 14 * big);
    if (this.audio) { this.audio.crunch(r.kind === 'perfect'); if (good && match) this.audio.clink(); }
    if (this.hooks.onScore) this.hooks.onScore(s, r);
    if (this.hooks.haptic) this.hooks.haptic(r.kind);
    this.emit('serve', { diner: d.id, type: f.type, kind: r.kind, match: !!match });
    return r;
  };

  /* ---------- 绘制：头像（有素材用素材，没有就画个简笔脸）、点单气泡、说的话 ---------- */
  G.avatarImg = function (d, mood) {
    var S = this.img.scene;
    return S['avatar_' + d.id + '_' + mood] || S['avatar_' + d.id + '_wait'] || S['avatar_' + d.id + '_happy'] || null;
  };
  G.drawDiners = function (ctx) {
    if (!this.diners || !this.diners.length) return;
    var u = Math.max(0.8, this.unit), self = this, carrying = !!(this.carry || (this.hold && this.hold.entered));
    var hover = carrying ? this.dinerAt(this.carry ? this.carry.x : this.hold.x, this.carry ? this.carry.y : this.hold.y,
      this.carry ? this.dragPoint(this.carry).x : null, this.carry ? this.dragPoint(this.carry).y : null) : null;
    this.diners.forEach(function (d) {
      var r = d.r * (1 + d.bounce * 0.08 * Math.sin(d.bounce * 12));
      ctx.save();
      // 夹着菜时：每个人身后亮一圈，指在谁身上谁更亮
      if (carrying) {
        ctx.fillStyle = d === hover ? 'rgba(255,214,92,0.55)' : 'rgba(255,214,92,0.18)';
        ctx.beginPath(); ctx.arc(d.x, d.y, r * (d === hover ? 1.42 : 1.25), 0, Math.PI * 2); ctx.fill();
      }
      var im = self.avatarImg(d, d.mood);
      if (im) {
        var s = r * 2.85;
        ctx.drawImage(im, d.x - s / 2, d.y - s / 2 - r * 0.12, s, s);
      } else self.drawFace(ctx, d, r);
      if (self.bd === d) self.drawCrown(ctx, d.x, d.y - r * 1.02, r);
      // 名字
      ctx.font = '700 ' + Math.round(11 * u) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var nw = ctx.measureText(d.name).width + 12 * u;
      ctx.fillStyle = 'rgba(30,6,2,0.7)';
      rr(ctx, d.x - nw / 2, d.y + r * 0.92, nw, 16 * u, 8 * u); ctx.fill();
      ctx.fillStyle = '#ffe9cf'; ctx.fillText(d.name, d.x, d.y + r * 0.92 + 8.5 * u);
      ctx.restore();
      if (d.order) self.drawOrder(ctx, d);
      if (d.say && d.sayT > 0) self.drawSay(ctx, d);
    });
  };
  /* 寿星的生日帽 */
  G.drawCrown = function (ctx, x, y, r) {
    ctx.save(); ctx.translate(x + r * 0.25, y); ctx.rotate(0.25);
    ctx.fillStyle = '#ff6fa0'; ctx.beginPath(); ctx.moveTo(-r * 0.32, r * 0.1); ctx.lineTo(0, -r * 0.62); ctx.lineTo(r * 0.32, r * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(0, -r * 0.64, r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.12); ctx.lineTo(r * 0.12, -r * 0.3); ctx.moveTo(-r * 0.27, r * 0.02); ctx.lineTo(r * 0.24, -r * 0.1); ctx.stroke();
    ctx.restore();
  };
  /* 没素材时的简笔头像：圆脸 + 表情 */
  G.drawFace = function (ctx, d, r) {
    ctx.fillStyle = d.cfg.color; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08); ctx.strokeStyle = '#fff4e4'; ctx.stroke();
    ctx.fillStyle = '#ffe2c4'; ctx.beginPath(); ctx.arc(d.x, d.y + r * 0.08, r * 0.72, 0, Math.PI * 2); ctx.fill();
    var ex = r * 0.26, ey = d.y - r * 0.05, m = d.mood;
    ctx.fillStyle = '#3a1a10'; ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round';
    if (m === 'happy') {
      [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(d.x + k * ex, ey + r * 0.04, r * 0.1, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(d.x, d.y + r * 0.22, r * 0.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,110,0.45)';
      [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(d.x + k * r * 0.42, d.y + r * 0.2, r * 0.1, 0, Math.PI * 2); ctx.fill(); });
    } else if (m === 'angry') {
      [-1, 1].forEach(function (k) {
        ctx.beginPath(); ctx.arc(d.x + k * ex, ey + r * 0.05, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(d.x + k * ex * 1.5, ey - r * 0.16); ctx.lineTo(d.x + k * ex * 0.5, ey - r * 0.06); ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(d.x, d.y + r * 0.42, r * 0.17, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else {
      [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(d.x + k * ex, ey, r * 0.09, 0, Math.PI * 2); ctx.fill(); });
      ctx.beginPath(); ctx.ellipse(d.x, d.y + r * 0.3, r * 0.1, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  /* 点单气泡：菜的图 + 倒计时圈 */
  G.drawOrder = function (ctx, d) {
    var o = d.order, F = HP.FOODS[o.type], u = Math.max(0.8, this.unit), x = d.bx, y = d.by, R = d.br;
    var left = 1 - o.t / o.ttl, urgent = left < 0.3;
    var pop = Math.min(1, o.t / 0.25), sc = 0.6 + 0.4 * easeOut(pop) + (urgent ? Math.sin(this.time * 14) * 0.04 : 0);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(255,247,236,0.96)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    var side = d.seat === 'R' ? 1 : -1;   // 小尾巴指向说话的人
    ctx.beginPath(); ctx.moveTo(side * R * 0.7, -R * 0.45); ctx.lineTo(side * R * 1.25, -R * 0.15); ctx.lineTo(side * R * 0.85, R * 0.05); ctx.fill();
    ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(0, 0, R + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = urgent ? '#ff5a3c' : left < 0.6 ? '#ffb12b' : '#4fcf74';
    ctx.beginPath(); ctx.arc(0, 0, R + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
    ctx.restore();
    this.drawFood(ctx, o.type, x, y, [0, 1, 0], -0.2, 0, sc * R * 1.45 / (F.size * this.potSize), 1);
    if (o.auth) this.drawTag(ctx, x, y + R * 1.05 * sc, '七上八下', '#7dff9a');
  };
  G.drawTag = function (ctx, x, y, str, col) {
    var u = Math.max(0.8, this.unit);
    ctx.save(); ctx.font = '800 ' + Math.round(10 * u) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    var w = ctx.measureText(str).width + 10 * u;
    ctx.fillStyle = 'rgba(30,6,2,0.8)'; rr(ctx, x - w / 2, y - 8 * u, w, 16 * u, 8 * u); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y + 0.5);
    ctx.restore();
  };
  /* 说的话：头像下方的小气泡 */
  G.drawSay = function (ctx, d) {
    var u = Math.max(0.8, this.unit), a = Math.min(1, d.sayT / 0.3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '700 ' + Math.round(12 * u) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    var w = Math.min(ctx.measureText(d.say).width + 16 * u, this.W * 0.46), h = 22 * u;
    var x = clamp(d.x, w / 2 + 4, this.W - w / 2 - 4), y = d.y + d.r + 30 * u;
    ctx.fillStyle = d.mood === 'angry' ? 'rgba(120,30,20,0.92)' : 'rgba(255,248,236,0.95)';
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(d.x - 5 * u, y - h / 2 + 1); ctx.lineTo(d.x, y - h / 2 - 6 * u); ctx.lineTo(d.x + 5 * u, y - h / 2 + 1); ctx.fill();
    ctx.fillStyle = d.mood === 'angry' ? '#ffe2d6' : '#4a1a0e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.say, x, y + 0.5, w - 10 * u);
    ctx.restore();
  };
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  HP.MOODS = MOODS;
})();
