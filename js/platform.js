/* 平台适配层：小红书容器里用 window.xhs.miniTool，浏览器预览时用网页能力兜底。
   规则：在小红书容器里，接口缺失或调用失败就停用该功能，不回退到 localStorage。 */
var HP = window.HP = window.HP || {};

(function () {
  var mt = window.xhs && window.xhs.miniTool;
  var inXhs = !!mt;
  function has(name) { return inXhs && typeof mt[name] === 'function'; }
  function call(name, args) {
    try {
      var r = mt[name](args || {});
      return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
    } catch (e) { return Promise.reject(e); }
  }
  function browserStore() {
    try { var k = '__hp'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return window.localStorage; }
    catch (e) { return null; }
  }

  var P = HP.platform = { inXhs: inXhs };

  /* ---------- 存档 ---------- */
  P.canSave = inXhs ? has('setStorage') : !!browserStore();
  P.load = function (key) {
    if (inXhs) {
      if (!has('getStorage')) return Promise.resolve(null);
      return call('getStorage', { key: key }).then(function (r) {
        return r && r.data ? JSON.parse(r.data) : null;
      }).catch(function () { return null; });
    }
    var ls = browserStore();
    try { return Promise.resolve(ls && ls.getItem('hp_' + key) ? JSON.parse(ls.getItem('hp_' + key)) : null); }
    catch (e) { return Promise.resolve(null); }
  };
  P.save = function (key, value) {
    var json = JSON.stringify(value);
    if (inXhs) {
      if (!has('setStorage')) return Promise.resolve(false);
      return call('setStorage', { key: key, data: json }).then(function () { return true; }).catch(function () { return false; });
    }
    var ls = browserStore();
    try { if (ls) ls.setItem('hp_' + key, json); return Promise.resolve(!!ls); } catch (e) { return Promise.resolve(false); }
  };

  /* ---------- 震动（节流，避免高频调用） ---------- */
  var lastVib = 0;
  P.vibrate = function (strength) {
    var now = Date.now();
    if (now - lastVib < 60) return;
    lastVib = now;
    if (inXhs) {
      if (has('vibrateShort')) call('vibrateShort', { type: strength || 'light' }).catch(function () {});
      return;
    }
    if (navigator.vibrate) {
      try { navigator.vibrate({ light: 8, medium: 18, heavy: 32 }[strength] || 8); } catch (e) {}
    }
  };

  /* ---------- 保存图片：必须在点击事件里调用 ---------- */
  P.canSaveImage = inXhs ? has('saveImageToPhotosAlbum') : true;
  P.saveImage = function (dataUrl) {
    if (inXhs) {
      if (!has('saveImageToPhotosAlbum')) return Promise.reject(new Error('unsupported'));
      return call('saveImageToPhotosAlbum', { filePath: dataUrl });
    }
    // 浏览器预览：不能直接下载，交给页面显示大图让用户长按保存
    return Promise.reject(new Error('browser'));
  };

  /* ---------- 分享 ---------- */
  P.canShare = has('share');
  P.share = function (dataUrl) {
    if (!P.canShare) return Promise.reject(new Error('unsupported'));
    return dataUrl ? call('share', { type: 'image', image_resource: dataUrl }) : call('share', { type: 'card' });
  };
  /* 小工具卡片：朋友收到后点开就能进游戏（image 类型只是一张图，进不来）。
     TODO：确认 share 的 card 类型能否带标题 / 启动参数，能的话把挑战码放进去，朋友点开直接打同一锅 */
  P.shareCard = function () { return P.share(null); };

  /* ---------- 一键发笔记：结算卡直接带进发布页 ----------
     大图先用 writeTempFile 换成本地路径（文档建议），失败就直接传 data URI */
  P.canPost = has('postNote');
  function tempFile(dataUrl) {
    if (!has('writeTempFile')) return Promise.resolve(dataUrl);
    return call('writeTempFile', { data: dataUrl }).then(function (r) { return (r && r.filePath) || dataUrl; }).catch(function () { return dataUrl; });
  }
  P.postNote = function (o) {
    if (!P.canPost) return Promise.reject(new Error(inXhs ? 'unsupported' : 'browser'));
    return Promise.all((o.images || []).map(tempFile)).then(function (urls) {
      return call('postNote', { title: o.title, content: o.content, pageType: 'photo_publish',
        mediaInfo: { image_resources: urls.map(function (u) { return { url: u }; }) } });
    });
  };

  /* ---------- 对局中保持亮屏（9.55+） ---------- */
  P.keepScreenOn = function (on) {
    if (has('setKeepScreenOn')) call('setKeepScreenOn', { keepScreenOn: !!on }).catch(function () {});
  };

  /* ---------- 客户端版本（文档 §3.6）：buildVersion 末 3 位是编译序号，9562004 = 9.56.2；拿不到就是「版本未知」 ---------- */
  function readBuild(lo) {
    var env = lo && lo.miniToolEnv, v = env && env.buildVersion;
    if (typeof v !== 'number' && typeof v !== 'string') return null;
    if (!/^[1-9]\d{6,}$/.test(String(v))) return null;
    v = Number(v);
    return Number.isSafeInteger(v) ? v : null;
  }
  P.build = null;
  P.atLeast = function (min) { return P.build !== null && Math.floor(P.build / 1000) >= min; };

  /* ---------- 排行榜（内测，客户端 9.51+）：版本够、方法齐才显示；未授权 1005 / 1006 / 白名单 10003 就整块隐藏 ----------
     昵称由平台填充、只在返回值里出现，不采集也不存用户资料；榜单和本人名次本地缓存 45 秒，提交成绩后刷新 */
  var RANK_FNS = ['submitScore', 'getRankList', 'getMyRank'];
  /* rankState：ok 能用；browser 普通浏览器预览；unknown 读不到客户端版本（电脑模拟器常见）；old 低于 9.51；
     nofn 方法不全（没开通）；denied 未授权 1005 / 1006 / 白名单 10003。
     后两种按文档隐藏入口；browser / unknown / old 首页照样显示入口，告诉玩家去哪儿能看 */
  P.rankOk = false;
  P.rankState = inXhs ? 'unknown' : 'browser';
  P.ready = (function () {
    var sync = readBuild(window.xhs && window.xhs.launchOptions);
    if (sync !== null || !has('getLaunchOptions')) return Promise.resolve(sync);
    return call('getLaunchOptions').then(readBuild).catch(function () { return null; });
  })().then(function (b) {
    P.build = b;
    P.rankState = !inXhs ? 'browser' : b === null ? 'unknown' : !P.atLeast(9510) ? 'old' : !RANK_FNS.every(has) ? 'nofn' : 'ok';
    P.rankOk = P.rankState === 'ok';
    P.rankMissing = inXhs ? RANK_FNS.filter(function (n) { return !has(n); }) : [];
    return b;
  });
  function code(e) { return e && (e.errCode != null ? e.errCode : e.code); }
  P.rankCode = null;   // 最近一次排行榜失败的错误码，给首页版本号上的诊断用
  function denied(e) { var c = code(e); P.rankCode = c != null ? c : 'net'; if (c === 1005 || c === 1006 || c === 10003) { P.rankOk = false; P.rankState = 'denied'; } return Promise.reject(e); }
  /* 排行榜为什么用不了：一句话，测试时点首页版本号就能看到 */
  P.rankDiag = function () {
    var S = { ok: '可用', browser: '浏览器预览，没有小红书接口', unknown: '读不到小红书版本号', old: '小红书版本低于 9.51', nofn: '小红书没给这个小工具排行榜接口', denied: '平台拒绝（未授权）' };
    var v = P.build ? String(Math.floor(P.build / 1000)) : '';
    return '排行榜：' + (S[P.rankState] || P.rankState) +
      (v ? ' · 小红书 ' + v.charAt(0) + '.' + v.slice(1, 3) + '.' + v.slice(3) : '') +
      (P.rankMissing && P.rankMissing.length && P.rankMissing.length < 3 ? ' · 缺 ' + P.rankMissing.join('/') : '') +
      (P.rankCode != null ? ' · 错误码 ' + P.rankCode : '');
  };
  var cache = {};
  function cached(key) { var c = cache[key]; return c && Date.now() - c.t < 45000 ? c.v : undefined; }
  P.submitScore = function (board, score) {
    if (!P.rankOk || !isFinite(score)) return Promise.resolve(null);
    return call('submitScore', { board: board, score: score }).then(function (r) {
      for (var k in cache) if (cache.hasOwnProperty(k) && k.split(':')[1] === String(board)) delete cache[k];
      return r || {};
    }).catch(denied).catch(function () { return null; });
  };
  /* 榜单没就绪（2002）退避重试 4 次（0.5 / 1 / 2 / 4 秒），不当空榜 */
  function withRetry(name, args) {
    var tries = 0;
    function go() {
      return call(name, args).catch(function (e) {
        if (code(e) === 2002 && tries < 4) { var w = 500 * Math.pow(2, tries++); return new Promise(function (res) { setTimeout(res, w); }).then(go); }
        return denied(e);
      });
    }
    return go();
  }
  P.rankList = function (board, period) {
    if (!P.rankOk) return Promise.reject(new Error('unsupported'));
    var key = 'L:' + board + ':' + period, v = cached(key);
    if (v !== undefined) return Promise.resolve(v);
    return withRetry('getRankList', { board: board, period: period }).then(function (r) {
      v = (r && r.data) || []; cache[key] = { t: Date.now(), v: v }; return v;
    });
  };
  /* 本人名次：{ status: EXACT | OVER_LIMIT | NO_SCORE | NOT_PARTICIPATING, rank, score } */
  P.myRank = function (board, period) {
    if (!P.rankOk) return Promise.reject(new Error('unsupported'));
    var key = 'M:' + board + ':' + period, v = cached(key);
    if (v !== undefined) return Promise.resolve(v);
    return withRetry('getMyRank', { board: board, period: period }).then(function (r) {
      v = r || null; cache[key] = { t: Date.now(), v: v }; return v;
    });
  };

  /* ---------- AI 文本生成（内测）：只在结算页调一次，10 秒没回就放弃 ---------- */
  var AI = window.xhs && window.xhs.AI;
  P.aiOk = !!(AI && typeof AI.createModel === 'function');
  P.ai = function (messages) {
    if (!P.aiOk) return Promise.resolve(null);
    var timer, timeout = new Promise(function (res) { timer = setTimeout(function () { res(null); }, 10000); });
    var job;
    try {
      job = Promise.resolve(AI.createModel('deepseek-v4-flash').generateText({ messages: messages, max_output_tokens: 120, temperature: 0.9 }));
    } catch (e) { return Promise.resolve(null); }
    return Promise.race([job.then(function (r) {
      var c = r && r.choices && r.choices[0];
      var t = (c && ((c.message && c.message.content) || c.text)) || (r && (r.text || r.content)) || '';
      t = String(t).replace(/^["“\s]+|["”\s]+$/g, '');
      return t ? t.slice(0, 80) : null;
    }).catch(function (e) { if (e && /AI_NOT_ALLOWED/.test(String(e.errCode || e.code || e.message))) P.aiOk = false; return null; }), timeout])
      .then(function (v) { clearTimeout(timer); return v; });
  };

  /* ---------- 安全区：避开状态栏和右上角胶囊按钮 ---------- */
  P.getInsets = function () {
    if (!has('getWindowInfo')) return Promise.resolve(null);
    return call('getWindowInfo').then(function (info) {
      if (!info) return null;
      var mb = info.menuButtons || {};
      var visible = function (r) { return r && r.width > 0 && r.height > 0; };
      var rects = visible(mb.capsule) ? [mb.capsule] : [mb.back, mb.me, mb.share].filter(visible);
      var safeTop = info.safeArea ? info.safeArea.top : (info.statusBarHeight || 0);
      var top = rects.reduce(function (t, r) { return Math.max(t, r.bottom); }, safeTop);
      var bottom = info.safeArea && info.windowHeight ? Math.max(0, info.windowHeight - info.safeArea.bottom) : 0;
      return { top: top, bottom: bottom, rects: rects, width: info.windowWidth };
    }).catch(function () { return null; });
  };
})();
