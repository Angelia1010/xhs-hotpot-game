/* 动态特效：沸腾气泡、破裂涟漪、油光、热气、溅起的油点、飘字。
   全部用程序实时绘制，不需要额外图片。 */
var HP = window.HP = window.HP || {};

(function () {
  function rand(a, b) { return a + Math.random() * (b - a); }
  HP.rand = rand;

  function makeCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  /* ---------- 预渲染的小精灵图（只画一次，之后反复贴，省性能） ---------- */
  function bubbleSprite() {
    var s = 64, c = makeCanvas(s, s), g = c.getContext('2d'), r = s / 2 - 2;
    var grd = g.createRadialGradient(s / 2, s / 2, r * 0.2, s / 2, s / 2, r);
    grd.addColorStop(0, 'rgba(110,8,0,0.25)');
    grd.addColorStop(0.75, 'rgba(190,40,10,0.35)');
    grd.addColorStop(1, 'rgba(255,150,90,0.75)');
    g.fillStyle = grd; g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,210,160,0.55)'; g.lineWidth = 1.5; g.stroke();
    // 左上高光
    var hl = g.createRadialGradient(s * 0.36, s * 0.34, 0, s * 0.36, s * 0.34, r * 0.45);
    hl.addColorStop(0, 'rgba(255,255,240,0.95)'); hl.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(s * 0.36, s * 0.34, r * 0.45, 0, Math.PI * 2); g.fill();
    // 右下反光
    g.fillStyle = 'rgba(255,200,150,0.35)'; g.beginPath();
    g.ellipse(s * 0.64, s * 0.68, r * 0.22, r * 0.1, -0.6, 0, Math.PI * 2); g.fill();
    return c;
  }

  function softSprite(rgb, inner) {
    var s = 128, c = makeCanvas(s, s), g = c.getContext('2d');
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(' + rgb + ',' + inner + ')');
    grd.addColorStop(0.5, 'rgba(' + rgb + ',' + (inner * 0.45) + ')');
    grd.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    return c;
  }

  var SPR = null;
  function sprites() {
    if (!SPR) {
      SPR = {
        bubble: bubbleSprite(),
        steam: softSprite('255,248,240', 1),
        sheen: softSprite('255,190,120', 1),
        glint: softSprite('255,240,210', 1)
      };
    }
    return SPR;
  }

  /* ---------- 特效系统 ---------- */
  function FX(game) {
    this.game = game;
    this.bubbles = []; this.rings = []; this.drops = []; this.steam = [];
    this.texts = []; this.glints = [];
    this.bubbleAcc = [];
    this.steamAcc = 0;
    this.quality = 1;      // 低端机自动降到 0.6
    for (var i = 0; i < 46; i++) this.glints.push(this.randomGlint());
  }
  HP.FX = FX;

  FX.prototype.randomGlint = function () {
    var p = this.game.randomSoupPoint(-1);
    return { nx: p.nx, ny: p.ny, phase: rand(0, 6.28), speed: rand(1.2, 3.2), size: rand(0.5, 1.4) };
  };

  FX.prototype.spawnBubble = function (cell, big) {
    var p = this.game.randomSoupPoint(cell), heat = this.game.heatOf(cell) * this.game.heatMul;
    var max = (big ? rand(7, 12) : rand(2.2, 5.5) * (0.7 + heat * 0.35));
    this.bubbles.push({ nx: p.nx, ny: p.ny, r: 0, max: max, t: 0, life: rand(0.35, 0.9) / (0.6 + heat * 0.4), cell: cell });
  };

  FX.prototype.splash = function (nx, ny, strength) {
    var k = strength || 1, i;
    this.rings.push({ nx: nx, ny: ny, r: 4, max: 26 * k, t: 0, life: 0.55, w: 2.2 });
    this.rings.push({ nx: nx, ny: ny, r: 2, max: 16 * k, t: -0.08, life: 0.5, w: 1.4 });
    for (i = 0; i < 10 * k; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(30, 90) * k;
      this.drops.push({ nx: nx, ny: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, z: 0, vz: rand(60, 150), t: 0, size: rand(1, 2.6) });
    }
    var cell = this.game.cellAt(nx, ny);
    if (cell >= 0) for (i = 0; i < 4; i++) this.spawnBubble(cell, false);
  };

  FX.prototype.text = function (x, y, str, color, size) {
    this.texts.push({ x: x, y: y, str: str, color: color || '#fff', size: size || 22, t: 0, life: 1.1 });
  };

  FX.prototype.update = function (dt) {
    var g = this.game, i, b, q = this.quality;

    // 1. 按格子火力生成气泡：中心格翻滚，四角只是微微冒泡
    for (i = 0; i < g.zones.length; i++) {
      var heat = g.heatOf(i) * g.heatMul;
      // 冒泡数量按分区面积折算：九宫格每格约 1/9，鸳鸯锅每边约 1/2
      this.bubbleAcc[i] = (this.bubbleAcc[i] || 0) + dt * (heat * heat * 81 * g.zones[i].share) * q;
      while (this.bubbleAcc[i] > 1) {
        this.bubbleAcc[i] -= 1;
        this.spawnBubble(i, Math.random() < 0.04 * heat);
        // 火旺的格子成簇冒泡
        if (heat > 1.2 && Math.random() < 0.35) this.spawnBubble(i, false);
      }
    }

    for (i = this.bubbles.length - 1; i >= 0; i--) {
      b = this.bubbles[i]; b.t += dt;
      var k = b.t / b.life;
      b.r = b.max * Math.min(1, k * 1.3);
      if (k >= 1) {
        this.bubbles.splice(i, 1);
        this.rings.push({ nx: b.nx, ny: b.ny, r: b.max * 0.8, max: b.max * 2.6, t: 0, life: 0.35, w: 1 });
        if (b.max > 6 || Math.random() < 0.25) {
          for (var d = 0; d < (b.max > 6 ? 4 : 1); d++) {
            var a = rand(0, 6.28);
            this.drops.push({ nx: b.nx, ny: b.ny, vx: Math.cos(a) * 25, vy: Math.sin(a) * 18, z: 0, vz: rand(40, 80), t: 0, size: rand(0.8, 1.6) });
          }
        }
        if (g.audio) g.audio.pop(b.max);
      }
    }

    for (i = this.rings.length - 1; i >= 0; i--) {
      b = this.rings[i]; b.t += dt;
      if (b.t >= b.life) this.rings.splice(i, 1);
    }
    for (i = this.drops.length - 1; i >= 0; i--) {
      b = this.drops[i]; b.t += dt;
      b.vz -= 420 * dt; b.z += b.vz * dt;
      b.nx += b.vx * dt / g.potSize; b.ny += b.vy * dt / g.potSize;
      if (b.z < 0) this.drops.splice(i, 1);
    }

    // 2. 热气：从汤面升起，越旺的格子越多
    this.steamAcc += dt * 7 * q * (0.4 + g.heatMul * 0.6);
    while (this.steamAcc > 1) {
      this.steamAcc -= 1;
      var cell = g.pickZone(function (k) { return g.heatOf(k) * g.heatOf(k); });
      var p = g.randomSoupPoint(cell);
      var s = g.toScreen(p.nx, p.ny);
      this.steam.push({ x: s.x, y: s.y, r: rand(18, 34) * g.unit, t: 0, life: rand(2.6, 4.2),
        vy: -rand(22, 40) * g.unit, sway: rand(8, 20) * g.unit, ph: rand(0, 6.28), a: rand(0.07, 0.14) * (0.6 + g.heatOf(cell) * 0.4) });
    }
    for (i = this.steam.length - 1; i >= 0; i--) {
      b = this.steam[i]; b.t += dt;
      b.y += b.vy * dt; b.r += 22 * g.unit * dt;
      if (b.t >= b.life) this.steam.splice(i, 1);
    }

    for (i = this.texts.length - 1; i >= 0; i--) {
      b = this.texts[i]; b.t += dt; b.y -= 38 * dt;
      if (b.t >= b.life) this.texts.splice(i, 1);
    }
  };

  /* 汤面层：在食材下面 */
  FX.prototype.drawSoup = function (ctx, time) {
    var g = this.game, S = sprites(), i, b, p;
    ctx.save();
    g.clipSoup(ctx);

    // 油光：几团暖色柔光缓慢漂移，汤面像在流动
    ctx.globalCompositeOperation = 'screen';
    for (i = 0; i < 4; i++) {
      var px = 0.5 + Math.sin(time * 0.23 + i * 1.7) * 0.2;
      var py = 0.5 + Math.cos(time * 0.19 + i * 2.3) * 0.2;
      p = g.toScreen(px, py);
      var rr = g.potSize * (0.16 + 0.04 * Math.sin(time * 0.5 + i));
      ctx.globalAlpha = 0.10;
      ctx.drawImage(S.sheen, p.x - rr, p.y - rr * 0.8, rr * 2, rr * 1.6);
    }
    // 细碎闪光：油面反光一闪一闪
    for (i = 0; i < this.glints.length; i++) {
      b = this.glints[i];
      var a = Math.max(0, Math.sin(time * b.speed + b.phase));
      a = a * a * a;
      if (a < 0.05) continue;
      p = g.toScreen(b.nx, b.ny);
      var gs = 5 * b.size * g.unit;
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(S.glint, p.x - gs, p.y - gs * 0.6, gs * 2, gs * 1.2);
    }

    // 破裂后的涟漪
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;
    for (i = 0; i < this.rings.length; i++) {
      b = this.rings[i]; if (b.t < 0) continue;
      var k = b.t / b.life;
      p = g.toScreen(b.nx, b.ny);
      var r = (b.r + (b.max - b.r) * k) * g.unit;
      ctx.globalAlpha = (1 - k) * 0.45;
      ctx.strokeStyle = 'rgb(255,170,120)';
      ctx.lineWidth = (b.w || 1) * g.unit;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // 气泡
    ctx.globalAlpha = 1;
    for (i = 0; i < this.bubbles.length; i++) {
      b = this.bubbles[i];
      p = g.toScreen(b.nx, b.ny);
      var br = b.r * g.unit;
      var wob = 1 + Math.sin(b.t * 30) * 0.05;
      ctx.drawImage(S.bubble, p.x - br * wob, p.y - br / wob, br * 2 * wob, br * 2 / wob);
    }
    ctx.restore();
  };

  /* 溅起的油点：在食材上面 */
  FX.prototype.drawDrops = function (ctx) {
    var g = this.game, i, b, p;
    ctx.save();
    ctx.fillStyle = 'rgb(255,120,60)';
    for (i = 0; i < this.drops.length; i++) {
      b = this.drops[i];
      p = g.toScreen(b.nx, b.ny);
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(p.x, p.y - b.z * g.unit * 0.4, b.size * g.unit, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* 热气层：最上面 */
  FX.prototype.drawSteam = function (ctx, time) {
    var S = sprites(), i, b;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (i = 0; i < this.steam.length; i++) {
      b = this.steam[i];
      var k = b.t / b.life;
      var a = b.a * Math.sin(Math.PI * k);
      ctx.globalAlpha = a;
      var x = b.x + Math.sin(time * 1.1 + b.ph) * b.sway * k;
      ctx.drawImage(S.steam, x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.restore();
  };

  FX.prototype.drawTexts = function (ctx) {
    var i, b;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < this.texts.length; i++) {
      b = this.texts[i];
      var k = b.t / b.life;
      var pop = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = '900 ' + Math.round(b.size * pop) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,0,0,0.75)';
      ctx.strokeText(b.str, b.x, b.y);
      ctx.fillStyle = b.color; ctx.fillText(b.str, b.x, b.y);
    }
    ctx.restore();
  };
})();
