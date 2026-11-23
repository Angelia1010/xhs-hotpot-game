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
