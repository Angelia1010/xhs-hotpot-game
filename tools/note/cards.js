(function () {
  var s = 7;
  function r() { s = (s * 16807) % 2147483647; return s / 2147483647; }
  // 雪花
  var cs = document.querySelectorAll('.snow');
  for (var k = 0; k < cs.length; k++) {
    var c = cs[k].getContext('2d');
    for (var i = 0; i < 150; i++) {
      var x = r() * 1080, y = r() * 1440, rad = 1.5 + r() * r() * 7, a = 0.25 + r() * 0.6;
      // 中间少一点，别挡内容
      if (x > 120 && x < 960 && y > 300 && y < 1300 && r() < 0.75) continue;
      var g = c.createRadialGradient(x, y, 0, x, y, rad * 2);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.5, 'rgba(255,255,255,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad * 2, 0, 6.3); c.fill();
    }
  }
  // 封面锅里摆菜（全熟状态 _1），坐标是锅图的归一化坐标
  var box = document.getElementById('potbox'), P = 920;
  var items = [
    ['maodu', .497, .47, .15, -0.2], ['beef', .29, .30, .13, 0.4], ['shrimp', .497, .25, .10, 0],
    ['luncheon', .71, .30, .11, -0.3], ['duckblood', .25, .50, .10, 0.2], ['lotus', .75, .50, .11, 0.1],
    ['enoki', .30, .70, .12, -0.5], ['napa', .497, .75, .12, 0.3], ['huanghou', .70, .70, .12, 0.6],
    ['lettuce', .60, .58, .11, -0.8], ['potato', .39, .60, .09, 0.9]
  ];
  items.forEach(function (it) {
    var im = new Image(); im.src = '../../img/food/' + it[0] + '_1.webp';
    im.onload = function () {
      var w = it[3] * P, h = w * im.naturalHeight / im.naturalWidth;
      im.style.cssText = 'width:' + w + 'px;left:' + (it[1] * P - w / 2) + 'px;top:' + (it[2] * P - h / 2) + 'px;transform:rotate(' + it[4] + 'rad);filter:drop-shadow(0 6px 6px rgba(60,0,0,.55)) saturate(1.05)';
    };
    box.appendChild(im);
  });
  // 热气
  for (var j = 0; j < 9; j++) {
    var d = document.createElement('div'); d.className = 'steam';
    var w = 160 + r() * 220; d.style.cssText = 'width:' + w + 'px;height:' + w * 1.3 + 'px;left:' + (180 + r() * 620) + 'px;top:' + (120 + r() * 420) + 'px;opacity:' + (0.35 + r() * 0.4);
    box.appendChild(d);
  }
})();
