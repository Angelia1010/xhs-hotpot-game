/* 启动：加载素材、搭界面、主循环；首页、商店、图鉴、教学、结算。 */
(function () {
  var HP = window.HP, P = HP.platform;
  var $ = function (id) { return document.getElementById(id); };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('素材加载失败：' + src)); };
      im.src = src;
    });
  }

  function loadAll(onProgress) {
    var jobs = [], images = { scene: {}, food: {} }, done = 0, total;
    HP.ASSETS.scene.forEach(function (n) { jobs.push(['scene', n, 'img/scene/' + n + '.webp']); });
    HP.FOOD_ORDER.forEach(function (n) {
      images.food[n] = [];
      for (var i = 0; i < 3; i++) jobs.push(['food', n, 'img/food/' + n + '_' + i + '.webp', i]);
    });
    total = jobs.length;
    return Promise.all(jobs.map(function (j) {
      return loadImage(j[2]).then(function (im) {
        if (j[0] === 'food') images.food[j[1]][j[3]] = im; else images[j[0]][j[1]] = im;
        done++; onProgress(done / total);
      });
    })).then(function () { return images; });
  }

  function fmt(t) { var s = Math.ceil(t); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function today() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function plateSrc(id) { return 'img/plate/' + id + '.webp'; }

  function init() {
    var canvas = $('cv'), app = $('app'), tray = $('plates'), hud = $('hud');
    var audio = new HP.Audio(), game, tutorial, images;
    var profile = HP.newProfile();
    var insets = { top: 0, bottom: 0 };
    var cardUrl = null, msgTimer = null, current = null, pending = null;

    function msg(text) {
      var m = $('msg'); m.textContent = text; m.className = 'msg show';
      clearTimeout(msgTimer); msgTimer = setTimeout(function () { m.className = 'msg'; }, 1800);
    }

    var VIB = { perfect: 'medium', block: 'heavy', dip: 'light', event: 'heavy', raw: 'light', ok: 'light', over: 'light' };
    var WAIT = { text: '等领导先动筷…', sub: '这 5 秒先别夹菜' };
    var hooks = {
      onScore: function (s) {
        $('score').textContent = s.score;
        var c = $('combo');
        if (s.combo >= 2) { c.textContent = s.combo + ' 连击'; c.className = 'combo show'; }
        else c.className = 'combo';
      },
      onEnd: function (s) { finishRound(s); },
      onEvent: function (type, cfg, on) {
        var e = $('event');
        if (on) { $('event-text').textContent = cfg.text; $('event-sub').textContent = cfg.sub; e.className = 'event show ' + type; }
        else e.className = 'event';
      },
      onAction: function (name, d) { if (tutorial && game.mode === 'tutorial') tutorial.onAction(name, d); },
      haptic: function (kind) { P.vibrate(VIB[kind] || 'light'); }
    };

    /* ---------- 启动：存档 + 安全区 + 素材 ---------- */
    Promise.all([
      P.load('profile').then(function (p) { profile = HP.migrateProfile(p); }),
      P.getInsets().then(function (r) { if (r) insets = r; })
    ]).then(function () {
      return loadAll(function (p) { $('loadbar').style.width = Math.round(p * 100) + '%'; });
    }).then(function (imgs) {
      images = imgs;
      game = new HP.Game(canvas, images, hooks);
      game.audio = audio;
      HP.game = game; HP.profile = function () { return profile; }; // 方便调试
      tutorial = new HP.Tutorial(game, coachUI);
      buildTray(HP.getLoadout(profile));
      layout();
      $('loading').classList.add('hidden');
      showHome();
      requestAnimationFrame(loop);
    }).catch(function (e) { $('loadtext').textContent = e.message; });

    function saveProfile() { P.save('profile', profile); }

    /* ---------- 托盘：本局带上桌的菜 ---------- */
    function buildTray(ids) {
      tray.innerHTML = '';
      ids.forEach(function (id) {
        var F = HP.FOODS[id], p = el('div', 'plate');
        p.setAttribute('data-food', id); p.id = 'plate-' + id;
        var im = el('img'); im.alt = F.name; im.draggable = false;
        // 盘子图加载完托盘才有真实高度，此时重新排版，锅才会居中
        im.onload = function () { if (game) layout(); };
        im.src = plateSrc(id);
        p.appendChild(im);
        p.appendChild(el('span', null, F.name));
        p.appendChild(el('em', 'tag ' + F.mode, F.mode === 'swish' ? '涮' : '煮'));
        tray.appendChild(p);
      });
    }

    /* 排版：避开小红书右上角胶囊按钮和底部安全区 */
    function layout() {
      var w = app.clientWidth, h = app.clientHeight;
      if (insets.top) hud.style.paddingTop = (insets.top + 6) + 'px';
      if (insets.bottom) $('tray').style.paddingBottom = (insets.bottom + 8) + 'px';
      if (insets.top) app.style.setProperty('--inset-top', insets.top + 'px');
      var hudH = hud.offsetHeight, trayH = $('tray').offsetHeight;
      $('combo').style.top = (hudH + 2) + 'px';
      $('tools').style.top = (hudH + 8) + 'px';
      $('event').style.bottom = (trayH - 30) + 'px';
      $('coach').style.bottom = (trayH + 6) + 'px';
      game.layout(w, h, hudH + 6, h - trayH - 4);
    }
    window.addEventListener('resize', function () { if (game) layout(); });

    /* ---------- 首页 ---------- */
    function showHome() {
      var day = HP.dayKey(), D = HP.dailySetup(day);
      $('h-title').textContent = HP.titleOf(profile);
      $('h-coins').textContent = profile.coins;
      var yest = HP.dayKey(new Date(Date.now() - 864e5));
      var alive = profile.streak.last === day || profile.streak.last === yest;
      $('h-streak').textContent = alive && profile.streak.n ? '连续 ' + profile.streak.n + ' 天' : '今天还没吃';
      $('d-date').textContent = HP.dayLabel(day);
      $('d-bonus').style.display = profile.lastPlayDay === day ? 'none' : '';
      var dm = $('d-menu'); dm.innerHTML = '';
      D.menu.forEach(function (id) {
        var it = el('div', 'd-item'), im = el('img'); im.src = plateSrc(id); im.alt = HP.FOODS[id].name;
        it.appendChild(im); it.appendChild(el('small', null, HP.FOODS[id].name)); dm.appendChild(it);
      });
      var dd = profile.daily.day === day ? profile.daily : null;
      $('d-best').textContent = dd && dd.plays ? '今日最高 ' + dd.best + ' 分 · 已吃 ' + dd.plays + ' 次' : '所有人今天吃同一锅，比比谁分高';

      var sc = $('scenes'); sc.innerHTML = '';
      HP.SCENE_ORDER.forEach(function (id) {
        var S = HP.SCENES[id], ok = HP.sceneUnlocked(profile, id), b = el('button', 'scene-card' + (ok ? '' : ' locked'));
        b.type = 'button'; b.setAttribute('data-scene', id);
        var best = profile.bestBy[id];
        b.innerHTML = '<b>' + S.name + '</b><small>' + (ok ? S.desc : '再玩 ' + (S.unlockGames - profile.games) + ' 局解锁') + '</small>' +
          '<em>' + (ok ? (best ? '最高 ' + best : '开吃') : '未解锁') + '</em>';
        sc.appendChild(b);
      });
      $('home').classList.remove('hidden');
    }
    $('scenes').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.scene-card') : null; if (!b) return;
      var id = b.getAttribute('data-scene');
      if (!HP.sceneUnlocked(profile, id)) { msg('再玩 ' + (HP.SCENES[id].unlockGames - profile.games) + ' 局就能解锁'); return; }
      begin({ scene: id, daily: false });
    });
    $('btn-daily').addEventListener('click', function () { begin({ scene: 'bros', daily: true }); });
    $('btn-tutorial').addEventListener('click', function () { pending = null; startTutorial(); });

    /* ---------- 商店：解锁菜品、选上桌的菜 ---------- */
    function showShop() {
      $('s-coins').textContent = profile.coins;
      var lo = HP.getLoadout(profile);
      $('s-count').textContent = lo.length;
      var list = $('s-list'); list.innerHTML = '';
      HP.FOOD_ORDER.forEach(function (id) {
        var F = HP.FOODS[id], have = profile.unlocked.indexOf(id) >= 0, on = lo.indexOf(id) >= 0;
        var it = el('div', 's-item' + (have ? (on ? ' on' : '') : ' locked'));
        it.setAttribute('data-food', id);
        var im = el('img'); im.src = plateSrc(id); im.alt = F.name; it.appendChild(im);
        it.appendChild(el('b', null, F.name + ' <em class="tag ' + F.mode + '">' + (F.mode === 'swish' ? '涮' : '煮') + '</em>'));
        var dex = profile.perfectBy[id] || 0, badge = HP.badgeOf(dex);
        it.appendChild(el('small', null, have ? (badge ? badge.name + ' · ' : '') + '完美 ' + dex + ' 次' : '用金币解锁'));
        it.appendChild(el('span', 'state', have ? (on ? '已上桌' : '未上桌') : '<i class="coin"></i>' + F.unlock));
        list.appendChild(it);
      });
      $('home').classList.add('hidden'); $('shop').classList.remove('hidden');
    }
    $('btn-shop').addEventListener('click', showShop);
    $('s-list').addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.s-item') : null; if (!it) return;
      var id = it.getAttribute('data-food'), err;
      if (profile.unlocked.indexOf(id) < 0) {
        err = HP.unlockFood(profile, id);
        if (!err) { msg('解锁了 ' + HP.FOODS[id].name + '！'); if (audio) audio.clink(); }
      } else err = HP.toggleLoadout(profile, id);
      if (err) msg(err);
      saveProfile(); showShop(); $('h-coins').textContent = profile.coins;
    });

    /* ---------- 图鉴 / 成就 ---------- */
    function showCodex() {
      $('c-title').textContent = HP.titleOf(profile);
      var nx = HP.nextTitle(profile);
      $('c-next').textContent = nx ? '再拿 ' + nx.need + ' 次完美火候，升级为「' + nx.name + '」' : '已经是最高称号了';
      var dex = $('c-dex'); dex.innerHTML = '';
      HP.FOOD_ORDER.forEach(function (id) {
        var n = profile.perfectBy[id] || 0, b = HP.badgeOf(n), next = null;
        for (var i = 0; i < HP.BADGES.length; i++) if (n < HP.BADGES[i][0]) { next = HP.BADGES[i]; break; }
        var row = el('div', 'c-row' + (profile.unlocked.indexOf(id) < 0 ? ' dim' : ''));
        var im = el('img'); im.src = 'img/food/' + id + '_1.webp'; im.alt = ''; row.appendChild(im);
        var pct = next ? Math.round(n / next[0] * 100) : 100;
        row.appendChild(el('div', 'c-info', '<b>' + HP.FOODS[id].name + (b ? ' <em class="badge b' + b.tier + '">' + b.name + '</em>' : '') + '</b>' +
          '<small>完美 ' + n + ' 次' + (next ? ' · 下一级「' + next[1] + '」需 ' + next[0] + ' 次' : ' · 满级') + '</small>' +
          '<span class="prog"><i style="width:' + pct + '%"></i></span>'));
        dex.appendChild(row);
      });
      var ach = $('c-ach'); ach.innerHTML = '';
      var got = 0;
      HP.ACHIEVEMENTS.forEach(function (a) {
        var done = !!profile.ach[a.id]; if (done) got++;
        ach.appendChild(el('div', 'c-row ach' + (done ? ' done' : ''),
          '<div class="c-info"><b>' + a.name + '</b><small>' + a.desc + '</small></div><span class="state">' + (done ? '已达成' : '<i class="coin"></i>' + a.coins) + '</span>'));
      });
      document.querySelector('[data-tab="ach"]').textContent = '成就 ' + got + '/' + HP.ACHIEVEMENTS.length;
      $('home').classList.add('hidden'); $('codex').classList.remove('hidden');
    }
    $('btn-codex').addEventListener('click', showCodex);
    $('codex').addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.tab') : null; if (!t) return;
      var tab = t.getAttribute('data-tab'), tabs = document.querySelectorAll('#codex .tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i] === t);
      $('c-dex').classList.toggle('hidden', tab !== 'dex'); $('c-ach').classList.toggle('hidden', tab !== 'ach');
    });
    var closers = document.querySelectorAll('[data-close]');
    for (var ci = 0; ci < closers.length; ci++) closers[ci].addEventListener('click', function () {
      $(this.getAttribute('data-close')).classList.add('hidden'); showHome();
    });

    /* ---------- 教学引导的界面 ---------- */
    var coachUI = {
      say: function (title, html, opt) {
        $('coach').className = 'coach';
        $('coach-title').textContent = title; $('coach-text').innerHTML = html;
        $('coach-btn').className = 'cta small' + (opt && opt.button ? '' : ' hidden');
        if (opt && opt.button) $('coach-btn').textContent = opt.button;
      },
      glow: function (id) {
        var els = tray.querySelectorAll('.plate');
        for (var i = 0; i < els.length; i++) els[i].classList.toggle('glow', els[i].getAttribute('data-food') === id);
      },
      plateCenter: function (id) {
        var e = $('plate-' + id), r = e.getBoundingClientRect(), c = canvas.getBoundingClientRect();
        return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.width * 0.45 };
      }
    };
    function endTutorial() {
      tutorial.stop(); $('coach').className = 'coach hidden';
      profile.tutorialDone = true; saveProfile();
      if (pending) begin(pending); else { game.running = false; hideOverlays(); showHome(); }
    }
    $('coach-btn').addEventListener('click', endTutorial);
    $('coach-skip').addEventListener('click', endTutorial);

    /* ---------- 触控（支持多指：涮菜时另一根手指可以挡筷子） ---------- */
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    var dragId = null;
    tray.addEventListener('pointerdown', function (e) {
      var p = e.target.closest ? e.target.closest('.plate') : null;
      if (!p || !game || !game.running || dragId !== null) return;
      e.preventDefault();
      audio.unlock();
      var q = pos(e); game.dragStart(p.getAttribute('data-food'), q.x, q.y);
      dragId = e.pointerId;
      p.classList.add('pressed'); setTimeout(function () { p.classList.remove('pressed'); }, 160);
    });
    window.addEventListener('pointermove', function (e) {
      if (game && e.pointerId === dragId) { var p = pos(e); game.dragMove(p.x, p.y); }
    });
    function endDrag(e) { if (game && e.pointerId === dragId) { dragId = null; game.dragEnd(); } }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerdown', function (e) {
      if (!game || e.pointerId === dragId || game.drag) return;
      audio.unlock();
      var p = pos(e); game.pointerDown(p.x, p.y);
    });

    $('btn-hint').addEventListener('click', function () {
      game.hints = !game.hints; this.classList.toggle('off', !game.hints);
      $('pro').classList.toggle('show', !game.hints);
    });
    $('btn-sound').addEventListener('click', function () {
      audio.unlock(); this.classList.toggle('off', !audio.toggle());
    });
    $('btn-toast').addEventListener('click', function (e) { e.stopPropagation(); game.toast(); });

    /* ---------- 开局 / 结算 ---------- */
    function hideOverlays() {
      ['home', 'shop', 'codex', 'result'].forEach(function (id) { $(id).classList.add('hidden'); });
      $('event').className = 'event'; $('combo').className = 'combo'; $('score').textContent = '0';
    }
    /* 第一次玩先进教学，教完自动开始选好的那一局 */
    function begin(opt) {
      if (!profile.tutorialDone) { pending = opt; startTutorial(); return; }
      startRound(opt);
    }
    function startRound(opt) {
      audio.unlock(); hideOverlays(); pending = null;
      current = opt;
      var S = HP.SCENES[opt.scene], D = opt.daily ? HP.dailySetup(HP.dayKey()) : null;
      buildTray(D ? D.menu : HP.getLoadout(profile));
      $('hud-scene').textContent = D ? '今日火锅' : S.name;
      $('hud-sub').textContent = D ? HP.dayLabel(HP.dayKey()) + ' · 九宫格' : '九宫格 · 川渝';
      layout();
      game.mode = 'play';
      game.setup({ scene: D ? D.scene : opt.scene, seed: D ? D.seed : 0 });
      game.reset(); game.running = true;
      if (S.bossFirst && !D) hooks.onEvent('wait', WAIT, true);
    }
    function startTutorial() {
      audio.unlock(); hideOverlays();
      buildTray(['beef', 'maodu', 'luncheon', 'potato', 'duckblood', 'shrimp']);
      $('hud-scene').textContent = '新手教学'; $('hud-sub').textContent = '九宫格 · 川渝';
      layout();
      game.setup({ scene: 'bros', seed: 0 });
      tutorial.start();
    }
    $('btn-again').addEventListener('click', function () { startRound(current || { scene: 'bros', daily: false }); });
    $('btn-home').addEventListener('click', function () { hideOverlays(); showHome(); });

    function finishRound(s) {
      var ctx = { scene: current.scene, daily: !!current.daily };
      var sceneId = current.daily ? 'bros' : current.scene;
      var r = HP.settle(profile, s, ctx);
      saveProfile();
      var p = HP.persona(s, sceneId);
      var label = current.daily ? '今日火锅 · ' + HP.dayLabel(HP.dayKey()) : HP.SCENES[current.scene].name + ' · 九宫格';
      cardUrl = HP.renderCard(images, s, p, { date: today(), scene: label, isBest: r.isBest, title: HP.titleOf(profile) });
      $('r-img').src = cardUrl;
      $('save-tip').textContent = '';
      // 奖励明细
      var rw = $('rewards'); rw.innerHTML = '';
      rw.appendChild(el('div', 'rw-total', '<i class="coin"></i>+' + r.coins + ' 金币<small>共 ' + profile.coins + '</small>'));
      r.lines.forEach(function (l) { rw.appendChild(el('div', 'rw-line', '<span>' + l[0] + '</span><b>+' + l[1] + '</b>')); });
      if (r.titleUp) rw.appendChild(el('div', 'rw-up', '称号升级：' + r.titleUp));
      if (r.streakUp) rw.appendChild(el('div', 'rw-line', '<span>连续打卡</span><b>' + profile.streak.n + ' 天</b>'));
      $('btn-share').classList.toggle('hidden', !P.canShare);
      $('result').classList.remove('hidden');
      if (r.ach.length && audio) audio.clink();
    }

    /* 保存：小红书里直接存相册；浏览器预览里提示长按图片保存 */
    $('btn-save').addEventListener('click', function () {
      if (!cardUrl) return;
      P.saveImage(cardUrl).then(function () {
        msg('已保存到相册，去发笔记吧');
      }).catch(function (e) {
        if (e && e.message === 'browser') $('save-tip').textContent = '长按上面的图片即可保存';
        else msg('保存失败，请检查相册权限');
      });
    });
    $('btn-share').addEventListener('click', function () {
      P.share(cardUrl).catch(function (e) {
        var code = e && (e.errCode || e.code);
        msg(code === 15503 ? '今天分享次数用完啦' : '暂时无法分享，可以先保存图片');
      });
    });

    /* ---------- 主循环（低端机自动降特效） ---------- */
    var last = 0, slow = 0;
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      if (dt > 0.024) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
      if (slow > 2 && game.fx.quality > 0.6) game.fx.quality = 0.6;
      game.update(dt);
      game.render();
      if (game.running) {
        var tl = game.mode === 'tutorial' ? HP.ROUND_TIME : game.timeLeft;
        $('time').textContent = fmt(tl);
        $('ring').style.strokeDashoffset = (113 * (1 - tl / HP.ROUND_TIME)).toFixed(1);
        $('timer').classList.toggle('urgent', game.mode === 'play' && tl <= 10);
      }
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', function () { last = 0; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
