/* 启动：加载素材、搭界面、主循环、开始/结算页。 */
(function () {
  var HP = window.HP;
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
    var jobs = [], images = { scene: {}, food: {}, plate: {} }, done = 0, total;
    HP.ASSETS.scene.forEach(function (n) { jobs.push(['scene', n, 'assets/scene/' + n + '.webp']); });
    HP.FOOD_ORDER.forEach(function (n) {
      images.food[n] = [];
      for (var i = 0; i < 3; i++) jobs.push(['food', n, 'assets/food/' + n + '_' + i + '.webp', i]);
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

  function persona(s) {
    var ratio = s.eaten ? s.perfect / s.eaten : 0;
    if (s.eaten === 0) return ['光看不吃', '锅都快烧干了，你一口没动'];
    if (s.stolen >= 4) return ['被抢专业户', '老王说今天这顿吃得很满意'];
    if (ratio >= 0.7 && s.perfect >= 6) return ['毛肚刺客', '火候拿捏得比服务员还准'];
    if (s.blocked >= 3) return ['护食狂魔', '谁也别想从你锅里夹走一片肉'];
    if (s.raw >= 3) return ['生吃勇士', '你的肠胃正在给你打电话'];
    if (s.over >= 4) return ['炖菜大师', '你是来吃火锅的还是来熬汤的'];
    if (ratio >= 0.4) return ['火锅老手', '有点东西，再练练就能出师'];
    return ['火锅新秀', '下次盯紧一点，别光顾着聊天'];
  }

  function init() {
    var canvas = $('cv'), app = $('app'), tray = $('plates'), hud = $('hud');
    var audio = new HP.Audio(), game;

    function haptic(kind) {
      // 小红书容器里换成平台的 vibrateShort；浏览器预览用 navigator.vibrate
      if (navigator.vibrate) navigator.vibrate(kind === 'perfect' ? 18 : kind === 'block' ? 30 : 8);
    }

    var hooks = {
      onScore: function (s) {
        $('score').textContent = s.score;
        var c = $('combo');
        if (s.combo >= 2) { c.textContent = s.combo + ' 连击'; c.className = 'combo show'; }
        else c.className = 'combo';
      },
      onEnd: function (s) { showResult(s); },
      onMiss: function () {},
      haptic: haptic
    };

    $('loadbar').style.width = '0%';
    loadAll(function (p) { $('loadbar').style.width = Math.round(p * 100) + '%'; }).then(function (images) {
      game = new HP.Game(canvas, images, hooks);
      game.audio = audio;
      HP.game = game; // 方便调试
      buildTray(images);
      layout();
      $('loading').classList.add('hidden');
      $('start').classList.remove('hidden');
      requestAnimationFrame(loop);
    }).catch(function (e) { $('loadtext').textContent = e.message; });

    function buildTray(images) {
      tray.innerHTML = '';
      HP.FOOD_ORDER.forEach(function (id) {
        var F = HP.FOODS[id], el = document.createElement('div');
        el.className = 'plate'; el.setAttribute('data-food', id);
        var im = document.createElement('img'); im.alt = F.name; im.draggable = false;
        // 盘子图加载完托盘才有真实高度，此时重新排版，锅才会居中
        im.onload = function () { if (game) layout(); };
        im.src = 'assets/plate/' + id + '.webp';
        var nm = document.createElement('span'); nm.textContent = F.name;
        el.appendChild(im); el.appendChild(nm); tray.appendChild(el);
      });
    }

    function layout() {
      var w = app.clientWidth, h = app.clientHeight;
      var top = hud.offsetHeight + 6, bottom = h - $('tray').offsetHeight - 4;
      game.layout(w, h, top, bottom);
    }
    window.addEventListener('resize', function () { if (game) layout(); });

    /* ---------- 触控 ---------- */
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    tray.addEventListener('pointerdown', function (e) {
      var el = e.target.closest ? e.target.closest('.plate') : null;
      if (!el || !game || !game.running) return;
      e.preventDefault();
      audio.unlock();
      var p = pos(e); game.dragStart(el.getAttribute('data-food'), p.x, p.y);
      el.classList.add('pressed'); setTimeout(function () { el.classList.remove('pressed'); }, 160);
    });
    window.addEventListener('pointermove', function (e) { if (game && game.drag) { var p = pos(e); game.dragMove(p.x, p.y); } });
    window.addEventListener('pointerup', function () { if (game) game.dragEnd(); });
    window.addEventListener('pointercancel', function () { if (game) game.drag = null; });
    canvas.addEventListener('pointerdown', function (e) {
      if (!game || game.drag) return;
      audio.unlock();
      var p = pos(e); game.pointerDown(p.x, p.y);
    });

    $('btn-hint').addEventListener('click', function () {
      game.hints = !game.hints; this.classList.toggle('off', !game.hints);
    });
    $('btn-sound').addEventListener('click', function () {
      audio.unlock(); this.classList.toggle('off', !audio.toggle());
    });

    function start() {
      audio.unlock();
      game.reset(); game.running = true;
      $('score').textContent = '0'; $('combo').className = 'combo';
      $('start').classList.add('hidden'); $('result').classList.add('hidden');
    }
    $('btn-start').addEventListener('click', start);
    $('btn-again').addEventListener('click', start);

    function showResult(s) {
      var p = persona(s);
      $('r-title').textContent = p[0]; $('r-sub').textContent = p[1];
      $('r-score').textContent = s.score;
      $('r-perfect').textContent = s.perfect;
      $('r-combo').textContent = s.bestCombo;
      $('r-stolen').textContent = s.stolen;
      $('r-blocked').textContent = s.blocked;
      $('r-raw').textContent = s.raw;
      $('result').classList.remove('hidden');
    }

    /* ---------- 主循环（低端机自动降特效） ---------- */
    var last = 0, slow = 0;
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      if (dt > 0.024) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
      if (slow > 2 && game.fx.quality > 0.6) game.fx.quality = 0.6;
      game.update(dt);
      game.render();
      if (game.running) {
        $('time').textContent = fmt(game.timeLeft);
        var k = game.timeLeft / HP.ROUND_TIME;
        $('ring').style.strokeDashoffset = (113 * (1 - k)).toFixed(1);
        $('timer').classList.toggle('urgent', game.timeLeft <= 10);
      }
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', function () { last = 0; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
