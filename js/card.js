/* 结算卡「饭局报告」：1080×1440（3:4，适合发小红书笔记），用 Canvas 画好导出成图片。 */
var HP = window.HP = window.HP || {};

(function () {
  var W = 1080, H = 1440;
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function maxKey(obj) {
    var best = null, n = 0;
    for (var k in obj) if (obj.hasOwnProperty(k) && obj[k] > n) { best = k; n = obj[k]; }
    return best ? { key: best, n: n } : null;
  }

  /* 两句最有梗的「本局实录」 */
  HP.cardLines = function (s) {
    var L = [], st = maxKey(s.stolenBy);
    if (s.trip) L.push('吃了没熟的见手青，看见了小人');
    if (s.strawberry) L.push('吃了 ' + s.strawberry + ' 个草莓毛肚，川渝人沉默了');
    if (s.enoki >= 2) L.push('吃了 ' + s.enoki + ' 份金针菇：明天见');
    if (s.balanced) L.push('荤素搭配 +' + HP.BALANCE_BONUS);
    if (s.authentic) L.push('正宗七上八下 ×' + s.authentic);
    if (st && st.n >= 2) L.push('被同桌抢走 ' + st.n + ' 块' + HP.FOODS[st.key].name);
    if (s.blocked) L.push('挡下同桌 ' + s.blocked + ' 双筷子');
    if (s.toastMiss) L.push('忘了给领导回酒 ' + s.toastMiss + ' 次');
    if (s.raw) L.push('吃了 ' + s.raw + ' 块生的，肠胃在报警');
    if (s.over >= 2) L.push('煮老了 ' + s.over + ' 块，浪费可耻');
    if (s.bestCombo >= 3) L.push('最高 ' + s.bestCombo + ' 连击完美火候');
    if (!L.length) L.push('安安静静吃完了一顿火锅');
    return L.slice(0, 3);
  };

  HP.renderCard = function (images, s, persona, extra) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), i;

    // 背景：火锅氛围图 + 暗角
    var bg = images.scene.card_bg, sc = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(25,3,0,0.55)'); g.addColorStop(0.55, 'rgba(25,3,0,0.25)'); g.addColorStop(1, 'rgba(15,2,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // 抬头
    ctx.fillStyle = 'rgba(255,226,168,0.85)';
    ctx.font = '700 34px ' + FONT;
    ctx.fillText('火锅局 · 饭局报告', W / 2, 92);
    ctx.font = '500 26px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.6)';
    ctx.fillText(extra.date + '　' + extra.scene + (extra.title ? '　·　' + extra.title : ''), W / 2, 140);

    // 人格
    ctx.font = '500 30px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.75)';
    ctx.fillText('本局人格', W / 2, 232);
    ctx.font = '900 128px ' + FONT;
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(90,10,0,0.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(persona[0], W / 2, 330);
    var tg = ctx.createLinearGradient(0, 270, 0, 390);
    tg.addColorStop(0, '#fff1c4'); tg.addColorStop(1, '#ffb13a');
    ctx.fillStyle = tg; ctx.fillText(persona[0], W / 2, 330);
    ctx.font = '600 36px ' + FONT; ctx.fillStyle = '#ffe9cf';
    ctx.fillText(persona[1], W / 2, 422);

    // 分数
    ctx.font = '900 150px ' + FONT; ctx.fillStyle = '#ffd35c';
    ctx.fillText(String(s.score), W / 2, 545);
    ctx.font = '600 32px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.7)';
    ctx.fillText(extra.isBest ? '分 · 个人新纪录！' : '分', W / 2, 630);

    // 数据格
    var cells = [
      [s.perfect, '完美火候'], [s.bestCombo, '最高连击'], [s.authentic, '正宗七上八下'],
      [s.stolen, '被同桌抢走'], [s.blocked, '挡住筷子'], [s.toastOk + '/' + (s.toastOk + s.toastMiss), '回敬领导']
    ];
    var gx = 90, gy = 690, cw = (W - gx * 2 - 40) / 3, ch = 150;
    for (i = 0; i < cells.length; i++) {
      var x = gx + (i % 3) * (cw + 20), y = gy + Math.floor(i / 3) * (ch + 20);
      ctx.fillStyle = 'rgba(30,5,2,0.55)'; rr(ctx, x, y, cw, ch, 24); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,140,0.22)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff6ea'; ctx.font = '900 64px ' + FONT;
      ctx.fillText(String(cells[i][0]), x + cw / 2, y + 62);
      ctx.fillStyle = 'rgba(255,240,220,0.7)'; ctx.font = '500 26px ' + FONT;
      ctx.fillText(cells[i][1], x + cw / 2, y + 118);
    }

    // 最拿手的菜
    var best = maxKey(s.perfectBy) || maxKey(s.pickedBy);
    var by = 1060;
    ctx.fillStyle = 'rgba(30,5,2,0.6)'; rr(ctx, gx, by, W - gx * 2, 200, 28); ctx.fill();
    if (best) {
      var im = images.food[best.key][1], k = 150 / Math.max(im.width, im.height);
      ctx.drawImage(im, gx + 40 + (150 - im.width * k) / 2, by + 25 + (150 - im.height * k) / 2, im.width * k, im.height * k);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,240,220,0.7)'; ctx.font = '500 28px ' + FONT;
      ctx.fillText(s.perfectBy[best.key] ? '本局最拿手' : '本局吃最多', gx + 230, by + 62);
      ctx.fillStyle = '#ffe2a8'; ctx.font = '900 54px ' + FONT;
      ctx.fillText(HP.FOODS[best.key].name + (s.perfectBy[best.key] ? ' · 完美 ×' + s.perfectBy[best.key] : ' ×' + best.n), gx + 230, by + 128);
    } else {
      ctx.fillStyle = 'rgba(255,240,220,0.75)'; ctx.font = '600 40px ' + FONT;
      ctx.fillText('这局一口没吃上', W / 2, by + 100);
    }

    // 实录
    ctx.textAlign = 'center';
    var lines = HP.cardLines(s).slice(0, 2);
    ctx.font = '600 32px ' + FONT; ctx.fillStyle = '#ffe9cf';
    lines.forEach(function (l, i) { ctx.fillText(l, W / 2, 1300 + i * 44 + (lines.length === 1 ? 22 : 0), W - 120); });

    // 落款
    ctx.font = '700 28px ' + FONT; ctx.fillStyle = 'rgba(255,211,92,0.9)';
    ctx.fillText('来小红书「火锅局」，看看你是哪种火锅人', W / 2, 1400);

    return c.toDataURL('image/jpeg', 0.85);
  };
})();
