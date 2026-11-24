/* 1.3 新增的长线与社交系统：挑战码、丢分分析、火候格子图、下一个目标、AI 锐评的提示词。
   全部是纯函数，不碰 DOM，方便测试。 */
var HP = window.HP = window.HP || {};

(function () {
  /* ---------- 挑战码：9 位，不需要服务器 ----------
     两种：今日火锅（期数）/ 自定义挑战（种子 + 剧本 + 锅底），都带上出题人的分数，末尾 6 位校验。
     用加减乘除拼位，不用位运算（JS 位运算只有 32 位）。 */
  var ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford base32：去掉了 I L O U，不容易抄错
  var LEN = 9, SCORE_MAX = 16383;
  function check(v) { var h = 7, x = v; for (var i = 0; i < 8; i++) { h = (h * 31 + (x % 997)) % 64; x = Math.floor(x / 997); } return h; }
  /* 39 位载荷拆成 3 段 13 位来回异或打散（可逆），码看起来像随机的，不会出现一串 0 */
  var M13 = 8192, M26 = M13 * M13;
  function mix(v, back) {
    var a = v % M13, b = Math.floor(v / M13) % M13, c = Math.floor(v / M26);
    if (!back) { b ^= (a * 37 + 11) & 8191; c ^= (b * 53 + 7) & 8191; a ^= (c * 29 + 3) & 8191; }
    else { a ^= (c * 29 + 3) & 8191; c ^= (b * 53 + 7) & 8191; b ^= (a * 37 + 11) & 8191; }
    return a + b * M13 + c * M26;
  }
  HP.encodeChallenge = function (c) {
    var score = Math.max(0, Math.min(SCORE_MAX, Math.round(c.score || 0))), v;
    if (c.issue) v = (((0 * 4096 + (c.issue & 4095)) * 16384 + score) * 4096);   // 今日火锅：kind 0 + 期数 12 位 + 分数 14 位，补 12 位
    else {
      var si = Math.max(0, HP.SCENE_ORDER.indexOf(c.scene)), pot = c.pot === 'yuanyang' ? 1 : 0;
      v = ((((1 * 1048576 + (c.seed % 1048576)) * 8 + si) * 2 + pot) * 16384 + score);
    }
    v = mix(v, false) * 64 + check(v);
    var out = '';
    for (var i = 0; i < LEN; i++) { out = ABC.charAt(v % 32) + out; v = Math.floor(v / 32); }
    return out;
  };
  HP.prettyCode = function (code) { return code.slice(0, 3) + '-' + code.slice(3, 6) + '-' + code.slice(6); };
  HP.decodeChallenge = function (text) {
    var s = String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
    if (s.length !== LEN) return null;
    var v = 0;
    for (var i = 0; i < LEN; i++) { var k = ABC.indexOf(s.charAt(i)); if (k < 0) return null; v = v * 32 + k; }
    var chk = v % 64, payload = mix(Math.floor(v / 64), true);
    if (check(payload) !== chk) return null;
    var kind = Math.floor(payload / Math.pow(2, 38));
    if (kind === 0) {
      var p0 = Math.floor(payload / 4096), score0 = p0 % 16384, issue = Math.floor(p0 / 16384) % 4096;
      if (!issue) return null;
      return { kind: 'daily', issue: issue, score: score0 };
    }
    var score = payload % 16384, rest = Math.floor(payload / 16384);
    var pot = rest % 2; rest = Math.floor(rest / 2);
    var si = rest % 8; rest = Math.floor(rest / 8);
    var seed = rest % 1048576;
    if (!seed || si >= HP.SCENE_ORDER.length) return null;
    return { kind: 'custom', seed: seed, scene: HP.SCENE_ORDER[si], pot: pot ? 'yuanyang' : 'jiugong', score: score };
  };
  HP.newSeed = function () { return 1 + Math.floor(Math.random() * 1048575); };
  /* 期数 ↔ 日期 */
  HP.ISSUE0 = new Date(2026, 10, 23);
  HP.issueNo = function (day) {
    var d = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
    return Math.round((d - HP.ISSUE0) / 864e5) + 1;
  };
  HP.dayOfIssue = function (n) { return HP.dayKey(new Date(HP.ISSUE0.getTime() + (n - 1) * 864e5 + 12 * 3600e3)); };
  /* 自定义挑战：菜单和饭局卡都从种子推出来，出题人和接题人一模一样 */
  HP.challengeSetup = function (seed, scene, pot) {
    var r = HP.rng(seed * 31 + 7);
    var shuffle = function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    var meat = shuffle(HP.FOOD_ORDER.filter(function (id) { return !HP.FOODS[id].veg; }));
    var veg = shuffle(HP.FOOD_ORDER.filter(function (id) { return HP.FOODS[id].veg; }));
    var menu = meat.slice(0, 5).concat(veg.slice(0, 3)).sort(function (a, b) { return HP.FOOD_ORDER.indexOf(a) - HP.FOOD_ORDER.indexOf(b); });
    var card = HP.pickCard(scene, null, HP.rng(seed + 7));
    return { seed: seed, scene: scene, pot: pot, menu: menu, card: card };
  };

  /* ---------- 丢分分析：告诉玩家分丢在哪、下次怎么做 ---------- */
  var LOSS = {
    raw: ['吃了生的', '圈变绿再捞，生的扣分最多'],
    timing: ['火候差一点', '盯着颜色，圈变绿那几秒最值钱'],
    over: ['煮老了', '少下几样，盯得过来再下'],
    skill: ['手法不对', ''],
    stolen: ['被同桌抢走', '筷子伸过来时点它挡开'],
    order: ['同桌的单没接住', '头顶冒出菜就先涮那道'],
    toast: ['没接酒', '有人举杯就点「干杯」'],
    speech: ['讲话唱歌时动了筷子', '有人讲话时先停手'],
    rude: ['领导没动筷你先吃了', '开局先等领导动筷'],
    boss: ['挡了领导的筷子', '领导的筷子别挡'],
    bored: ['一道菜吃腻了', '同一道菜吃 3 块就换一道'],
    burst: ['牛肉丸爆汁了', '牛肉丸浮起来就捞'],
    share: ['贡菜自己吃了', '贡菜夹给同桌分数翻倍']
  };
  HP.lossReport = function (s) {
    var L = s.loss || {}, out = [];
    for (var k in L) if (L.hasOwnProperty(k) && L[k] > 0 && LOSS[k]) {
      var tip = LOSS[k][1];
      if (k === 'skill' && s.skillType) tip = HP.FOODS[s.skillType].tip ? HP.FOODS[s.skillType].tip.replace(/<[^>]+>/g, '') : '';
      out.push({ k: k, pts: L[k], name: LOSS[k][0], tip: tip });
    }
    out.sort(function (a, b) { return b.pts - a.pts; });
    return out.slice(0, 3);
  };

  /* ---------- 火候格子图（像 Wordle 的彩色方块，不剧透菜单） ---------- */
  HP.GRID = { P: '🟩', O: '🟨', R: '🟦', V: '🟥', S: '⬛', B: '🟧' };
  HP.GRID_COLOR = { P: '#4fcf74', O: '#ffd35c', R: '#6fb6ff', V: '#ff6b5a', S: '#3a2a26', B: '#ff9f2e' };
  HP.gridOf = function (log, per) {
    per = per || 10;
    var L = typeof log === 'string' ? log.split('') : (log || []), rows = [];
    for (var i = 0; i < L.length; i += per) rows.push(L.slice(i, i + per).map(function (c) { return HP.GRID[c] || '⬜'; }).join(''));
    return rows.join('\n');
  };

  /* ---------- 下一个目标：离哪个解锁最近 ---------- */
  HP.nextGoal = function (p) {
    var best = null;
    HP.FOOD_ORDER.forEach(function (id) {
      var F = HP.FOODS[id];
      if (F.unlock && p.unlocked.indexOf(id) < 0 && (!best || F.unlock < best.price)) best = { kind: 'food', id: id, name: F.name, price: F.unlock };
    });
    HP.POT_ORDER.forEach(function (id) {
      var P = HP.POTS[id];
      if (P.unlock && p.pots.indexOf(id) < 0 && (!best || P.unlock < best.price)) best = { kind: 'pot', id: id, name: P.name, price: P.unlock };
    });
    if (!best) return null;
    best.coins = p.coins; best.ready = p.coins >= best.price; best.left = Math.max(0, best.price - p.coins);
    return best;
  };

  /* ---------- 笔记文案（postNote 的标题 ≤20 字、正文 ≤1000 字） ---------- */
  HP.noteText = function (o) {
    var title = ('我是「' + o.persona + '」· 火锅局').slice(0, 20);
    var lines = [];
    lines.push((o.label ? o.label + ' · ' : '') + o.score + ' 分' + (o.stars != null ? ' ' + '★★★'.slice(0, o.stars) + '☆☆☆'.slice(0, 3 - o.stars) : ''));
    if (o.grid) lines.push(o.grid);
    if (o.line) lines.push(o.line);
    if (o.code) lines.push('挑战码 ' + HP.prettyCode(o.code) + '，敢来打同一锅吗？');
    lines.push('来测测你是哪种饭搭子 👉 小红书搜「火锅局」');
    lines.push('#火锅局 #饭搭子 #小红书小工具 #火锅');
    return { title: title, content: lines.join('\n').slice(0, 1000) };
  };

  /* ---------- AI 锐评（平台内测能力）：只给统计数字，不给任何个人信息 ---------- */
  HP.aiMessages = function (s, persona, sceneName) {
    var x = HP.personaMetrics(s);
    var facts = [
      '饭局：' + sceneName, '得分：' + s.score, '自己吃了 ' + s.self + ' 块，夹给同桌 ' + s.served + ' 块',
      '完美火候 ' + s.perfect + ' 块，吃生的 ' + (s.raw + s.rawServed) + ' 块，煮老 ' + s.over + ' 块',
      '被抢 ' + s.stolen + ' 块，挡开筷子 ' + s.blocked + ' 次，漏单 ' + s.orderMiss + ' 次',
      '鉴定人格：' + persona.name + '（' + persona.line + '）'
    ];
    if (s.authentic) facts.push('涮出正宗七上八下 ' + s.authentic + ' 次');
    if (x.serveRatio >= 0.6) facts.push('一直在给别人夹菜');
    return [
      { role: 'system', content: '你是火锅局小游戏里毒舌又温暖的饭搭子点评官。根据玩家这一局的数据写一句锐评：' +
        '中文，25 到 50 个字，幽默自嘲、像朋友吐槽，可以用火锅梗；不要人身攻击、不要涉及外貌身材、不要输出数字以外的隐私；只输出这一句话。' },
      { role: 'user', content: facts.join('\n') }
    ];
  };
})();
