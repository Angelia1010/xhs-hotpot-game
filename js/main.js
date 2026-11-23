/* 启动：加载素材、搭界面、主循环、教学、开始页和结算卡。 */
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

  function persona(s) {
    var ratio = s.eaten ? s.perfect / s.eaten : 0;
    if (s.eaten === 0) return ['光看不吃', '锅都快烧干了，你一口没动'];
    if (s.authentic >= 3) return ['七上八下大师', '重庆人看了都要给你递一瓶冰啤酒'];
    if (s.stolen >= 4) return ['被抢专业户', '老王说今天这顿吃得很满意'];
    if (ratio >= 0.7 && s.perfect >= 6) return ['毛肚刺客', '火候拿捏得比服务员还准'];
    if (s.blocked >= 3) return ['护食狂魔', '谁也别想从你锅里夹走一片肉'];
    if (s.raw >= 3) return ['生吃勇士', '你的肠胃正在给你打电话'];
    if (s.toastMiss >= 2) return ['领导的眼中钉', '吃得挺香，就是忘了看领导的杯子'];
    if (s.toastOk >= 2 && ratio >= 0.3) return ['饭局情商王', '涮得好，酒也敬得好'];
    if (s.over >= 4) return ['炖菜大师', '你是来吃火锅的还是来熬汤的'];
    if (ratio >= 0.4) return ['火锅老手', '有点东西，再练练就能出师'];
    return ['火锅新秀', '下次盯紧一点，别光顾着聊天'];
  }

  function init() {
    var canvas = $('cv'), app = $('app'), tray = $('plates'), hud = $('hud');
    var audio = new HP.Audio(), game, tutorial, images;
    var profile = { tutorialDone: false, best: 0, games: 0 };
    var insets = { top: 0, bottom: 0 };
    var cardUrl = null, msgTimer = null;

    function msg(text) {
      var el = $('msg'); el.textContent = text; el.className = 'msg show';
      clearTimeout(msgTimer); msgTimer = setTimeout(function () { el.className = 'msg'; }, 1800);
    }

    var VIB = { perfect: 'medium', block: 'heavy', dip: 'light', event: 'heavy', raw: 'light', ok: 'light', over: 'light' };
    var hooks = {
      onScore: function (s) {
        $('score').textContent = s.score;
        var c = $('combo');
        if (s.combo >= 2) { c.textContent = s.combo + ' 连击'; c.className = 'combo show'; }
        else c.className = 'combo';
      },
      onEnd: function (s) { finishRound(s); },
      onEvent: function (type, cfg, on) {
        var el = $('event');
        if (on) { $('event-text').textContent = cfg.text; $('event-sub').textContent = cfg.sub; el.className = 'event show ' + type; }
        else el.className = 'event';
      },
      onAction: function (name, d) { if (tutorial && game.mode === 'tutorial') tutorial.onAction(name, d); },
      haptic: function (kind) { P.vibrate(VIB[kind] || 'light'); }
    };

    /* ---------- 启动：存档 + 安全区 + 素材 ---------- */
    Promise.all([
      P.load('profile').then(function (p) { if (p) for (var k in p) if (p.hasOwnProperty(k)) profile[k] = p[k]; }),
      P.getInsets().then(function (r) { if (r) insets = r; })
    ]).then(function () {
      return loadAll(function (p) { $('loadbar').style.width = Math.round(p * 100) + '%'; });
    }).then(function (imgs) {
      images = imgs;
      game = new HP.Game(canvas, images, hooks);
      game.audio = audio;
      HP.game = game; // 方便调试
      tutorial = new HP.Tutorial(game, coachUI);
      buildTray();
      layout();
      $('loading').classList.add('hidden');
      showStart();
      requestAnimationFrame(loop);
    }).catch(function (e) { $('loadtext').textContent = e.message; });

    function saveProfile() { P.save('profile', profile); }

    function buildTray() {
      tray.innerHTML = '';
      HP.FOOD_ORDER.forEach(function (id) {
        var F = HP.FOODS[id], el = document.createElement('div');
        el.className = 'plate'; el.setAttribute('data-food', id); el.id = 'plate-' + id;
        var im = document.createElement('img'); im.alt = F.name; im.draggable = false;
        // 盘子图加载完托盘才有真实高度，此时重新排版，锅才会居中
        im.onload = function () { if (game) layout(); };
        im.src = 'img/plate/' + id + '.webp';
        var nm = document.createElement('span'); nm.textContent = F.name;
        var tg = document.createElement('em'); tg.className = 'tag ' + F.mode; tg.textContent = F.mode === 'swish' ? '涮' : '煮';
        el.appendChild(im); el.appendChild(nm); el.appendChild(tg); tray.appendChild(el);
      });
    }

    /* 排版：避开小红书右上角胶囊按钮和底部安全区 */
    function layout() {
      var w = app.clientWidth, h = app.clientHeight;
      if (insets.top) hud.style.paddingTop = (insets.top + 6) + 'px';
      if (insets.bottom) $('tray').style.paddingBottom = (insets.bottom + 8) + 'px';
      var hudH = hud.offsetHeight, trayH = $('tray').offsetHeight;
      $('combo').style.top = (hudH + 2) + 'px';
      $('tools').style.top = (hudH + 8) + 'px';
      // 突发事件横幅放在锅和托盘交界处，不挡锅的上半部分
      $('event').style.bottom = (trayH - 30) + 'px';
      $('coach').style.bottom = (trayH + 6) + 'px';
      game.layout(w, h, hudH + 6, h - trayH - 4);
    }
    window.addEventListener('resize', function () { if (game) layout(); });

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
        var el = $('plate-' + id), r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
        return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.width * 0.45 };
      }
    };
    function endTutorial() {
      tutorial.stop(); $('coach').className = 'coach hidden';
      profile.tutorialDone = true; saveProfile();
      startRound();
    }
    $('coach-btn').addEventListener('click', endTutorial);
    $('coach-skip').addEventListener('click', endTutorial);

    /* ---------- 触控（支持多指：涮菜时另一根手指可以挡筷子） ---------- */
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    var dragId = null;
    tray.addEventListener('pointerdown', function (e) {
      var el = e.target.closest ? e.target.closest('.plate') : null;
      if (!el || !game || !game.running || dragId !== null) return;
      e.preventDefault();
      audio.unlock();
      var p = pos(e); game.dragStart(el.getAttribute('data-food'), p.x, p.y);
      dragId = e.pointerId;
      el.classList.add('pressed'); setTimeout(function () { el.classList.remove('pressed'); }, 160);
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

    /* ---------- 开始 / 一局 / 结算 ---------- */
    function showStart() {
      $('best').textContent = profile.best ? '个人最高 ' + profile.best + ' 分' : '';
      $('start').classList.remove('hidden');
    }
    function hideOverlays() {
      $('start').classList.add('hidden'); $('result').classList.add('hidden');
      $('event').className = 'event'; $('combo').className = 'combo'; $('score').textContent = '0';
    }
    function startRound() {
      audio.unlock(); hideOverlays();
      game.reset(); game.mode = 'play'; game.running = true;
    }
    function startTutorial() {
      audio.unlock(); hideOverlays();
      tutorial.start();
    }
    $('btn-start').addEventListener('click', function () {
      if (!profile.tutorialDone) startTutorial(); else startRound();
    });
    $('btn-tutorial').addEventListener('click', startTutorial);
    $('btn-again').addEventListener('click', startRound);

    function finishRound(s) {
      var isBest = s.score > (profile.best || 0) && s.score > 0;
      profile.games = (profile.games || 0) + 1;
      if (isBest) profile.best = s.score;
      saveProfile();
      var p = persona(s);
      cardUrl = HP.renderCard(images, s, p, { date: today(), scene: '兄弟局 · 九宫格', isBest: isBest });
      $('r-img').src = cardUrl;
      $('save-tip').textContent = '';
      $('btn-share').classList.toggle('hidden', !P.canShare);
      $('result').classList.remove('hidden');
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
