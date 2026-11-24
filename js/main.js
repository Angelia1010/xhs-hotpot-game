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
    // 可选素材（同桌头像）：有就用，没有就画简笔脸
    HP.ASSETS.optional.forEach(function (n) { jobs.push(['scene', n, 'img/scene/' + n + '.webp', null, true]); });
    total = jobs.length;
    return Promise.all(jobs.map(function (j) {
      return loadImage(j[2]).catch(function (e) { if (j[4]) return null; throw e; }).then(function (im) {
        if (!im) { done++; onProgress(done / total); return; }
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

    /* 只提示一次：不挡操作，几秒后自动消失 */
    var tipTimer = null;
    function tipOnce(key, text) {
      if (!text || profile.seen[key]) return;
      profile.seen[key] = 1; saveProfile();
      var t = $('tip'); t.innerHTML = text; t.className = 'tip show';
      clearTimeout(tipTimer); tipTimer = setTimeout(function () { t.className = 'tip'; }, 3200);
    }
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
      onAction: function (name, d) {
        if (tutorial && game.mode === 'tutorial') { tutorial.onAction(name, d); return; }
        if ((name === 'drop' || name === 'holdEnter') && HP.FOODS[d.type].tip) tipOnce('food_' + d.type, HP.FOODS[d.type].tip);
      },
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
        p.appendChild(el('span', null, F.name + '<i class="pr">¥' + F.price + '</i>'));
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
      $('tools').style.top = (hudH + 2) + 'px';
      $('goal').style.top = (hudH + 4) + 'px';
      var toolsH = $('tools').offsetHeight + 4;
      $('event').style.bottom = (trayH - 30) + 'px';
      $('coach').style.bottom = (trayH + 6) + 'px';
      game.layout(w, h, hudH + 6 + toolsH, h - trayH - 4);
    }
    window.addEventListener('resize', function () { if (game) layout(); });

    /* ---------- 首页 ---------- */
    function showHome() {
      var day = HP.dayKey(), D = HP.dailySetup(day);
      $('h-title').textContent = HP.titleOf(profile);
      $('h-coins').textContent = profile.coins;
      $('h-ver').textContent = 'v' + HP.VERSION + (profile.rulesReset ? ' · 计分规则已更新，最高分重新计算' : '');
      if (profile.rulesReset) { profile.rulesReset = false; saveProfile(); }
      var yest = HP.dayKey(new Date(Date.now() - 864e5));
      var alive = profile.streak.last === day || profile.streak.last === yest;
      $('h-streak').textContent = alive && profile.streak.n ? '连续 ' + profile.streak.n + ' 天' : '今天还没吃';
      var dcard = HP.pickCard(D.scene, null, HP.rng(D.seed + 7));
      $('d-date').textContent = HP.issueOf(day) + ' · ' + HP.SCENES[D.scene].name + (dcard ? ' · ' + dcard.name : '');
      $('d-bonus').style.display = profile.lastPlayDay === day ? 'none' : '';
      var dm = $('d-menu'); dm.innerHTML = '';
      D.menu.forEach(function (id) {
        var it = el('div', 'd-item'), im = el('img'); im.src = plateSrc(id); im.alt = HP.FOODS[id].name;
        it.appendChild(im); it.appendChild(el('small', null, HP.FOODS[id].name)); dm.appendChild(it);
      });
      var dd = profile.daily.day === day ? profile.daily : null;
      $('d-best').textContent = dd && dd.plays ? '今日成绩 ' + dd.best + ' 分' + (dd.stars ? ' ' + '★★★'.slice(0, dd.stars) : '') + ' · 再吃算练习' : '所有人今天吃同一锅、同一张饭局卡，只有第一局算成绩';

      var sc = $('scenes'); sc.innerHTML = '';
      HP.SCENE_ORDER.forEach(function (id) {
        var S = HP.SCENES[id], ok = HP.sceneUnlocked(profile, id), b = el('button', 'scene-card' + (ok ? '' : ' locked'));
        b.type = 'button'; b.setAttribute('data-scene', id);
        var best = profile.bestBy[id];
        b.innerHTML = '<b>' + S.name + '</b><small>' + (ok ? S.desc : '再玩 ' + (S.unlockGames - profile.games) + ' 局解锁') + '</small>' +
          '<em>' + (ok ? (profile.stars[id] ? '<span class="stars">' + '★★★'.slice(0, profile.stars[id]) + '☆☆☆'.slice(0, 3 - profile.stars[id]) + '</span>' : (best ? '最高 ' + best : '开吃')) : '未解锁') + '</em>';
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
    $('btn-daily').addEventListener('click', function () { begin({ scene: HP.dailySetup(HP.dayKey()).scene, daily: true }); });
    $('btn-tutorial').addEventListener('click', function () { pending = null; startTutorial(); });
    $('btn-howto').addEventListener('click', function () { $('home').classList.add('hidden'); $('howto').classList.remove('hidden'); });

    /* ---------- 商店：解锁菜品、选上桌的菜 ---------- */
    function showShop() {
      $('s-coins').textContent = profile.coins;
      var lo = HP.getLoadout(profile);
      $('s-count').textContent = lo.length;
      var list = $('s-list'); list.innerHTML = '';
      var lastVeg = null;
      HP.FOOD_ORDER.forEach(function (id) {
        var F = HP.FOODS[id], have = profile.unlocked.indexOf(id) >= 0, on = lo.indexOf(id) >= 0;
        if (!!F.veg !== lastVeg) { lastVeg = !!F.veg; list.appendChild(el('div', 's-head', F.veg ? '素菜' : '荤菜')); }
        var it = el('div', 's-item' + (have ? (on ? ' on' : '') : ' locked'));
        it.setAttribute('data-food', id);
        var im = el('img'); im.src = plateSrc(id); im.alt = F.name; it.appendChild(im);
        it.appendChild(el('b', null, F.name + ' <em class="tag ' + F.mode + '">' + (F.mode === 'swish' ? '涮' : '煮') + '</em>'));
        var dex = profile.perfectBy[id] || 0, badge = HP.badgeOf(dex);
        it.appendChild(el('small', null, have ? (badge ? badge.name + ' · ' : '') + '完美 ' + dex + ' 次' : (F.special ? '梗菜 · ' : '') + '用金币解锁'));
        it.appendChild(el('span', 'state', have ? (on ? '已上桌' : '未上桌') : '<i class="coin"></i>' + F.unlock));
        list.appendChild(it);
      });
      list.appendChild(el('div', 's-head', '锅底'));
      HP.POT_ORDER.forEach(function (id) {
        var P = HP.POTS[id], have = profile.pots.indexOf(id) >= 0, on = profile.pot === id;
        var it = el('div', 's-item pot' + (have ? (on ? ' on' : '') : ' locked'));
        it.setAttribute('data-pot', id);
        var im = el('img'); im.src = 'img/scene/' + P.img + '.webp'; im.alt = P.name; it.appendChild(im);
        it.appendChild(el('b', null, P.name));
        it.appendChild(el('small', null, id === 'yuanyang' ? '红汤快、清汤慢但分 ×1.3' : '九格火力各不同'));
        it.appendChild(el('span', 'state', have ? (on ? '使用中' : '换这个') : '<i class="coin"></i>' + P.unlock));
        list.appendChild(it);
      });
      $('home').classList.add('hidden'); $('shop').classList.remove('hidden');
    }
    $('btn-shop').addEventListener('click', showShop);
    $('s-list').addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.s-item') : null; if (!it) return;
      var id = it.getAttribute('data-food'), err;
      var pid = it.getAttribute('data-pot');
      if (pid) {
        var had = profile.pots.indexOf(pid) >= 0;
        err = HP.unlockPot(profile, pid);
        if (!err) { msg(had ? '换成了' + HP.POTS[pid].name : '解锁了' + HP.POTS[pid].name + '！'); if (!had && audio) audio.clink(); }
        else msg(err);
        saveProfile(); showShop(); $('h-coins').textContent = profile.coins;
        return;
      }
      if (profile.unlocked.indexOf(id) < 0) {
        err = HP.unlockFood(profile, id);
        if (!err) {
          msg(HP.getLoadout(profile).indexOf(id) >= 0 ? '解锁了 ' + HP.FOODS[id].name + '！已带上桌' : '解锁了 ' + HP.FOODS[id].name + '！桌上满了，先去掉一道再带它');
          if (audio) audio.clink();
        }
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
      var per = $('c-per'); per.innerHTML = ''; var pg = 0;
      HP.PERSONAS.forEach(function (x) {
        var n = profile.personas[x.id] || 0; if (n) pg++;
        per.appendChild(el('div', 'c-row ach' + (n ? ' done' : ''),
          '<div class="c-info"><b>' + (n ? x.name : '？？？') + ' <em class="badge r-' + x.rare + '">' + HP.RARE[x.rare] + '</em></b><small>' +
          (n ? x.line : '线索：' + (x.hint || '还没测出过')) + '</small></div><span class="state">' + (n ? '×' + n : '') + '</span>'));
      });
      document.querySelector('[data-tab="per"]').textContent = '饭局人格 ' + pg + '/' + HP.PERSONAS.length;
      var mom = $('c-mom'); mom.innerHTML = '';
      var bonds = el('div', 'bonds');
      HP.BOND_IDS.forEach(function (id) {
        var lv = HP.bondLevel(profile, id);
        bonds.appendChild(el('span', null, HP.DINERS[id].name + ' <i>' + '♥♥♥♥♥'.slice(0, lv) + '</i>' + '♡♡♡♡♡'.slice(0, 5 - lv)));
      });
      mom.appendChild(bonds);
      if (!profile.moments.length) mom.appendChild(el('div', 'c-row', '<div class="c-info"><small>吃完饭，同桌的人可能会发朋友圈。对 TA 越好，越容易看到</small></div>'));
      profile.moments.forEach(function (m) { mom.appendChild(momentEl(m, false)); });
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
      $('c-dex').classList.toggle('hidden', tab !== 'dex'); $('c-ach').classList.toggle('hidden', tab !== 'ach'); $('c-per').classList.toggle('hidden', tab !== 'per'); $('c-mom').classList.toggle('hidden', tab !== 'mom');
    });
    var closers = document.querySelectorAll('[data-close]');
    for (var ci = 0; ci < closers.length; ci++) closers[ci].addEventListener('click', function () {
      var id = this.getAttribute('data-close'); $(id).classList.add('hidden');
      if (id === 'pair') { $('result').classList.remove('hidden'); return; }
      showHome();
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
    var potId = null;   // 在锅里按住一块菜的那根手指：拖到同桌头像上就是夹给 TA
    canvas.addEventListener('pointerdown', function (e) {
      if (!game || e.pointerId === dragId || game.drag) return;
      audio.unlock();
      var p = pos(e); game.pointerDown(p.x, p.y);
      if (game.press && potId === null) potId = e.pointerId;
    });
    window.addEventListener('pointermove', function (e) {
      if (game && e.pointerId === potId) { var p = pos(e); game.pointerMove(p.x, p.y); }
    });
    function endPot(e) { if (game && e.pointerId === potId) { potId = null; game.pointerUp(); } }
    window.addEventListener('pointerup', endPot);
    window.addEventListener('pointercancel', endPot);

    /* 火候提示按钮：停电局里按钮锁住（提示本来就看不见），局后自动恢复玩家自己的设置 */
    function syncHintBtn() {
      var on = game.hintsOn(), dark = game.mode === 'play' && game.card && game.card.id === 'blackout' && game.running !== false;
      $('btn-hint').classList.toggle('off', !on); $('pro').classList.toggle('show', !on);
      $('btn-hint').classList.toggle('locked', !!dark);
    }
    $('btn-hint').addEventListener('click', function () {
      if (game.mode === 'play' && game.card && game.card.id === 'blackout' && game.running) { msg('停电了，火候提示看不见，只能靠菜上的小星星'); return; }
      game.hints = !game.hints; syncHintBtn();
    });
    $('btn-sound').addEventListener('click', function () {
      audio.unlock(); this.classList.toggle('off', !audio.toggle());
    });
    $('btn-toast').addEventListener('click', function (e) { e.stopPropagation(); game.toast(); });

    /* ---------- 开局 / 结算 ---------- */
    function hideTip() { clearTimeout(tipTimer); $('tip').className = 'tip'; }
    function hideOverlays() {
      hideTip();
      ['home', 'shop', 'codex', 'result', 'howto', 'intro', 'pair', 'flip'].forEach(function (id) { $(id).classList.add('hidden'); });
      $('event').className = 'event'; $('combo').className = 'combo'; $('score').textContent = '0';
    }
    /* 第一次玩先进教学，教完自动开始选好的那一局 */
    function begin(opt) {
      if (!profile.tutorialDone) { pending = opt; startTutorial(); return; }
      var S = HP.SCENES[opt.scene];
      if (!opt.daily && S.intro && !profile.seen['scene_' + opt.scene]) {
        profile.seen['scene_' + opt.scene] = 1; saveProfile();
        $('i-title').textContent = S.name;
        $('i-list').innerHTML = S.intro.map(function (t) { return '<li>' + t + '</li>'; }).join('');
        pending = opt;
        ['home', 'shop', 'codex', 'howto'].forEach(function (id) { $(id).classList.add('hidden'); });
        $('intro').classList.remove('hidden');
        return;
      }
      startRound(opt);
    }
    $('btn-intro').addEventListener('click', function () { var o = pending; pending = null; startRound(o); });
    function startRound(opt) {
      audio.unlock(); hideOverlays(); pending = null;
      current = opt;
      var S = HP.SCENES[opt.scene], D = opt.daily ? HP.dailySetup(HP.dayKey()) : null;
      var pot = D ? D.pot : profile.pot, sid = D ? D.scene : opt.scene;
      S = HP.SCENES[sid];
      // 饭局卡：每日一锅所有人同一张；托盘补上这张卡要用的菜
      var card = D ? HP.pickCard(sid, null, HP.rng(D.seed + 7)) : HP.pickCard(sid, profile);
      var tray = (D ? D.menu : HP.getLoadout(profile)).slice();
      if (card && card.extraTray) card.extraTray.forEach(function (id) {
        if (tray.indexOf(id) >= 0) return;
        if (tray.length >= 8) { for (var k = tray.length - 1; k >= 0; k--) if (card.extraTray.indexOf(tray[k]) < 0) { tray.splice(k, 1); break; } }
        tray.push(id);
      });
      buildTray(tray);
      $('hud-scene').textContent = D ? '今日火锅' : S.name;
      $('hud-sub').textContent = (D ? S.name + ' · ' : '') + HP.POTS[pot].name;
      layout();
      game.mode = 'play';
      game.setup({ scene: sid, seed: D ? D.seed : 0, pot: pot, menu: tray, card: card });
      current.pot = pot; current.sid = sid; current.card = card ? card.id : null;
      current.practice = !!(D && profile.daily.day === HP.dayKey() && profile.daily.plays > 0);
      if (D) $('hud-sub').textContent = HP.issueOf(HP.dayKey()) + (current.practice ? ' · 练习' : '') + ' · ' + S.name;
      game.reset();
      // 停电：火候提示看不见
      if (card) showFlip(card, function () { game.running = true; syncHintBtn(); }); else { game.running = true; syncHintBtn(); }
      if (S.bossFirst) hooks.onEvent('wait', WAIT, true);
      // 第一局开场在锅上标出火力；一人食飘一句提示
      if (!profile.seen['heat_' + pot]) { profile.seen['heat_' + pot] = 1; saveProfile(); game.heatLabels = 3.5; }
      if (!D) tipOnce('scene_' + opt.scene, S.tip);
      if (S.diners) tipOnce('serve', '同桌点的菜涮好后，<b>按住拖到 TA 头像上</b>就是夹给 TA');
    }
    /* 一条朋友圈 */
    function momentEl(m, fresh) {
      var box = el('div', 'mom'), D = HP.DINERS[m.who] || {}, av = el('div', 'mom-av');
      var ai = images.scene['avatar_' + m.who + '_happy'] || images.scene['avatar_' + m.who + '_wait'];
      av.style.background = D.color || '#d98a3a';
      if (ai) { var im0 = el('img'); im0.src = ai.src; av.appendChild(im0); } else av.textContent = (m.name || '?').slice(-1);
      box.appendChild(av);
      var b = el('div', 'mom-body');
      b.appendChild(el('b', null, '')).textContent = m.name || D.name || '';
      if (m.lv) b.firstChild.appendChild(el('span', 'mom-tag', '羁绊 Lv' + m.lv));
      b.appendChild(el('p')).textContent = m.t;
      var mi = m.img && images.scene[m.img];
      if (mi) { var pic = el('img', 'mom-img'); pic.src = mi.src; b.appendChild(pic); }
      b.appendChild(el('div', 'mom-meta')).textContent = (fresh ? '刚刚' : HP.dayLabel(m.day)) + (m.scene ? ' · ' + m.scene : '');
      if ((m.likes && m.likes.length) || m.reply) {
        var lk = el('div', 'mom-like');
        lk.textContent = (m.likes && m.likes.length ? '♡ ' + m.likes.join('，') : '') + (m.reply ? (m.likes && m.likes.length ? '\n' : '') + m.reply.name + '：' + m.reply.t : '');
        lk.style.whiteSpace = 'pre-line'; b.appendChild(lk);
      }
      if (m.unlock) b.appendChild(el('div', 'mom-unlock')).textContent = m.unlock;
      box.appendChild(b);
      return box;
    }
    /* 饭搭子配对 */
    var lastPersona = null, pairUrl = null;
    $('btn-pair').addEventListener('click', function () {
      if (!lastPersona) return;
      var list = $('p-list'); list.innerHTML = '';
      HP.PERSONAS.forEach(function (x) {
        var b = el('button'); b.type = 'button'; b.textContent = x.name; b.setAttribute('data-p', x.id); list.appendChild(b);
      });
      $('p-img').classList.add('hidden'); $('p-save').classList.add('hidden'); list.classList.remove('hidden');
      $('result').classList.add('hidden'); $('pair').classList.remove('hidden');
    });
    $('p-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
      var other = HP.personaById(b.getAttribute('data-p'));
      pairUrl = HP.renderPairCard(images, lastPersona, other);
      $('p-img').src = pairUrl; $('p-img').classList.remove('hidden'); $('p-save').classList.remove('hidden');
      this.classList.add('hidden');
    });
    $('p-save').addEventListener('click', function () {
      if (!pairUrl) return;
      P.saveImage(pairUrl).then(function () { msg('已保存到相册'); }).catch(function (e) {
        msg(e && e.message === 'browser' ? '长按图片即可保存' : '保存失败，请检查相册权限');
      });
    });

    /* 开局翻卡：2.6 秒后自动开吃，点一下也可以 */
    var flipTimer = null, flipDone = null;
    function showFlip(card, done) {
      flipDone = done;
      $('flip-name').textContent = card.name; $('flip-rule').textContent = card.rule; $('flip-goal').textContent = card.goal;
      var art = $('flip-art'), im = images.scene['card_' + card.id];
      art.style.backgroundColor = card.color;
      art.style.backgroundImage = im ? 'url(' + im.src + ')' : 'none';
      art.textContent = im ? '' : card.name;
      $('flip').classList.remove('hidden');
      clearTimeout(flipTimer); flipTimer = setTimeout(closeFlip, 2600);
      audio.unlock(); if (audio.whoosh) audio.whoosh();
    }
    function closeFlip() {
      clearTimeout(flipTimer); $('flip').classList.add('hidden');
      var d = flipDone; flipDone = null; if (d) d();
    }
    $('flip').addEventListener('click', closeFlip);

    function startTutorial() {
      audio.unlock(); hideOverlays();
      buildTray(['beef', 'maodu', 'luncheon', 'potato', 'duckblood', 'shrimp']);
      $('hud-scene').textContent = '新手教学'; $('hud-sub').textContent = '九宫格';
      layout();
      game.setup({ scene: 'bros', seed: 0, pot: 'jiugong' });
      tutorial.start();
    }
    $('btn-again').addEventListener('click', function () { startRound(current || { scene: 'bros', daily: false }); });
    $('btn-home').addEventListener('click', function () { hideOverlays(); showHome(); });

    function finishRound(s) {
      hideTip(); $('event').className = 'event';
      if (!current) current = { scene: game.sceneId, daily: false, pot: game.potId };
      var sceneId = current.sid || current.scene;
      var ctx = { scene: sceneId, daily: !!current.daily, practice: !!current.practice };
      var card = current.card ? HP.cardById(current.card) : null;
      var stars = HP.starsOf(s, card); s.stars = stars.filter(Boolean).length;
      setTimeout(syncHintBtn, 0);
      var r = HP.settle(profile, s, ctx);
      var p = HP.persona(s);
      var near = HP.nearPersona(s, p, profile.personas);
      var meal = HP.afterMeal(profile, s, game.diners || [], HP.SCENES[sceneId].name);
      // 人格图鉴：第一次测出某个人格给金币
      var newP = !profile.personas[p.id];
      profile.personas[p.id] = (profile.personas[p.id] || 0) + 1;
      if (newP) { var pc = { N: 30, R: 60, SR: 120, SSR: 300 }[p.rare]; profile.coins += pc; r.coins += pc; r.lines.unshift(['新人格 · ' + p.name, pc]); }
      saveProfile();
      var label = (current.daily ? HP.issueOf(HP.dayKey()) + ' · ' : '') + HP.SCENES[sceneId].name;
      lastPersona = p;
      cardUrl = HP.renderCard(images, s, p, { date: today(), scene: label, card: card ? card.name : '', stars: s.stars, isBest: r.isBest, title: HP.titleOf(profile) });
      // 差一点就是另一个人格
      var nr = $('r-near');
      if (near) { nr.innerHTML = '差一点：' + near.text + '，你就是「' + near.p.name + '」'; nr.classList.remove('hidden'); }
      else nr.classList.add('hidden');
      // 饭后朋友圈
      var mm = $('r-moments'); mm.innerHTML = '';
      meal.posts.forEach(function (m) { mm.appendChild(momentEl(m, true)); });
      $('r-img').src = cardUrl;
      $('save-tip').textContent = '';
      // 奖励明细
      var rw = $('rewards'); rw.innerHTML = '';
      rw.appendChild(el('div', 'rw-total', '<i class="coin"></i>+' + r.coins + ' 金币<small>共 ' + profile.coins + '</small>'));
      rw.appendChild(el('div', 'rw-line', '<span>' + (card ? '饭局卡「' + card.name + '」' : '本局') + '</span><b class="stars">' +
        stars.map(function (x) { return x ? '★' : '☆'; }).join('') + '</b>'));
      rw.appendChild(el('div', 'rw-line', '<span style="opacity:.75">' + HP.STAR_TEXT.map(function (t, i) { return (stars[i] ? '✓' : '·') + t; }).join('　') + '</span><b></b>'));
      if (current.practice) rw.appendChild(el('div', 'rw-line', '<span>今日饭局只有第一局算成绩，这局是练习</span><b></b>'));
      r.lines.forEach(function (l) { rw.appendChild(el('div', 'rw-line', '<span>' + l[0] + '</span><b>+' + l[1] + '</b>')); });
      if (!profile.seen.coins) {
        profile.seen.coins = 1; saveProfile();
        rw.appendChild(el('div', 'rw-hint', '金币可以在首页「菜单 · 解锁」买新菜'));
      }
      var got = HP.PERSONAS.filter(function (x) { return profile.personas[x.id]; }).length;
      rw.appendChild(el('div', 'rw-line', '<span>饭局人格图鉴</span><b>' + got + ' / ' + HP.PERSONAS.length + '</b>'));
      (r.cardUp || []).forEach(function (c) { rw.appendChild(el('div', 'rw-up', '解锁新饭局卡：' + c.name)); });
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
    var last = 0, slow = 0, goalTick = 0;
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
      if (++goalTick % 8 === 0) {
        var gp = game.mode === 'play' && game.card && (game.running || !$('flip').classList.contains('hidden')) ? HP.cardProgress(game.card, game.stats) : null, ge = $('goal');
        if (gp) { var txt = (gp.done ? '✓ ' : '★ ') + gp.text; if (ge.textContent !== txt) ge.textContent = txt; ge.className = 'goal show' + (gp.done ? ' done' : ''); }
        else if (ge.className !== 'goal') ge.className = 'goal';
      }
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', function () { last = 0; if (!document.hidden && audio.ctx) audio.unlock(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
