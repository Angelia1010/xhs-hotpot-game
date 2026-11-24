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
    if (s.tripServed) L.push('把没熟的见手青夹给了别人，TA 看见了小人');
    if (s.speechBreak) L.push('别人讲话时动了筷子，场面一度很尴尬');
    if (s.orderMiss >= 2) L.push('让同桌干等了 ' + s.orderMiss + ' 次，人家饿着呢');
    if (s.servedTo && s.servedTo.boss >= 2) L.push('给领导夹了 ' + s.servedTo.boss + ' 块菜');
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

  var RARE_COL = { N: ['#c9b9a6', '#3a2a1a'], R: ['#7cc8ff', '#0c2c4a'], SR: ['#c59bff', '#2a1250'], SSR: ['#ffd35c', '#4a2a00'] };
  function fitFont(ctx, text, weight, size, maxW) {
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    while (ctx.measureText(text).width > maxW && size > 40) { size -= 4; ctx.font = weight + ' ' + size + 'px ' + FONT; }
    return size;
  }

  HP.renderCard = function (images, s, persona, extra) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), i;

    // 背景：火锅氛围图 + 暗角
    var bg = images.scene.card_bg, sc = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(25,3,0,0.62)'); g.addColorStop(0.5, 'rgba(25,3,0,0.35)'); g.addColorStop(1, 'rgba(15,2,0,0.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // 抬头
    ctx.fillStyle = 'rgba(255,226,168,0.9)'; ctx.font = '700 34px ' + FONT;
    ctx.fillText('火锅局 · 饭搭子鉴定', W / 2, 88);
    ctx.font = '500 26px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.6)';
    ctx.fillText(extra.date + '　' + extra.scene + (extra.card ? '　·　' + extra.card : ''), W / 2, 134);

    // 人格
    ctx.font = '500 32px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.8)';
    ctx.fillText('经鉴定，你是', W / 2, 214);
    var fs = fitFont(ctx, persona.name, '900', 132, W - 120);
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(90,10,0,0.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(persona.name, W / 2, 310);
    var tg = ctx.createLinearGradient(0, 310 - fs / 2, 0, 310 + fs / 2);
    tg.addColorStop(0, '#fff1c4'); tg.addColorStop(1, '#ffb13a');
    ctx.fillStyle = tg; ctx.fillText(persona.name, W / 2, 310);
    fitFont(ctx, persona.line, '600', 38, W - 140); ctx.fillStyle = '#ffe9cf';
    ctx.fillText(persona.line, W / 2, 400);

    // 稀有度
    var rc = RARE_COL[persona.rare] || RARE_COL.N, rt = HP.RARE[persona.rare] + '人格 · ' + persona.rare;
    ctx.font = '800 30px ' + FONT;
    var pw = ctx.measureText(rt).width + 56;
    ctx.fillStyle = rc[0]; rr(ctx, W / 2 - pw / 2, 448, pw, 54, 27); ctx.fill();
    ctx.fillStyle = rc[1]; ctx.fillText(rt, W / 2, 476);

    // 分数
    ctx.font = '600 30px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.75)';
    ctx.fillText('本局得分', W / 2, 560);
    ctx.font = '900 96px ' + FONT; ctx.fillStyle = '#ffd35c';
    ctx.fillText(String(s.score) + (extra.isBest ? '' : ''), W / 2, 628);
    if (extra.stars != null) {
      ctx.font = '900 36px ' + FONT;
      for (var si = 0; si < 3; si++) { ctx.fillStyle = si < extra.stars ? '#ffd35c' : 'rgba(255,240,220,0.22)'; ctx.fillText('★', W / 2 - 50 + si * 50 - (extra.isBest ? 90 : 0), 690); }
    }
    if (extra.isBest) { ctx.font = '700 26px ' + FONT; ctx.fillStyle = '#ffb13a'; ctx.fillText('个人新纪录', W / 2 + (extra.stars != null ? 90 : 0), 690); }

    // 数据格
    var cells = [
      [s.served, '夹给同桌'], [s.self, '自己吃'], [s.perfect, '完美火候'],
      [s.orders ? s.ordersDone + '/' + s.orders : '—', '点单完成'], [s.blocked, '挡住筷子'], [s.authentic, '七上八下']
    ];
    var gx = 90, gy = 724, cw = (W - gx * 2 - 40) / 3, ch = 128;
    for (i = 0; i < cells.length; i++) {
      var x = gx + (i % 3) * (cw + 20), y = gy + Math.floor(i / 3) * (ch + 18);
      ctx.fillStyle = 'rgba(30,5,2,0.6)'; rr(ctx, x, y, cw, ch, 22); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,140,0.22)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff6ea'; ctx.font = '900 54px ' + FONT;
      ctx.fillText(String(cells[i][0]), x + cw / 2, y + 52);
      ctx.fillStyle = 'rgba(255,240,220,0.7)'; ctx.font = '500 24px ' + FONT;
      ctx.fillText(cells[i][1], x + cw / 2, y + 100);
    }

    // 饭搭子
    var by = 1032, bh = 190, best = HP.personaById(persona.best), worst = HP.personaById(persona.worst);
    ctx.fillStyle = 'rgba(30,5,2,0.66)'; rr(ctx, gx, by, W - gx * 2, bh, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,92,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '500 28px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.7)';
    ctx.fillText('最佳饭搭子', gx + 40, by + 56); ctx.fillText('千万别一起吃', gx + 40, by + 136);
    ctx.font = '900 44px ' + FONT;
    ctx.fillStyle = '#7dff9a'; ctx.fillText(best ? best.name : '—', gx + 250, by + 56);
    ctx.fillStyle = '#ff9b7a'; ctx.fillText(worst ? worst.name : '—', gx + 250, by + 136);
    ctx.textAlign = 'center';

    // 实录
    var lines = HP.cardLines(s).slice(0, 1);
    ctx.font = '600 30px ' + FONT; ctx.fillStyle = '#ffe9cf';
    lines.forEach(function (l) { ctx.fillText(l, W / 2, 1282, W - 120); });

    // 落款
    ctx.font = '700 30px ' + FONT; ctx.fillStyle = 'rgba(255,211,92,0.95)';
    ctx.fillText('来小红书搜「火锅局」，测测你是哪种饭搭子', W / 2, 1372);

    return c.toDataURL('image/jpeg', 0.85);
  };

  /* ---------- 饭搭子配对卡 ---------- */
  function hash(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003; return h; }
  HP.pairScore = function (a, b) {
    var key = [a.id, b.id].sort().join('+'), base = 52 + hash(key) % 36;
    if (a.best === b.id || b.best === a.id) return { n: 96 + hash(key) % 4, v: '天作之合', t: '建议每周一起吃火锅，谁也别跟谁抢' };
    if (a.worst === b.id || b.worst === a.id) return { n: 18 + hash(key) % 17, v: '八字不合', t: '一起吃火锅建议 AA，最好分锅' };
    if (a.id === b.id) return { n: 77, v: '同类相吸', t: '一样的吃法，一样的毛病，挺好' };
    if (base >= 78) return { n: base, v: '默契饭搭子', t: '你涮 TA 夹，配合得刚刚好' };
    if (base >= 64) return { n: base, v: '还挺合拍', t: '偶尔抢一块肉，问题不大' };
    return { n: base, v: '需要磨合', t: '先从一起点菜开始培养感情吧' };
  };
  HP.renderPairCard = function (images, a, b) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), bg = images.scene.pair_bg || images.scene.card_bg, sc = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(25,3,0,0.75)'); g.addColorStop(0.45, 'rgba(25,3,0,0.35)'); g.addColorStop(0.7, 'rgba(25,3,0,0.35)'); g.addColorStop(1, 'rgba(15,2,0,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,226,168,0.9)'; ctx.font = '700 34px ' + FONT; ctx.fillText('火锅局 · 饭搭子配对', W / 2, 90);
    var r = HP.pairScore(a, b);
    // 两个人格
    [[a, '我', 270], [b, 'TA', 810]].forEach(function (it) {
      ctx.font = '500 30px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.75)'; ctx.fillText(it[1] + ' 是', it[2], 190);
      var fs = fitFont(ctx, it[0].name, '900', 64, 440);
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(90,10,0,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(it[0].name, it[2], 262);
      ctx.fillStyle = '#ffd35c'; ctx.fillText(it[0].name, it[2], 262);
      ctx.font = '700 26px ' + FONT; ctx.fillStyle = (RARE_COL[it[0].rare] || RARE_COL.N)[0]; ctx.fillText(HP.RARE[it[0].rare] + ' · ' + it[0].rare, it[2], 320);
    });
    ctx.font = '900 60px ' + FONT; ctx.fillStyle = '#fff1c4'; ctx.fillText('×', W / 2, 262);
    // 默契度
    ctx.font = '600 32px ' + FONT; ctx.fillStyle = 'rgba(255,240,220,0.8)'; ctx.fillText('饭搭子默契度', W / 2, 980);
    ctx.font = '900 170px ' + FONT; ctx.fillStyle = '#ffd35c'; ctx.fillText(r.n + '%', W / 2, 1090);
    ctx.font = '900 64px ' + FONT; ctx.fillStyle = r.n >= 64 ? '#7dff9a' : '#ff9b7a'; ctx.fillText(r.v, W / 2, 1210);
    fitFont(ctx, r.t, '600', 36, W - 140); ctx.fillStyle = '#ffe9cf'; ctx.fillText(r.t, W / 2, 1286);
    ctx.font = '700 30px ' + FONT; ctx.fillStyle = 'rgba(255,211,92,0.95)';
    ctx.fillText('来小红书搜「火锅局」，测测你们是不是饭搭子', W / 2, 1384);
    return c.toDataURL('image/jpeg', 0.85);
  };
})();
