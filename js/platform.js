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

  /* ---------- 排行榜（内测）：方法存在才显示；未授权 1005 / 1006 就整块隐藏 ---------- */
  P.rankOk = has('submitScore') && has('getRankList') && has('getMyRank');
  function code(e) { return e && (e.errCode != null ? e.errCode : e.code); }
  function denied(e) { var c = code(e); if (c === 1005 || c === 1006 || c === 10003) P.rankOk = false; return Promise.reject(e); }
  P.submitScore = function (board, score) {
    if (!P.rankOk) return Promise.resolve(null);
    return call('submitScore', { board: board, score: score }).catch(denied).catch(function () { return null; });
  };
  /* 榜单没就绪（2002）退避重试 4 次；结果缓存 45 秒 */
  var cache = {};
  P.rankList = function (board, period) {
    if (!P.rankOk) return Promise.reject(new Error('unsupported'));
    var key = board + ':' + period, c = cache[key];
    if (c && Date.now() - c.t < 45000) return Promise.resolve(c.v);
    var tries = 0;
    function go() {
      return call('getRankList', { board: board, period: period }).then(function (r) {
        var v = (r && r.data) || []; cache[key] = { t: Date.now(), v: v }; return v;
      }).catch(function (e) {
        if (code(e) === 2002 && tries < 4) { var w = 500 * Math.pow(2, tries++); return new Promise(function (res) { setTimeout(res, w); }).then(go); }
        return denied(e);
      });
    }
    return go();
  };
  P.myRank = function (board, period) {
    if (!P.rankOk) return Promise.reject(new Error('unsupported'));
    return call('getMyRank', { board: board, period: period }).catch(denied);
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
