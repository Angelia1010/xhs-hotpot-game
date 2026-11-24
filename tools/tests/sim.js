// 机器人压力测试：直接驱动游戏代码，模拟手指操作。返回每局统计。
(function (cfg) {
  var HP = window.HP, g = HP.game;
  var SK = {
    good: { noise: 0.15, cap: 6, block: 0.9, toast: 0.95, think: 0.35, serve: 0.9, focus: 0.8, calm: 0.9 },
    avg:  { noise: 0.45, cap: 4, block: 0.5, toast: 0.7,  think: 0.8, serve: 0.6, focus: 0.5, calm: 0.6 },
    bad:  { noise: 0.9,  cap: 3, block: 0.15, toast: 0.35, think: 1.4, serve: 0.3, focus: 0.2, calm: 0.3 }
  };
  function R(a, b) { return a + Math.random() * (b - a); }
  function target(type, sk) {
    var F = HP.FOODS[type], mid = (F.a + F.b) / 2, span = (F.b - F.a) / 2 + F.a * 0.3;
    return Math.max(0.2, mid + (Math.random() * 2 - 1) * span * sk.noise * 2);
  }
  var out = [], errors = [], savedEnd = g.hooks.onEnd; g.hooks.onEnd = function () {};
  cfg.rounds.forEach(function (rd) {
    var sk = SK[rd.skill];
    try {
      var all = HP.FOOD_ORDER.slice().sort(function () { return Math.random() - 0.5; });
      var tray = rd.menu || all.slice(0, 8);
      g.setup({ scene: rd.scene, pot: rd.pot, seed: rd.seed || 0, menu: tray });
      g.mode = 'play'; g.hints = rd.hints !== false; g.reset(); g.running = true;
      var dt = 1 / 30, cool = 0.5, holdPlan = null, frame = 0, maxFx = 0, maxFoods = 0, nan = 0;
      if (rd.think != null) sk = Object.assign({}, sk, { think: rd.think });
      if (rd.style === 'carer') sk = Object.assign({}, sk, { serve: 1, focus: 1 });
      if (rd.style === 'glutton') sk = Object.assign({}, sk, { serve: 0, focus: 0 });
      var orderFor = function (type) { return (g.diners || []).filter(function (d) { return d.order && d.order.type === type; })[0]; };
      var speechHold = false;
      var npcDecided = {}, toastDecided = null;
      while (g.running && frame < 30 * 100) {
        frame++;
        cool -= dt;
        // 讲话时：大概率停手
        if (g.event && g.event.type === 'speech') { if (g.event.t < dt * 1.5) speechHold = Math.random() < sk.calm; } else speechHold = false;
        var u = g.unit;
        // 1. 正在涮
        if (g.hold && holdPlan) {
          holdPlan.t += dt;
          var h = g.hold;
          if (!h.entered) { var tp = g.toScreen(holdPlan.nx, holdPlan.ny); g.dragMove(tp.x, tp.y + 54 * u); }
          else if (HP.FOODS[h.type].dips) {
            // 七上八下：每 0.4 秒换一次方向
            var phase = Math.floor(holdPlan.t / 0.4) % 2, base = g.toScreen(holdPlan.nx, holdPlan.ny);
            var wantDips = rd.skill === 'good' ? 7 + (Math.random() < 0.5 ? 1 : 0) : Math.round(R(3, 10));
            holdPlan.want = holdPlan.want || wantDips;
            if (h.dips < holdPlan.want) g.dragMove(base.x, base.y + 54 * u - (phase ? 45 * u : 0));
            else g.dragMove(base.x, base.y + 54 * u);
          }
          if (h.entered && h.d >= holdPlan.target && (!HP.FOODS[h.type].dips || h.dips >= (holdPlan.want || 0) || holdPlan.t > 9)) {
            var od = orderFor(h.type) || (rd.style === 'carer' && g.diners && g.diners.length ? g.diners[Math.floor(Math.random() * g.diners.length)] : null);
            if (od && Math.random() < sk.serve) g.dragMove(od.x, od.y + 10);
            g.dragEnd(); holdPlan = null; cool = sk.think;
          }
          else if (holdPlan.t > 12) { g.dragEnd(); holdPlan = null; }
        }
        // 2. 挡筷子
        g.npcs.forEach(function (n, i) {
          if (n.phase === 'warn' && n.tip) {
            var key = i + ':' + (n.target && n.target.id);
            if (npcDecided[key] == null) npcDecided[key] = Math.random() < sk.block ? R(0.2, 0.9) : -1;
            if (npcDecided[key] > 0 && n.t >= npcDecided[key]) { g.pointerDown(n.tip.x + n.dir.x * g.potSize * 0.05, n.tip.y + n.dir.y * g.potSize * 0.05, true); npcDecided[key] = -2; }
          }
        });
        // 3. 敬酒
        if (g.event && g.event.type === 'toast' && !g.event.done) {
          if (toastDecided == null) toastDecided = Math.random() < sk.toast ? R(0.4, 2) : -1;
          if (toastDecided > 0 && g.event.t >= toastDecided) g.toast();
        } else toastDecided = null;
        // 4. 捞熟了的菜（每帧最多一块）
        if (!g.hold && !speechHold) {
          var ready = g.foods.filter(function (f) { return f.state === 'in' && f.botT != null && f.d >= f.botT; })[0];
          if (ready) {
            var p = g.toScreen(ready.nx, ready.ny), od2 = orderFor(ready.type);
            if (!od2 && rd.style === 'carer' && g.diners && g.diners.length) od2 = g.diners[Math.floor(Math.random() * g.diners.length)];
            if (od2 && Math.random() < sk.serve) {
              if (HP.FOODS[ready.type].special === 'tangle') ready.untangled = true;
              g.serveFood(ready, od2, p.x, p.y);
            } else { g.pointerDown(p.x, p.y, true); if (ready.state === 'in') g.pointerDown(p.x, p.y, true); }
          }
        }
        // 5. 下新菜
        var inPot = g.foods.filter(function (f) { return f.state === 'in'; }).length;
        if (!g.hold && !g.drag && cool <= 0 && inPot < (rd.cap || sk.cap) && g.waitBoss <= 0 && !speechHold) {
          var type = tray[Math.floor(Math.random() * tray.length)];
          var want = (g.diners || []).filter(function (d) { return d.order && !g.foods.some(function (f) { return f.state === 'in' && f.type === d.order.type; }); });
          if (want.length && Math.random() < sk.focus) type = want[0].order.type;
          var F = HP.FOODS[type];
          var cell = Math.floor(Math.random() * g.zones.length), sp = g.randomSoupPoint(cell, 0.03), s = g.toScreen(sp.nx, sp.ny);
          g.dragStart(type, s.x, s.y + 200);
          if (F.mode === 'swish') { holdPlan = { nx: sp.nx, ny: sp.ny, t: 0, target: target(type, sk) }; }
          else {
            g.dragMove(s.x, s.y + 54 * u); var before = g.foods.length; g.dragEnd();
            if (g.foods.length > before) g.foods[g.foods.length - 1].botT = target(type, sk);
          }
          cool = sk.think;
        }
        g.update(dt);
        if (frame % 30 === 0) g.render();
        var fx = g.fx, n = fx.bubbles.length + fx.steam.length + fx.drops.length + fx.rings.length + fx.texts.length;
        if (n > maxFx) maxFx = n;
        if (g.foods.length > maxFoods) maxFoods = g.foods.length;
        g.foods.forEach(function (f) { if (!isFinite(f.nx) || !isFinite(f.ny) || !isFinite(f.d)) nan++; });
      }
      var s = g.stats;
      out.push({ skill: rd.skill, scene: rd.scene, pot: rd.pot, score: s.score, perfect: s.perfect, eaten: s.eaten, raw: s.raw, over: s.over,
        stolen: s.stolen, blocked: s.blocked, served: s.served, toastOk: s.toastOk, toastMiss: s.toastMiss, authentic: s.authentic,
        veg: s.veg, meat: s.meat, balanced: s.balanced, trip: s.trip, frames: frame, ended: !g.running, maxFx: maxFx, maxFoods: maxFoods, nan: nan,
        persona: HP.persona(s).name, perfectBy: s.perfectBy, pickedBy: s.pickedBy, self: s.self, orders: s.orders, ordersDone: s.ordersDone, orderMiss: s.orderMiss,
        speechBreak: s.speechBreak, style: rd.style || '' });
    } catch (e) { errors.push(rd.skill + '/' + rd.scene + '/' + rd.pot + ': ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); g.running = false; g.hold = null; g.drag = null; }
  });
  g.running = false; g.hooks.onEnd = savedEnd;
  return { out: out, errors: errors };
})
