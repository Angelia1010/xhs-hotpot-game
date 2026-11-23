// 封面生成：在游戏页面里摆好一锅菜、盖上标题，再截图。sq=true 为 1:1，false 为 3:4
(function (sq) {
  ['hud', 'tools', 'tray', 'combo', 'event', 'coach', 'tip', 'msg'].forEach(function (id) {
    var e = document.getElementById(id); if (e) e.style.display = 'none';
  });
  var g = HP.game, W = innerWidth, H = innerHeight;
  var top = sq ? H * 0.29 : H * 0.27, bottom = sq ? H * 0.99 : H * 0.87;
  g.layout(W, H, top, bottom); g.bgKey = null;
  g.reset(); g.running = false; g.hints = false;
  var put = function (t, cell, d, nx, ny) {
    var p = nx ? { nx: nx, ny: ny } : g.randomSoupPoint(cell, 0.05);
    g.addFood(t, p.nx, p.ny);
    var f = g.foods[g.foods.length - 1]; f.d = d; f.drop = 0; f.rot = (Math.random() - 0.5) * 0.6;
  };
  put('maodu', 4, HP.FOODS.maodu.a + 1, 0.5, 0.49);
  put('beef', 1, 5); put('shrimp', 0, 8); put('duckblood', 8, 17); put('lotus', 2, 8);
  put('enoki', 6, 7); put('huanghou', 3, 9); put('napa', 5, 12); put('luncheon', 7, 7);
  g.foods.forEach(function (f) { f.depth = HP.FOODS[f.type].sinker ? 0 : HP.FOODS[f.type].depth * 0.5; });
  for (var i = 0; i < 150; i++) g.fx.update(1 / 30);
  var d = document.createElement('div'); d.id = 'cover';
  d.innerHTML = '<div class="t">火锅局</div><div class="s">涮得好是技术，吃得好是情商</div>' +
    (sq ? '' : '<div class="tags"><span>七上八下</span><span>同桌抢菜</span><span>领导敬酒</span></div>');
  var st = document.createElement('style');
  st.textContent = '#cover{position:absolute;left:0;right:0;top:' + (sq ? 4 : 5) + '%;text-align:center;z-index:9;font-family:"PingFang SC","Noto Sans CJK SC",sans-serif}' +
    '#cover .t{font-size:' + (sq ? 78 : 84) + 'px;font-weight:900;letter-spacing:10px;color:#ffe2a8;text-shadow:0 4px 0 #7a1400,0 10px 28px rgba(0,0,0,.7)}' +
    '#cover .s{margin-top:4px;font-size:' + (sq ? 20 : 22) + 'px;font-weight:700;color:#fff3df;text-shadow:0 2px 8px rgba(0,0,0,.8)}' +
    '#cover .tags{margin-top:14px}#cover .tags span{display:inline-block;margin:0 5px;padding:5px 14px;border-radius:14px;font-size:17px;font-weight:900;color:#3a0d00;background:linear-gradient(#ffe48a,#ffab1f);box-shadow:0 4px 12px rgba(0,0,0,.4)}';
  document.head.appendChild(st); document.getElementById('app').appendChild(d);
})
