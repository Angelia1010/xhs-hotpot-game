/* 启动：加载素材、搭界面、主循环；首页（火锅日记 / 今日火锅 / 饭局夜 / 翻台）、商店、图鉴、教学、
   饭局卡三选一、结算（纪录 / 下一个目标 / 丢分分析 / 发笔记 / 挑战码 / AI 锐评）、排行榜。 */
(function () {
  var HP = window.HP, P = HP.platform;
  var $ = function (id) { return document.getElementById(id); };
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  function visible(id) { var e = $(id); return !!e && !e.classList.contains('hidden'); }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('素材加载失败：' + src)); };
      im.src = src;
    });
  }
  /* 素材分两批：开局要用的先加载，首页才出来；饭局卡插画、朋友圈配图、结算卡背景放到后台慢慢加载 */
  function isLater(n) { return n.indexOf('card_') === 0 || n.indexOf('moment_') === 0 || n === 'pair_bg'; }
  function assetJobs() {
    var core = [], later = [];
    HP.ASSETS.scene.forEach(function (n) { (isLater(n) ? later : core).push(['scene', n, 'img/scene/' + n + '.webp', null, isLater(n)]); });
    HP.FOOD_ORDER.forEach(function (n) { for (var i = 0; i < 3; i++) core.push(['food', n, 'img/food/' + n + '_' + i + '.webp', i]); });
    // 可选素材（同桌头像等）：有就用，没有就画简笔脸
    HP.ASSETS.optional.forEach(function (n) { (isLater(n) ? later : core).push(['scene', n, 'img/scene/' + n + '.webp', null, true]); });
    return { core: core, later: later };
  }
  function loadJobs(jobs, images, onProgress) {
    var done = 0, total = jobs.length;
    HP.FOOD_ORDER.forEach(function (n) { if (!images.food[n]) images.food[n] = []; });
    return Promise.all(jobs.map(function (j) {
      return loadImage(j[2]).catch(function (e) { if (j[4]) return null; throw e; }).then(function (im) {
        if (im) { if (j[0] === 'food') images.food[j[1]][j[3]] = im; else images[j[0]][j[1]] = im; }
        done++; if (onProgress) onProgress(done / total);
      });
    })).then(function () { return images; });
  }

  function fmt(t) { var s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtUp(t) { var s = Math.max(0, Math.floor(t)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function today() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function plateSrc(id) { return 'img/plate/' + id + '.webp'; }
  function stars3(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  function init() {
    var canvas = $('cv'), app = $('app'), tray = $('plates'), hud = $('hud');
    var audio = new HP.Audio(), game = null, tutorial, images = { scene: {}, food: {} };
    var profile = HP.newProfile();
    var insets = { top: 0, bottom: 0 };
    var cardUrl = null, msgTimer = null, current = null, pending = null, night = null, lastCode = null, lastNote = null;
    var jobs = assetJobs();

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
    var hooks = {
      onScore: function (s) {
        $('score').textContent = s.score;
        var c = $('combo');
        if (s.combo >= 2) { c.textContent = s.combo + ' 连击'; c.className = 'combo show'; }
        else c.className = 'combo';
        updateRec();
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
      haptic: function (kind) { P.vibrate(VIB[kind] || 'light'); },
      onStrike: function () { updateHud(); }
    };

    /* ---------- 启动：存档 + 安全区 + 核心素材；失败可重试 ---------- */
    function boot() {
      hide('btn-retry'); $('loadtext').textContent = '正在烧锅底…';
      Promise.all([
        P.load('profile').then(function (p) { profile = HP.migrateProfile(p); }),
        P.getInsets().then(function (r) { if (r) insets = r; })
      ]).then(function () {
        return loadJobs(jobs.core, images, function (p) { $('loadbar').style.width = Math.round(p * 100) + '%'; });
      }).then(function () {
        if (!game) {
          game = new HP.Game(canvas, images, hooks);
          game.audio = audio;
          HP.game = game; HP.profile = function () { return profile; }; // 方便调试和自动化测试
          tutorial = new HP.Tutorial(game, coachUI);
          requestAnimationFrame(loop);
        }
        buildTray(HP.getLoadout(profile));
        layout();
        hide('loading');
        showHome();
        // 首页出来以后再在后台加载结算要用的图
        setTimeout(function () { loadJobs(jobs.later, images).then(function () { HP.lateReady = true; }); }, 300);
      }).catch(function (e) { $('loadtext').textContent = (e && e.message) || '加载失败'; show('btn-retry'); });
    }
    $('btn-retry').addEventListener('click', boot);
    boot();

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
        var sp = F.special ? HP.SPECIAL[F.special] : HP.dipsOf(id);
        if (sp) p.appendChild(el('em', 'tag sp', sp));
        tray.appendChild(p);
      });
    }
    /* 这一天还没学的机制，对应的菜先不上桌（涮的、要上下提放的） */
    function okByRules(id, rules) {
      var F = HP.FOODS[id];
      if (rules.swish === false && F.mode === 'swish') return false;
      if (rules.dips === false && F.dips) return false;
      return true;
    }
    function trayFor(ids, rules) {
      var out = ids.filter(function (id) { return okByRules(id, rules); });
      if (out.length < 4) HP.FOOD_ORDER.forEach(function (id) {
        if (out.length < 6 && out.indexOf(id) < 0 && profile.unlocked.indexOf(id) >= 0 && okByRules(id, rules)) out.push(id);
      });
      return out;
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
      if (game) game.layout(w, h, hudH + 6 + toolsH, h - trayH - 4);
    }
    window.addEventListener('resize', function () { if (game) layout(); });

    /* ---------- 首页 ---------- */
    function diaryTarget() {
      var D = HP.dayCfg(profile.day), m = D.modes || [], sc = D.scenes || [];
      if (m.indexOf('night') >= 0) return { kind: 'night' };
      if (m.indexOf('rush') >= 0) return { kind: 'scene', scene: 'rush' };
      if (sc.length) return { kind: 'scene', scene: sc[sc.length - 1] };
      return { kind: 'scene', scene: profile.day >= HP.unlockDay('team') && profile.day % 2 === 0 ? 'team' : 'bros' };
    }
    function showHome() {
      var day = HP.dayKey(), D = HP.dailySetup(day), today0 = day;
      $('h-title').textContent = HP.titleOf(profile);
      $('h-coins').textContent = profile.coins;
      $('h-ver').textContent = 'v' + HP.VERSION + (profile.rulesReset ? ' · 计分规则已更新，最高分重新计算' : '');
      if (profile.rulesReset) { profile.rulesReset = false; saveProfile(); }
      var yest = HP.dayKey(new Date(Date.now() - 864e5));
      var alive = profile.streak.last === day || profile.streak.last === yest;
      $('h-streak').textContent = (alive && profile.streak.n ? '🔥 连续 ' + profile.streak.n + ' 天' : '今天还没吃') + (profile.freeze ? ' · 补签卡×' + profile.freeze : '');
      $('h-warn').classList.toggle('hidden', !(P.inXhs && !P.canSave));

      // 火锅日记
      var dn = profile.day, Dy = HP.dayCfg(dn), done = dn >= HP.DAY_MAX && profile.seen['dayintro_' + HP.DAY_MAX];
      var capped = profile.dayLog && profile.dayLog.date === today0 && profile.dayLog.n >= HP.DAY_CAP && dn < HP.DAY_MAX;
      $('dy-n').textContent = '第 ' + dn + ' / ' + HP.DAY_MAX + ' 天';
      $('dy-text').innerHTML = done ? '日记写完了！所有剧本和玩法都开放了。冲纪录、收集人格、发挑战码吧'
        : capped ? '今天写满了 ' + HP.DAY_CAP + ' 天，明天解锁第 ' + dn + ' 天：<b>' + Dy.title + '</b>。今天还能随便吃'
        : '<b>' + Dy.title + '</b>：' + Dy.learn + '。拿到 2 颗星翻到下一天';
      $('dy-cap').classList.toggle('hidden', !capped);
      $('dy-bar').style.width = Math.round((dn - 1) / (HP.DAY_MAX - 1) * 100) + '%';

      // 今日火锅
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
      var dg = $('d-grid');
      if (dd && dd.plays && dd.log) { dg.textContent = HP.gridOf(dd.log, 16); dg.classList.remove('hidden'); } else dg.classList.add('hidden');
      var dl = $('d-lock'), dOpen = HP.modeOpen(profile, 'daily');
      dl.classList.toggle('hidden', dOpen);
      if (!dOpen) dl.textContent = '火锅日记第 ' + HP.modeDay.daily + ' 天开放：所有人吃同一锅比分';

      // 饭局夜 / 翻台挑战
      [['night', 'btn-night', 'm-night'], ['rush', 'btn-rush', 'm-rush']].forEach(function (x) {
        var ok = HP.modeOpen(profile, x[0]), b = profile.bestBy[x[0]];
        $(x[1]).classList.toggle('locked', !ok);
        $(x[2]).textContent = ok ? (b ? '最高 ' + b : '开吃') : '日记第 ' + HP.modeDay[x[0]] + ' 天解锁';
      });

      // 剧本
      var sc = $('scenes'); sc.innerHTML = '';
      HP.SCENE_ORDER.forEach(function (id) {
        if (id === 'rush') return;
        var S = HP.SCENES[id], ok = HP.sceneUnlocked(profile, id), b = el('button', 'scene-card' + (ok ? '' : ' locked'));
        b.type = 'button'; b.setAttribute('data-scene', id);
        var best = profile.bestBy[id];
        b.innerHTML = '<b>' + S.name + '</b><small>' + (ok ? S.desc : '火锅日记第 ' + HP.unlockDay(id) + ' 天解锁') + '</small>' +
          '<em>' + (ok ? (profile.stars[id] ? '<span class="stars">' + stars3(profile.stars[id]) + '</span>' : (best ? '最高 ' + best : '开吃')) : '未解锁') + '</em>';
        sc.appendChild(b);
      });
      $('btn-rank').classList.toggle('hidden', !P.rankOk);
      show('home');
    }
    $('scenes').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.scene-card') : null; if (!b) return;
      var id = b.getAttribute('data-scene');
      if (!HP.sceneUnlocked(profile, id)) { msg('火锅日记第 ' + HP.unlockDay(id) + ' 天解锁'); return; }
      begin({ kind: 'scene', scene: id });
    });
    $('diary').addEventListener('click', function () { begin(diaryTarget()); });
    $('btn-daily').addEventListener('click', function () {
      if (!HP.modeOpen(profile, 'daily')) { msg('火锅日记第 ' + HP.modeDay.daily + ' 天开放'); return; }
      begin({ kind: 'daily' });
    });
    $('btn-night').addEventListener('click', function () {
      if (!HP.modeOpen(profile, 'night')) { msg('火锅日记第 ' + HP.modeDay.night + ' 天解锁'); return; }
      night = null; begin({ kind: 'night' });
    });
    $('btn-rush').addEventListener('click', function () {
      if (!HP.modeOpen(profile, 'rush')) { msg('火锅日记第 ' + HP.modeDay.rush + ' 天解锁'); return; }
      begin({ kind: 'scene', scene: 'rush' });
    });
    $('btn-tutorial').addEventListener('click', function () { pending = null; startTutorial(null); });
    $('btn-howto').addEventListener('click', function () { hide('home'); show('howto'); });
    // 测试用：连点版本号 7 下，火锅日记全开
    var verTaps = 0, verT = 0;
    $('h-ver').addEventListener('click', function () {
      var now = Date.now(); verTaps = now - verT < 1500 ? verTaps + 1 : 1; verT = now;
      if (verTaps >= 7) { verTaps = 0; profile.day = HP.DAY_MAX; profile.tutorialDone = true; for (var i = 1; i <= HP.DAY_MAX; i++) { profile.seen['lesson_' + i] = 1; profile.seen['dayintro_' + i] = 1; } saveProfile(); msg('测试模式：火锅日记全开'); showHome(); }
    });

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
        var sp = F.special ? HP.SPECIAL[F.special] : HP.dipsOf(id);
        if (sp) it.appendChild(el('span', 'sp', sp));
        var dex = profile.perfectBy[id] || 0, badge = HP.badgeOf(dex);
        it.appendChild(el('small', null, have ? (badge ? badge.name + ' · ' : '') + '完美 ' + dex + ' 次' : (F.tip ? F.tip.replace(/<[^>]+>/g, '') : '用金币解锁')));
        it.appendChild(el('span', 'state', have ? (on ? '已上桌' : '未上桌') : '<i class="coin"></i>' + F.unlock));
        list.appendChild(it);
      });
      list.appendChild(el('div', 's-head', '锅底'));
      HP.POT_ORDER.forEach(function (id) {
        var P2 = HP.POTS[id], have = profile.pots.indexOf(id) >= 0, on = profile.pot === id;
        var it = el('div', 's-item pot' + (have ? (on ? ' on' : '') : ' locked'));
        it.setAttribute('data-pot', id);
        var im = el('img'); im.src = 'img/scene/' + P2.img + '.webp'; im.alt = P2.name; it.appendChild(im);
        it.appendChild(el('b', null, P2.name));
        it.appendChild(el('small', null, id === 'yuanyang' ? '红汤快、清汤慢但分 ×1.3' : '九格火力各不同'));
        it.appendChild(el('span', 'state', have ? (on ? '使用中' : '换这个') : '<i class="coin"></i>' + P2.unlock));
        list.appendChild(it);
      });
      hideOverlays(); show('shop');
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
      hideOverlays(); show('codex');
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
      var id = this.getAttribute('data-close'); hide(id);
      if (id === 'pair') { show('result'); return; }
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
      if (pending) { var o = pending; pending = null; begin(o); } else { game.running = false; hideOverlays(); showHome(); }
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
      var on = game.hintsOn(), dark = game.has('blackout') && game.running;
      $('btn-hint').classList.toggle('off', !on); $('pro').classList.toggle('show', !on);
      $('btn-hint').classList.toggle('locked', !!dark);
    }
    $('btn-hint').addEventListener('click', function () {
      if (game.has('blackout') && game.running) { msg('停电了，火候提示看不见，只能靠菜上的小星星'); return; }
      game.hints = !game.hints; syncHintBtn();
    });
    $('btn-sound').addEventListener('click', function () {
      audio.unlock(); this.classList.toggle('off', !audio.toggle());
    });
    $('btn-toast').addEventListener('click', function (e) { e.stopPropagation(); game.toast(); });

    /* ---------- 开局 ---------- */
    function hideTip() { clearTimeout(tipTimer); $('tip').className = 'tip'; }
    function hideOverlays() {
      hideTip();
      ['home', 'shop', 'codex', 'result', 'howto', 'intro', 'pair', 'flip', 'choose', 'night', 'codebox', 'rank'].forEach(hide);
      $('event').className = 'event'; $('combo').className = 'combo'; $('score').textContent = '0';
    }
    function showIntro(sub, title, list, opt) {
      $('i-sub').textContent = sub; $('i-title').textContent = title;
      $('i-list').innerHTML = list.map(function (t) { return '<li>' + t + '</li>'; }).join('');
      pending = opt;
      ['home', 'shop', 'codex', 'howto', 'result', 'codebox'].forEach(hide);
      show('intro');
    }
    $('btn-intro').addEventListener('click', function () { var o = pending; pending = null; hide('intro'); prepare(o); });

    /* 开局前：当天的新机制先教（火锅日记），第一次玩的剧本先看说明 */
    function begin(opt) {
      var story = opt.kind === 'scene' || opt.kind === 'night', dn = profile.day, D = HP.dayCfg(dn);
      // 从挑战码 / 今日火锅直接进来、还没学过：先走完整教学
      if (!story && !profile.tutorialDone) {
        for (var i = 1; i <= 4; i++) profile.seen['lesson_' + i] = 1;
        saveProfile(); pending = opt; startTutorial(null); return;
      }
      if (story && D.lesson && !profile.seen['lesson_' + dn]) {
        profile.seen['lesson_' + dn] = 1; saveProfile();
        pending = opt;
        startTutorial(D.lesson, { title: '火锅日记 · 第 ' + dn + ' 天 · ' + D.title,
          text: D.learn + '<br>正式开吃拿到 <b>2 颗星</b>，日记就翻到下一天' });
        return;
      }
      if (story && !D.lesson && dn > 1 && !profile.seen['dayintro_' + dn]) {
        profile.seen['dayintro_' + dn] = 1; saveProfile();
        showIntro('火锅日记 · 第 ' + dn + ' 天', D.title, [D.learn, '拿到 <b>2 颗星</b>，日记翻到下一天'], opt);
        return;
      }
      var sid = opt.kind === 'scene' ? opt.scene : null, S = sid && HP.SCENES[sid];
      if (S && S.intro && !profile.seen['scene_' + sid]) {
        profile.seen['scene_' + sid] = 1; saveProfile();
        showIntro('第一次玩', S.name, S.intro, opt);
        return;
      }
      prepare(opt);
    }
    /* 饭局卡三选一（饭局夜里已经叠上的卡不会再出现，也不会抽到打架的卡） */
    function prepare(opt) {
      current = opt; hideOverlays();
      if (opt.kind === 'night') {
        if (!night) night = { idx: 0, cards: [], scores: [], logs: [], personas: [], total: 0, coins: 0 };
        opt.scene = HP.NIGHT[night.idx];
      }
      if ((opt.kind === 'scene' || opt.kind === 'night') && opt.scene !== 'rush' && HP.modeOpen(profile, 'cards')) {
        var taken = night && opt.kind === 'night' ? night.cards.map(function (c) { return c.id; }) : [];
        var picks = HP.pickCards(opt.scene, profile, 3, taken);
        if (picks.length) { chooseCard(picks, opt); return; }
      }
      startRound(opt, null);
    }
    function cardArt(box, card, h) {
      var im = images.scene['card_' + card.id];
      box.style.backgroundColor = card.color;
      box.style.backgroundImage = im ? 'url(' + im.src + ')' : 'none';
      box.textContent = im ? '' : card.name;
      if (h) box.style.height = h;
    }
    function chooseCard(picks, opt) {
      var list = $('ch-list'); list.innerHTML = '';
      var S = HP.SCENES[opt.scene];
      $('ch-sub').textContent = opt.kind === 'night' ? '饭局夜 · 第 ' + (night.idx + 1) + ' 桌 · ' + S.name + ' · 挑一张' : S.name + ' · 挑一张饭局卡';
      var st = $('ch-stack');
      if (opt.kind === 'night' && night.cards.length) { st.innerHTML = '一直生效：<b>' + night.cards.map(function (c) { return c.name; }).join('、') + '</b>'; st.classList.remove('hidden'); }
      else st.classList.add('hidden');
      picks.forEach(function (c) {
        var b = el('button', 'ch-card'); b.type = 'button'; b.setAttribute('data-card', c.id);
        var art = el('span', 'ch-art'); cardArt(art, c); b.appendChild(art);
        b.appendChild(el('b')).textContent = c.name;
        b.appendChild(el('span')).textContent = c.rule;
        b.appendChild(el('em')).textContent = '★ ' + c.goal;
        list.appendChild(b);
      });
      show('choose');
      audio.unlock(); if (audio.whoosh) audio.whoosh();
    }
    $('ch-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ch-card') : null; if (!b) return;
      var c = HP.cardById(b.getAttribute('data-card'));
      hide('choose'); startRound(current, c);
    });

    /* 开一局：按玩法决定种子、菜单、锅底、饭局卡和这一天开放的机制 */
    var WAIT_TEXT = '等领导先动筷…';
    function bestKeyOf(opt) { return opt.kind === 'daily' ? 'daily' : opt.kind === 'night' ? 'night' : opt.kind === 'challenge' ? null : opt.sid || opt.scene; }
    function startRound(opt, card) {
      audio.unlock(); hideOverlays(); pending = null; current = opt;
      var kind = opt.kind, rules = {}, seed = 0, pot = profile.pot, sid = opt.scene, menu, cards = [], flip = null;
      if (kind === 'daily' || (kind === 'challenge' && opt.issue)) {
        var dk = kind === 'daily' ? HP.dayKey() : HP.dayOfIssue(opt.issue), D = HP.dailySetup(dk);
        seed = D.seed; pot = D.pot; sid = D.scene; menu = D.menu;
        var dc = HP.pickCard(sid, null, HP.rng(D.seed + 7)); if (dc) cards = [dc];
        opt.issue = HP.issueNo(dk);
        opt.practice = kind === 'challenge' || (profile.daily.day === HP.dayKey() && profile.daily.plays > 0);
        flip = dc && !opt.replay ? dc : null;
      } else if (kind === 'challenge') {
        var C = HP.challengeSetup(opt.seed, opt.scene, opt.pot);
        seed = C.seed; pot = C.pot; sid = C.scene; menu = C.menu; if (C.card) cards = [C.card];
        flip = C.card && !opt.replay ? C.card : null;
      } else {
        rules = HP.dayRules(profile);
        menu = HP.getLoadout(profile);
        if (kind === 'night') { if (card) night.cards.push(card); cards = night.cards.slice(); }
        else if (card) cards = [card];
      }
      opt.sid = sid; opt.pot = pot;
      // 托盘：这一天能用的菜 + 饭局卡要用的菜
      var t = trayFor(menu, rules);
      cards.forEach(function (K) {
        (K.extraTray || []).forEach(function (id) {
          if (t.indexOf(id) >= 0 || !okByRules(id, rules)) return;
          if (t.length >= 8) { for (var k = t.length - 1; k >= 0; k--) if ((K.extraTray || []).indexOf(t[k]) < 0) { t.splice(k, 1); break; } }
          t.push(id);
        });
      });
      buildTray(t);
      var S = HP.SCENES[sid];
      $('hud-scene').textContent = kind === 'daily' ? '今日火锅' : kind === 'challenge' ? '挑战' : kind === 'night' ? '饭局夜 ' + (night.idx + 1) + '/3' : S.name;
      $('hud-sub').textContent = (kind === 'daily' || opt.issue ? HP.issueOf(HP.dayOfIssue(opt.issue || HP.issueNo(HP.dayKey()))) + (opt.practice ? ' · 练习' : '') + ' · ' : kind === 'night' || kind === 'challenge' ? S.name + ' · ' : '') + HP.POTS[pot].name;
      layout();
      var best = kind === 'challenge' && opt.vs != null ? opt.vs : (profile.bestBy[bestKeyOf(opt)] || 0);
      game.mode = 'play';
      game.setup({ scene: sid, seed: seed, pot: pot, menu: t, cards: cards, rules: rules, best: best });
      game.reset();
      resetHud();
      var go = function () { game.running = true; syncHintBtn(); P.keepScreenOn(true); };
      if (flip) showFlip(flip, go); else go();
      if (S.bossFirst) hooks.onEvent('wait', { text: WAIT_TEXT, sub: '这 ' + S.bossFirst + ' 秒先别夹菜' }, true);
      // 第一局开场在锅上标出火力；一人食飘一句提示
      if (!profile.seen['heat_' + pot]) { profile.seen['heat_' + pot] = 1; saveProfile(); game.heatLabels = 3.5; }
      if (kind === 'scene') tipOnce('scene_' + sid, S.tip);
      if (S.diners) tipOnce('serve', '同桌点的菜涮好后，<b>按住拖到 TA 头像上</b>就是夹给 TA');
    }
    /* HUD：计时器、纪录线 */
    function resetHud() {
      $('score').textContent = '0'; $('combo').className = 'combo';
      $('timer').classList.remove('urgent'); $('timer').classList.toggle('lives', !!game.endless);
      $('time').textContent = game.endless ? '0:00' : fmt(HP.ROUND_TIME);
      $('ring').style.strokeDashoffset = '0';
      $('rec').classList.toggle('hidden', !game.best);
      updateRec();
    }
    function updateHud() {
      if (game.mode === 'tutorial') { $('time').textContent = fmt(HP.ROUND_TIME); return; }
      if (game.endless) {
        var left = HP.RUSH.strikes - game.stats.strikes;
        $('time').textContent = fmtUp(game.elapsed);
        $('ring').style.strokeDashoffset = (113 * (1 - left / HP.RUSH.strikes)).toFixed(1);
        $('timer').classList.toggle('urgent', left <= 1);
        return;
      }
      var tl = game.timeLeft;
      $('time').textContent = fmt(tl);
      $('ring').style.strokeDashoffset = (113 * (1 - tl / HP.ROUND_TIME)).toFixed(1);
      $('timer').classList.toggle('urgent', tl <= 10);
    }
    function updateRec() {
      var b = game && game.best, r = $('rec');
      if (!b || game.mode !== 'play') return;
      var sc = game.stats.score + (current && current.kind === 'night' && night ? night.total : 0);
      var vs = current && current.kind === 'challenge' && current.vs != null;
      $('rec-bar').style.width = Math.min(100, Math.round(sc / b * 100)) + '%';
      var close = !game.endless && game.timeLeft <= 10 && sc <= b && b - sc <= Math.max(200, b * 0.5);
      r.className = 'rec' + (sc > b ? ' beat' : close ? ' close' : '');
      $('rec-text').textContent = sc > b ? (vs ? '赢了对方 ✓' : '破纪录 ✓') : close ? '还差 ' + (b - sc + 1) + ' 分!' : (vs ? '对方 ' : '纪录 ') + b;
    }

    /* 开局翻卡（每日一锅 / 挑战局用固定的卡）：1.8 秒后自动开吃，点一下也可以 */
    var flipTimer = null, flipDone = null;
    function showFlip(card, done) {
      flipDone = done;
      $('flip-name').textContent = card.name; $('flip-rule').textContent = card.rule; $('flip-goal').textContent = card.goal;
      cardArt($('flip-art'), card);
      show('flip');
      clearTimeout(flipTimer); flipTimer = setTimeout(closeFlip, 1800);
      audio.unlock(); if (audio.whoosh) audio.whoosh();
    }
    function closeFlip() {
      clearTimeout(flipTimer); hide('flip');
      var d = flipDone; flipDone = null; if (d) d();
    }
    $('flip').addEventListener('click', closeFlip);

    function startTutorial(list, done) {
      audio.unlock(); hideOverlays();
      var L = list || HP.Tutorial.ALL, t = ['luncheon', 'potato', 'duckblood', 'shrimp'];
      if (L.indexOf(2) >= 0) t.unshift('maodu');
      if (L.indexOf(0) >= 0) t.unshift('beef');
      buildTray(t);
      $('hud-scene').textContent = done ? '火锅日记' : '新手教学'; $('hud-sub').textContent = '九宫格';
      layout();
      game.setup({ scene: 'bros', seed: 0, pot: 'jiugong' });
      tutorial.start(list, done);
      resetHud(); hide('rec');
    }

    /* ---------- 一条朋友圈 ---------- */
    function momentEl(m, fresh) {
      var box = el('div', 'mom'), D = HP.DINERS[m.who] || {}, av = el('div', 'mom-av');
      var ai = images.scene['avatar_' + m.who + '_happy'] || images.scene['avatar_' + m.who + '_wait'];
      av.style.background = D.color || '#d98a3a';
      if (ai) { var im0 = el('img'); im0.src = ai.src; av.appendChild(im0); } else av.textContent = (m.name || '?').slice(-1);
      box.appendChild(av);
      var b = el('div', 'mom-body');
      b.appendChild(el('b', null, '')).textContent = m.name || D.name || '';
      if (m.lv) b.firstChild.appendChild(el('span', 'mom-tag', '羁绊 Lv' + m.lv));
      if (m.story) b.firstChild.appendChild(el('span', 'mom-tag', '日记 · 第 ' + m.story + ' 天'));
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

    /* ---------- 饭搭子配对 ---------- */
    var lastPersona = null, pairUrl = null;
    $('btn-pair').addEventListener('click', function () {
      if (!lastPersona) return;
      var list = $('p-list'); list.innerHTML = '';
      HP.PERSONAS.forEach(function (x) {
        var b = el('button'); b.type = 'button'; b.textContent = x.name; b.setAttribute('data-p', x.id); list.appendChild(b);
      });
      hide('p-img'); hide('p-save'); list.classList.remove('hidden');
      hide('result'); show('pair');
    });
    $('p-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
      var other = HP.personaById(b.getAttribute('data-p'));
      pairUrl = HP.renderPairCard(images, lastPersona, other);
      $('p-img').src = pairUrl; show('p-img'); show('p-save');
      this.classList.add('hidden');
    });
    $('p-save').addEventListener('click', function () {
      if (!pairUrl) return;
      P.saveImage(pairUrl).then(function () { msg('已保存到相册'); }).catch(function (e) {
        msg(e && e.message === 'browser' ? '长按图片即可保存' : '保存失败，请检查相册权限');
      });
    });

    /* ---------- 一局结束 ---------- */
    var RARE_ORDER = { N: 1, R: 2, SR: 3, SSR: 4 };
    function labelOf(opt) {
      var S = HP.SCENES[opt.sid || opt.scene];
      if (opt.kind === 'daily') return HP.issueOf(HP.dayKey()) + ' · ' + S.name + (opt.practice ? ' · 练习' : '');
      if (opt.kind === 'challenge') return '挑战 · ' + (opt.issue ? HP.issueOf(HP.dayOfIssue(opt.issue)) + ' · ' : '') + S.name;
      if (opt.kind === 'night') return '饭局夜 · 朋友局→团建→家宴';
      return S.name;
    }
    function finishRound(s) {
      P.keepScreenOn(false);
      hideTip(); $('event').className = 'event';
      var opt = current || { kind: 'scene', scene: game.sceneId, sid: game.sceneId };
      var sid = opt.sid || game.sceneId, card = game.card;
      var stars = HP.starsOf(s, card); s.stars = stars.filter(Boolean).length;
      setTimeout(syncHintBtn, 0);
      var story = opt.kind === 'scene' || opt.kind === 'night';
      var r = HP.settle(profile, s, { scene: sid, daily: opt.kind === 'daily', practice: !!opt.practice, story: story,
                                      bestKey: opt.kind === 'night' || opt.kind === 'challenge' ? null : bestKeyOf(opt) });
      var p = HP.persona(s);
      var meal = HP.afterMeal(profile, s, game.diners || [], HP.SCENES[sid].name);
      // 人格图鉴：第一次测出某个人格给金币
      var newP = !profile.personas[p.id];
      profile.personas[p.id] = (profile.personas[p.id] || 0) + 1;
      if (newP) { var pc = { N: 30, R: 60, SR: 120, SSR: 300 }[p.rare]; profile.coins += pc; r.coins += pc; r.lines.unshift(['新人格 · ' + p.name, pc]); }

      // 饭局夜：前两桌只出中场小结，第三桌出整晚结算
      if (opt.kind === 'night') {
        night.scores.push(s.score); night.total += s.score; night.logs = night.logs.concat(s.log); night.personas.push(p); night.coins += r.coins;
        if (night.idx < HP.NIGHT.length - 1) { saveProfile(); showNightBreak(s, r, p); return; }
      }
      var total = opt.kind === 'night' ? night.total : s.score, prevBest = r.prevBest, isBest = r.isBest;
      if (opt.kind === 'night') {
        prevBest = profile.bestBy.night || 0;
        if (total > prevBest) { isBest = true; profile.bestBy.night = total; }
        // 一晚三个人格，取最稀有的那个上卡
        night.personas.forEach(function (x) { if (RARE_ORDER[x.rare] > RARE_ORDER[p.rare]) p = x; });
      }
      var near = HP.nearPersona(s, p, profile.personas);
      saveProfile();
      lastPersona = p;

      // 挑战码：今日火锅用期数，挑战局用种子；都带上这局的分数
      lastCode = null;
      if (opt.issue) lastCode = HP.encodeChallenge({ issue: opt.issue, score: total });
      else if (opt.kind === 'challenge') lastCode = HP.encodeChallenge({ seed: opt.seed, scene: sid, pot: opt.pot, score: total });

      var shown = Object.assign({}, s, { score: total, log: opt.kind === 'night' ? night.logs : s.log, stars: s.stars });
      cardUrl = HP.renderCard(images, shown, p, { date: today(), scene: labelOf(opt), card: card ? card.name : '', stars: s.stars, isBest: isBest, title: HP.titleOf(profile), code: lastCode });
      lastNote = HP.noteText({ persona: p.name, label: labelOf(opt), score: total, stars: s.stars, grid: HP.gridOf(shown.log), line: p.line, code: lastCode });

      // —— 顶部：分数、纪录、星 ——
      $('r-label').textContent = labelOf(opt) + (card ? ' · ' + card.name : '');
      $('r-score').textContent = total;
      var rec = $('r-rec');
      rec.className = 'r-rec' + (isBest ? ' best' : '');
      rec.textContent = opt.practice && opt.kind === 'daily' ? '练习局 · 今日正式成绩 ' + profile.daily.best + ' 分'
        : isBest ? (prevBest ? '新纪录！比上次多 ' + (total - prevBest) + ' 分' : '新纪录！')
        : prevBest ? '差 ' + (prevBest - total + 1) + ' 分破纪录（纪录 ' + prevBest + '）' : '';
      $('r-stars').innerHTML = stars.map(function (x) { return x ? '★' : '☆'; }).join('') +
        '<small>' + HP.STAR_TEXT.map(function (t, i) { return (stars[i] ? '✓' : '·') + t; }).join('　') + '</small>';
      // —— 挑战结果 ——
      var vs = $('r-vs');
      if (opt.kind === 'challenge' && opt.vs != null) {
        var win = total > opt.vs;
        vs.className = 'r-vs ' + (win ? 'win' : 'lose');
        vs.textContent = win ? '赢了！你 ' + total + ' vs 对方 ' + opt.vs + '，回敬一个挑战码吧' : '惜败：你 ' + total + ' vs 对方 ' + opt.vs + '，差 ' + (opt.vs - total + 1) + ' 分';
      } else vs.className = 'r-vs hidden';
      // —— 火锅日记 ——
      var dayBox = $('r-day'), Dn = HP.dayCfg(profile.day);
      if (r.dayUp) dayBox.innerHTML = '火锅日记翻到 <b>第 ' + r.dayUp + ' 天：' + Dn.title + '</b><br>' + Dn.learn;
      else if (r.dayCapped) dayBox.innerHTML = '今天的日记写满了 ' + HP.DAY_CAP + ' 天，<b>明天解锁第 ' + profile.day + ' 天：' + Dn.title + '</b>';
      else if (story && profile.day < HP.DAY_MAX) dayBox.innerHTML = '再多拿 <b>' + (HP.DAY_STARS - s.stars) + ' 颗星</b>，日记就翻到第 ' + (profile.day + 1) + ' 天：' + HP.dayCfg(profile.day + 1).title;
      else dayBox.innerHTML = '';
      dayBox.classList.toggle('hidden', !dayBox.innerHTML);
      // —— 下一个解锁 ——
      var ng = HP.nextGoal(profile), nb = $('r-next');
      if (ng) {
        nb.className = 'r-next' + (ng.ready ? ' ready' : '');
        $('r-next-text').textContent = ng.ready ? '金币够了！去解锁「' + ng.name + '」 →' : '再 ' + ng.left + ' 金币解锁「' + ng.name + '」';
        $('r-next-bar').style.width = Math.min(100, Math.round(ng.coins / ng.price * 100)) + '%';
      } else nb.className = 'r-next hidden';
      // —— 丢分分析 ——
      var loss = HP.lossReport(s), lb = $('r-loss');
      if (loss.length) {
        lb.innerHTML = '这局丢分最多：' + loss.map(function (x) { return '<b>' + x.name + ' −' + x.pts + '</b>'; }).join('、') +
          (loss[0].tip ? '<small>下次试试：' + loss[0].tip + '</small>' : '');
        lb.className = 'r-loss';
      } else lb.className = 'r-loss hidden';
      $('btn-challenge').textContent = lastCode ? '挑战码' : '挑战好友';

      // 差一点就是另一个人格
      var nr = $('r-near');
      if (near) { nr.innerHTML = '差一点：' + near.text + '，你就是「' + near.p.name + '」'; nr.classList.remove('hidden'); }
      else nr.classList.add('hidden');
      // 饭后朋友圈（火锅日记翻页的剧情排最前）
      var mm = $('r-moments'); mm.innerHTML = '';
      if (r.dayPost) mm.appendChild(momentEl(r.dayPost, true));
      meal.posts.forEach(function (m) { mm.appendChild(momentEl(m, true)); });
      $('r-img').src = cardUrl;
      $('save-tip').textContent = '';
      // 奖励明细
      var rw = $('rewards'); rw.innerHTML = '';
      var coinsGot = opt.kind === 'night' ? night.coins : r.coins;
      rw.appendChild(el('div', 'rw-total', '<i class="coin"></i>+' + coinsGot + ' 金币<small>共 ' + profile.coins + '</small>'));
      if (card) rw.appendChild(el('div', 'rw-line', '<span>饭局卡「' + card.name + '」</span><b class="stars">' + stars.map(function (x) { return x ? '★' : '☆'; }).join('') + '</b>'));
      if (opt.practice && opt.kind === 'daily') rw.appendChild(el('div', 'rw-line', '<span>今日饭局只有第一局算成绩，这局是练习</span><b></b>'));
      r.lines.forEach(function (l) { rw.appendChild(el('div', 'rw-line', '<span>' + l[0] + '</span><b>+' + l[1] + '</b>')); });
      if (r.freezeGot) rw.appendChild(el('div', 'rw-up', '今日火锅两星以上：送你一张补签卡'));
      if (r.freezeUsed) rw.appendChild(el('div', 'rw-up', '昨天没来，用了一张补签卡，连续打卡续上了'));
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
      $('btn-post').textContent = P.canPost ? '发笔记' : '发笔记';
      show('result');
      $('result').scrollTop = 0;
      if (r.ach.length && audio) audio.clink();

      // AI 锐评（内测能力，有才显示；每天最多 30 次）
      var ab = $('r-ai'), dkey = HP.dayKey();
      ab.className = 'r-ai hidden';
      if (P.aiOk) {
        if (!profile.ai || profile.ai.date !== dkey) profile.ai = { date: dkey, n: 0 };
        if (profile.ai.n < 30) {
          profile.ai.n++; saveProfile();
          ab.innerHTML = '<small>AI 锐评</small>正在想怎么损你……'; ab.className = 'r-ai';
          var stamp = cardUrl;
          P.ai(HP.aiMessages(shown, p, HP.SCENES[sid].name)).then(function (t) {
            if (cardUrl !== stamp) return;
            if (!t) { ab.className = 'r-ai hidden'; return; }
            ab.innerHTML = '<small>AI 锐评</small>'; ab.appendChild(document.createTextNode(t));
          });
        }
      }
      // 排行榜（内测能力）：今日火锅正式成绩、翻台挑战、阵营
      if (r.dailyFirst) P.submitScore(HP.BOARDS.daily, s.score);
      if (sid === 'rush' && opt.kind === 'scene') P.submitScore(HP.BOARDS.rush, s.score);
      if (profile.faction && (opt.kind === 'scene' || opt.kind === 'night') && HP.FACTIONS[profile.faction]) P.submitScore(HP.FACTIONS[profile.faction].board, total);
      if (opt.kind === 'night') night = null;
    }

    /* 饭局夜中场：这桌多少分、下一桌是谁 */
    function showNightBreak(s, r, p) {
      var nextScene = HP.SCENES[HP.NIGHT[night.idx + 1]];
      $('nt-sub').textContent = '饭局夜 · 第 ' + (night.idx + 1) + ' 桌结束';
      $('nt-score').textContent = '+' + s.score;
      $('nt-text').innerHTML = (r.dayUp ? '火锅日记翻到第 ' + r.dayUp + ' 天！<br>' : '') + '这桌你是「' + p.name + '」，金币 +' + r.coins +
        '<br>下一桌：<b>' + nextScene.name + '</b>，选过的 ' + night.cards.length + ' 张卡继续生效';
      var tb = $('nt-tables'); tb.innerHTML = '';
      HP.NIGHT.forEach(function (id, i) {
        var row = el('div', i === night.idx + 1 ? 'now' : '');
        row.appendChild(el('span')).textContent = '第 ' + (i + 1) + ' 桌 · ' + HP.SCENES[id].name;
        row.appendChild(el('b')).textContent = i < night.scores.length ? night.scores[i] + ' 分' : i === night.idx + 1 ? '下一桌' : '';
        tb.appendChild(row);
      });
      show('night');
    }
    $('btn-next-table').addEventListener('click', function () { hide('night'); night.idx++; prepare({ kind: 'night' }); });
    $('btn-night-quit').addEventListener('click', function () { night = null; hideOverlays(); showHome(); });

    /* ---------- 结算页按钮 ---------- */
    $('btn-again').addEventListener('click', function () {
      var o = current || { kind: 'scene', scene: 'bros' };
      if (o.kind === 'night') { night = null; prepare({ kind: 'night' }); return; }
      var n = { kind: o.kind, scene: o.scene, seed: o.seed, pot: o.pot, issue: o.issue, vs: o.vs, replay: true };
      if (o.kind === 'scene') begin(n); else prepare(n);
    });
    $('btn-home').addEventListener('click', function () { night = null; hideOverlays(); showHome(); });
    $('r-next').addEventListener('click', function () { var ng = HP.nextGoal(profile); if (ng && ng.ready) showShop(); });
    function post(note, images0) {
      if (!note) return;
      P.postNote({ title: note.title, content: note.content, images: images0 }).then(function () { msg('发布页打开了，去发笔记吧'); })
        .catch(function (e) {
          if (e && e.message === 'browser') { $('save-tip').textContent = '发笔记要在小红书里打开；先长按上面的图片保存'; msg('在小红书里打开才能直接发笔记'); }
          else if (e && e.message === 'unsupported') {
            P.saveImage(cardUrl).then(function () { msg('当前版本不能直接发，已存到相册'); }).catch(function () { msg('当前版本不能直接发笔记'); });
          } else msg('没能打开发布页，可以先保存图片');
        });
    }
    $('btn-post').addEventListener('click', function () { post(lastNote, [cardUrl]); });

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

    /* ---------- 挑战码 ---------- */
    var codeFrom = 'home';
    function openCode(mode, from) {
      codeFrom = from;
      ['cb-show', 'cb-input', 'cb-make'].forEach(hide);
      if (mode === 'show') {
        $('cb-title').textContent = '挑战码';
        $('cb-code').textContent = HP.prettyCode(lastCode);
        $('cb-text').innerHTML = '朋友在首页点「输入挑战码」，就能打<b>同一锅</b>：菜单、锅底、饭局卡、事件都和你一样。结算卡底部也印着这个码';
        show('cb-show');
      } else if (mode === 'input') {
        $('cb-title').textContent = '输入挑战码'; $('cb-err').textContent = ''; $('cb-field').value = '';
        show('cb-input');
      } else { $('cb-title').textContent = '挑战好友'; show('cb-make'); }
      hideOverlays(); show('codebox');
    }
    $('btn-code').addEventListener('click', function () { openCode('input', 'home'); });
    $('btn-challenge').addEventListener('click', function () { openCode(lastCode ? 'show' : 'make', 'result'); });
    $('cb-back').addEventListener('click', function () { hide('codebox'); if (codeFrom === 'result' && cardUrl) show('result'); else showHome(); });
    $('cb-post').addEventListener('click', function () { post(lastNote, [cardUrl]); });
    $('cb-go').addEventListener('click', function () {
      var c = HP.decodeChallenge($('cb-field').value);
      if (!c) { $('cb-err').textContent = '这个码不对，检查一下是不是 9 位'; return; }
      hide('codebox');
      if (c.kind === 'daily') begin({ kind: 'challenge', issue: c.issue, vs: c.score || null });
      else begin({ kind: 'challenge', seed: c.seed, scene: c.scene, pot: c.pot, vs: c.score || null });
    });
    $('cb-start').addEventListener('click', function () {
      var o = current || {}, sc = o.sid && HP.SCENES[o.sid] && o.kind !== 'night' ? o.sid : 'bros';
      hide('codebox');
      begin({ kind: 'challenge', seed: HP.newSeed(), scene: sc, pot: profile.pot });
    });

    /* ---------- 排行榜（内测） ---------- */
    var rkTab = 'daily';
    function rows(list, mine) {
      var box = document.createDocumentFragment();
      if (!list.length) box.appendChild(el('div', 'rk-note', '还没有人上榜，快来当第一个'));
      list.slice(0, 20).forEach(function (x) {
        var r = el('div', 'rk-row');
        r.appendChild(el('span', 'n')).textContent = x.rank;
        r.appendChild(el('span', 'who')).textContent = x.nickname || '神秘食客';
        r.appendChild(el('span', 'sc')).textContent = x.score;
        box.appendChild(r);
      });
      if (mine) {
        var m = el('div', 'rk-row me');
        m.appendChild(el('span', 'n')).textContent = mine.status === 'EXACT' ? mine.rank : mine.status === 'OVER_LIMIT' ? '500+' : '—';
        m.appendChild(el('span', 'who')).textContent = '我';
        m.appendChild(el('span', 'sc')).textContent = mine.status === 'EXACT' ? mine.score : mine.status === 'NO_SCORE' || mine.status === 'NOT_PARTICIPATING' ? '还没成绩' : '';
        box.appendChild(m);
      }
      return box;
    }
    function renderRank() {
      var body = $('rk-body'), tab = rkTab;
      body.innerHTML = '<div class="rk-note">加载中…</div>';
      $('rk-fac').textContent = profile.faction ? HP.FACTIONS[profile.faction].name : '未选阵营';
      var fail = function () { if (rkTab !== tab) return; body.innerHTML = '<div class="rk-note">排行榜暂时打不开' + (P.rankOk ? '，稍后再试' : '（内测能力未开放）') + '</div>'; if (!P.rankOk) hide('btn-rank'); };
      if (tab === 'fac') {
        if (!profile.faction) {
          body.innerHTML = '<div class="rk-note">选一个阵营：之后每局成绩都给你的阵营加分，每周一 0 点重置</div>';
          var pk = el('div', 'rk-pick');
          Object.keys(HP.FACTIONS).forEach(function (k) {
            var b = el('button', 'cta small'); b.type = 'button'; b.textContent = HP.FACTIONS[k].name; b.setAttribute('data-fac', k); pk.appendChild(b);
          });
          body.appendChild(pk);
          return;
        }
        var ks = Object.keys(HP.FACTIONS);
        Promise.all(ks.map(function (k) { return P.rankList(HP.FACTIONS[k].board, 'week'); })).then(function (lists) {
          if (rkTab !== tab) return;
          body.innerHTML = '';
          var vsb = el('div', 'rk-vs');
          ks.forEach(function (k, i) {
            var sum = lists[i].reduce(function (a, x) { return a + (x.score || 0); }, 0);
            var d = el('div'); d.style.color = HP.FACTIONS[k].color;
            d.appendChild(el('b')).textContent = sum;
            d.appendChild(el('small')).textContent = HP.FACTIONS[k].name + ' · 前 ' + lists[i].length + ' 人总分';
            vsb.appendChild(d);
          });
          body.appendChild(vsb);
          body.appendChild(el('div', 'rk-note', '本周' + HP.FACTIONS[profile.faction].name + '前 20'));
          body.appendChild(rows(lists[ks.indexOf(profile.faction)], null));
        }).catch(fail);
        return;
      }
      var board = HP.BOARDS[tab], period = tab === 'daily' ? 'day' : 'all';
      Promise.all([P.rankList(board, period), P.myRank(board, period).catch(function () { return null; })]).then(function (x) {
        if (rkTab !== tab) return;
        body.innerHTML = ''; body.appendChild(rows(x[0], x[1]));
      }).catch(fail);
    }
    $('btn-rank').addEventListener('click', function () { hideOverlays(); show('rank'); renderRank(); });
    $('rank').addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-rk]') : null;
      if (t) {
        rkTab = t.getAttribute('data-rk');
        var tabs = document.querySelectorAll('#rank .tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i] === t);
        renderRank(); return;
      }
      var f = e.target.closest ? e.target.closest('[data-fac]') : null;
      if (f) { profile.faction = f.getAttribute('data-fac'); saveProfile(); msg('加入了' + HP.FACTIONS[profile.faction].name); renderRank(); }
    });

    /* ---------- 主循环（低端机自动降特效；面板盖住时不画、首页降帧） ---------- */
    var last = 0, slow = 0, goalTick = 0, skip = 0, acc = 0;
    var COVER = ['result', 'shop', 'codex', 'howto', 'pair', 'codebox', 'rank', 'night'];
    function covered() { for (var i = 0; i < COVER.length; i++) if (visible(COVER[i])) return true; return false; }
    function loop(ts) {
      requestAnimationFrame(loop);
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      if (!game.running) {
        if (covered()) return;                         // 锅被面板挡住了，不更新也不画
        if (visible('home')) {                         // 首页只透出一点锅：20 帧就够
          acc += dt; if (++skip % 3) return;
          dt = Math.min(0.05, acc); acc = 0;
        }
      } else {
        if (dt > 0.024) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
        if (slow > 2 && game.fx.quality > 0.6) game.fx.quality = 0.6;
      }
      game.update(dt);
      game.render();
      if (game.running) updateHud();
      if (++goalTick % 8 === 0) {
        var ge = $('goal'), txt = null, done = false;
        if (game.mode === 'play' && game.endless && game.running) {
          var k = game.stats.strikes; txt = '离席 ' + '✗✗✗'.slice(0, k) + '○○○'.slice(0, HP.RUSH.strikes - k) + ' · 撑了 ' + fmtUp(game.elapsed);
        } else if (game.mode === 'play' && game.card && (game.running || visible('flip'))) {
          var gp = HP.cardProgress(game.card, game.stats);
          if (gp) { txt = (gp.done ? '✓ ' : '★ ') + gp.text; done = gp.done; }
        }
        if (txt) { if (ge.textContent !== txt) ge.textContent = txt; ge.className = 'goal show' + (done ? ' done' : ''); }
        else if (ge.className !== 'goal') ge.className = 'goal';
        if (game.running) updateRec();
      }
    }
    document.addEventListener('visibilitychange', function () {
      last = 0;
      if (document.hidden) audio.suspend(); else if (audio.ctx) audio.unlock();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
