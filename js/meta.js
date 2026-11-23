/* 长线系统：存档、金币、解锁、自选菜单、每日一锅、连续打卡、成就、称号、人格。 */
var HP = window.HP = window.HP || {};

(function () {
  var TRAY_MAX = 8, TRAY_MIN = 4;

  /* ---------- 成就 ---------- */
  HP.ACHIEVEMENTS = [
    { id: 'first_perfect', name: '初出茅庐', desc: '第一次拿到完美火候', coins: 30, test: function (t) { return t.perfect >= 1; } },
    { id: 'perfect_50', name: '火候在手', desc: '累计完美 50 次', coins: 150, test: function (t) { return t.perfect >= 50; } },
    { id: 'perfect_200', name: '人肉计时器', desc: '累计完美 200 次', coins: 400, test: function (t) { return t.perfect >= 200; } },
    { id: 'authentic_1', name: '七上八下', desc: '第一次涮出正宗七上八下', coins: 50, test: function (t) { return t.authentic >= 1; } },
    { id: 'authentic_10', name: '重庆认证', desc: '累计正宗七上八下 10 次', coins: 200, test: function (t) { return t.authentic >= 10; } },
    { id: 'block_20', name: '护食', desc: '累计挡下 20 双筷子', coins: 120, test: function (t) { return t.blocked >= 20; } },
    { id: 'block_100', name: '铁筷子', desc: '累计挡下 100 双筷子', coins: 300, test: function (t) { return t.blocked >= 100; } },
    { id: 'combo_5', name: '手感来了', desc: '一局里 5 连击', coins: 100, test: function (t, s) { return s.bestCombo >= 5; } },
    { id: 'combo_10', name: '停不下来', desc: '一局里 10 连击', coins: 300, test: function (t, s) { return s.bestCombo >= 10; } },
    { id: 'clean', name: '肠胃无忧', desc: '一局吃 8 块以上，一块生的都没吃', coins: 120, test: function (t, s) { return s.eaten >= 8 && s.raw === 0; } },
    { id: 'toast_all', name: '酒桌通透', desc: '一局里领导的酒全接住（至少 2 次）', coins: 100, test: function (t, s) { return s.toastOk >= 2 && s.toastMiss === 0; } },
    { id: 'serve_5', name: '领导的好帮手', desc: '团建一局给领导涮好 5 道菜', coins: 200, test: function (t, s) { return s.served >= 5; } },
    { id: 'score_1000', name: '千分食客', desc: '一局拿到 1000 分', coins: 100, test: function (t, s) { return s.score >= 1000; } },
    { id: 'score_2000', name: '火锅之神', desc: '一局拿到 2000 分', coins: 300, test: function (t, s) { return s.score >= 2000; } },
    { id: 'streak_7', name: '一周七顿', desc: '连续 7 天吃火锅', coins: 300, test: function (t, s, p) { return p.streak.n >= 7; } },
    { id: 'balanced', name: '荤素搭配', desc: '一局荤素各吃 5 块以上', coins: 100, test: function (t, s) { return s.veg >= 5 && s.meat >= 5; } },
    { id: 'dark_cuisine', name: '黑暗料理王', desc: '一局吃掉 3 个草莓毛肚', coins: 150, test: function (t, s) { return s.strawberry >= 3; } },
    { id: 'little_people', name: '看见小人', desc: '吃了一口没煮熟的见手青', coins: 50, test: function (t, s) { return s.trip >= 1; } },
    { id: 'yuanyang', name: '两开花', desc: '解锁鸳鸯锅', coins: 100, test: function (t, s, p) { return p.pots.indexOf('yuanyang') >= 0; } },
    { id: 'collector', name: '菜单全开', desc: '解锁全部菜品', coins: 200, test: function (t, s, p) { return HP.FOOD_ORDER.every(function (id) { return p.unlocked.indexOf(id) >= 0; }); } }
  ];

  /* 称号：按累计完美次数升级 */
  HP.TITLES = [[0, '火锅学徒'], [15, '火锅食客'], [50, '火锅老饕'], [120, '涮锅高手'], [250, '火锅宗师']];
  HP.titleOf = function (p) {
    var t = HP.TITLES[0][1];
    for (var i = 0; i < HP.TITLES.length; i++) if (p.totals.perfect >= HP.TITLES[i][0]) t = HP.TITLES[i][1];
    return t;
  };
  HP.nextTitle = function (p) {
    for (var i = 0; i < HP.TITLES.length; i++) if (p.totals.perfect < HP.TITLES[i][0]) return { name: HP.TITLES[i][1], need: HP.TITLES[i][0] - p.totals.perfect };
    return null;
  };

  /* 菜品徽章：累计完美 10 / 30 / 100 次 */
  HP.BADGES = [[10, '铜筷'], [30, '银筷'], [100, '金筷']];
  HP.badgeOf = function (n) {
    var b = null;
    for (var i = 0; i < HP.BADGES.length; i++) if (n >= HP.BADGES[i][0]) b = { tier: i, name: HP.BADGES[i][1] };
    return b;
  };

  /* ---------- 存档 ---------- */
  HP.newProfile = function () {
    return {
      v: 2, tutorialDone: false, best: 0, bestBy: {}, games: 0, coins: 0,
      unlocked: HP.FOOD_ORDER.filter(function (id) { return !HP.FOODS[id].unlock; }),
      loadout: null,
      totals: { perfect: 0, authentic: 0, blocked: 0, stolen: 0, served: 0, toastOk: 0, eaten: 0, raw: 0 },
      perfectBy: {}, ach: {}, streak: { last: 0, n: 0 }, daily: { day: 0, best: 0, plays: 0 }, lastPlayDay: 0, seen: {}, pots: ['jiugong'], pot: 'jiugong'
    };
  };
  /* 合并旧存档，缺的字段补默认值 */
  HP.migrateProfile = function (old) {
    var p = HP.newProfile();
    if (!old) return p;
    for (var k in old) if (old.hasOwnProperty(k)) {
      if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k]) && old[k] && typeof old[k] === 'object') {
        for (var j in old[k]) if (old[k].hasOwnProperty(j)) p[k][j] = old[k][j];
      } else p[k] = old[k];
    }
    p.unlocked = p.unlocked.filter(function (id) { return HP.FOODS[id]; });
    HP.FOOD_ORDER.forEach(function (id) { if (!HP.FOODS[id].unlock && p.unlocked.indexOf(id) < 0) p.unlocked.push(id); });
    if (p.pots.indexOf('jiugong') < 0) p.pots.unshift('jiugong');
    if (p.pots.indexOf(p.pot) < 0) p.pot = 'jiugong';
    p.v = 2;
    return p;
  };

  /* 上桌的菜：玩家自选，最多 8 道 */
  HP.getLoadout = function (p) {
    var lo = (p.loadout || []).filter(function (id, i, arr) { return p.unlocked.indexOf(id) >= 0 && arr.indexOf(id) === i; });
    if (lo.length < TRAY_MIN) lo = HP.FOOD_ORDER.filter(function (id) { return p.unlocked.indexOf(id) >= 0; }).slice(0, TRAY_MAX);
    return lo;
  };
  HP.toggleLoadout = function (p, id) {
    var lo = HP.getLoadout(p).slice(), i = lo.indexOf(id);
    if (i >= 0) { if (lo.length <= TRAY_MIN) return '至少带 ' + TRAY_MIN + ' 道菜上桌'; lo.splice(i, 1); }
    else { if (lo.length >= TRAY_MAX) return '桌上最多放 ' + TRAY_MAX + ' 道菜'; lo.push(id); }
    lo.sort(function (a, b) { return HP.FOOD_ORDER.indexOf(a) - HP.FOOD_ORDER.indexOf(b); });
    p.loadout = lo; return null;
  };
  HP.unlockFood = function (p, id) {
    var F = HP.FOODS[id];
    if (p.unlocked.indexOf(id) >= 0) return '已经解锁了';
    if (p.coins < F.unlock) return '金币不够，还差 ' + (F.unlock - p.coins);
    p.coins -= F.unlock; p.unlocked.push(id);
    var lo = HP.getLoadout(p).filter(function (x) { return x !== id; });
    if (lo.length < TRAY_MAX) lo.push(id);
    lo.sort(function (a, b) { return HP.FOOD_ORDER.indexOf(a) - HP.FOOD_ORDER.indexOf(b); });
    p.loadout = lo;
    return null;
  };
  HP.unlockPot = function (p, id) {
    var P = HP.POTS[id];
    if (p.pots.indexOf(id) >= 0) { p.pot = id; return null; }
    if (p.coins < P.unlock) return '金币不够，还差 ' + (P.unlock - p.coins);
    p.coins -= P.unlock; p.pots.push(id); p.pot = id;
    return null;
  };
  HP.sceneUnlocked = function (p, id) {
    var S = HP.SCENES[id];
    return !S.unlockGames || p.games >= S.unlockGames;
  };

  /* ---------- 每日一锅：同一天所有人同一份菜单、同一串事件 ---------- */
  HP.dailySetup = function (day) {
    var seed = day * 7919 + 17, r = HP.rng(seed);
    var shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    };
    // 每天 5 荤 3 素，所有人同一份
    var meat = shuffle(HP.FOOD_ORDER.filter(function (id) { return !HP.FOODS[id].veg; }));
    var veg = shuffle(HP.FOOD_ORDER.filter(function (id) { return HP.FOODS[id].veg; }));
    var menu = meat.slice(0, 5).concat(veg.slice(0, 3)).sort(function (a, b) { return HP.FOOD_ORDER.indexOf(a) - HP.FOOD_ORDER.indexOf(b); });
    return { seed: seed, menu: menu, scene: 'bros', pot: r() < 0.34 ? 'yuanyang' : 'jiugong' };
  };
  HP.dayLabel = function (day) { return Math.floor(day / 100) % 100 + '月' + day % 100 + '日'; };

  /* ---------- 一局结束：结算奖励 ---------- */
  HP.settle = function (p, s, ctx) {
    var today = HP.dayKey(), out = { coins: 0, lines: [], ach: [], isBest: false, titleUp: null, streakUp: false };
    var base = Math.floor(s.score / 10);
    var firstToday = p.lastPlayDay !== today;
    out.coins += firstToday ? base * 2 : base;
    out.lines.push(['本局得分换金币' + (firstToday ? '（今日首局 ×2）' : ''), firstToday ? base * 2 : base]);

    // 第一次把某道菜涮到完美
    for (var k in s.perfectBy) if (s.perfectBy.hasOwnProperty(k) && !p.perfectBy[k]) {
      out.coins += 20; out.lines.push(['第一次完美 · ' + HP.FOODS[k].name, 20]);
    }
    var bestKey = ctx.daily ? 'daily' : ctx.scene;
    if (s.score > (p.bestBy[bestKey] || 0) && s.score > 0) {
      out.isBest = true; p.bestBy[bestKey] = s.score;
      if (p.games > 0) { out.coins += 50; out.lines.push(['破个人纪录', 50]); }
    }
    p.best = Math.max(p.best || 0, s.score);

    // 连续打卡
    if (firstToday) {
      var yesterday = HP.dayKey(new Date(Date.now() - 864e5));
      p.streak.n = p.streak.last === yesterday ? p.streak.n + 1 : 1;
      p.streak.last = today; out.streakUp = true;
      if (p.streak.n === 3) { out.coins += 100; out.lines.push(['连续打卡 3 天', 100]); }
      if (p.streak.n >= 7 && p.streak.n % 7 === 0) { out.coins += 300; out.lines.push(['连续打卡 ' + p.streak.n + ' 天', 300]); }
    }
    p.lastPlayDay = today;

    // 每日一锅
    if (ctx.daily) {
      if (p.daily.day !== today) { p.daily.day = today; p.daily.best = 0; p.daily.plays = 0; }
      p.daily.plays++; p.daily.best = Math.max(p.daily.best, s.score);
    }

    // 累计数据
    var oldTitle = HP.titleOf(p), T = p.totals;
    T.perfect += s.perfect; T.authentic += s.authentic; T.blocked += s.blocked; T.stolen += s.stolen;
    T.served += s.served; T.toastOk += s.toastOk; T.eaten += s.eaten; T.raw += s.raw;
    for (k in s.perfectBy) if (s.perfectBy.hasOwnProperty(k)) p.perfectBy[k] = (p.perfectBy[k] || 0) + s.perfectBy[k];
    p.games++;
    var newTitle = HP.titleOf(p);
    if (newTitle !== oldTitle) out.titleUp = newTitle;

    // 成就
    HP.ACHIEVEMENTS.forEach(function (a) {
      if (!p.ach[a.id] && a.test(T, s, p)) { p.ach[a.id] = 1; out.ach.push(a); out.coins += a.coins; out.lines.push(['成就 · ' + a.name, a.coins]); }
    });
    p.coins += out.coins;
    return out;
  };

  /* ---------- 人格：技术、偏好、剧本都会影响，尽量让每个人拿到的不一样 ---------- */
  var FAV = {
    maodu: ['毛肚原教旨主义者', '无毛肚，不火锅'],
    beef: ['肥牛收割机', '一盘肥牛，三秒清空'],
    duckintestine: ['鸭肠爽脆派', '只认嘎吱嘎吱的那一口'],
    shrimp: ['虾滑捕手', '盯着锅底，等它浮上来'],
    duckblood: ['鸭血守护者', '在角落里慢慢炖，谁也别动'],
    luncheon: ['午餐肉信徒', '火锅里最快乐的那一块'],
    potato: ['土豆片爱好者', '吃火锅也要吃主食'],
    huanghou: ['黄喉卷卷党', '看它卷成圈才安心'],
    tenderbeef: ['嫩牛肉信徒', '滑嫩才是正义'],
    goose: ['鹅肠宽面党', '鸭肠太细，只认鹅肠'],
    kidney: ['腰片狙击手', '三秒卷边，一口脆嫩'],
    beefball: ['牛丸弹弹弹', '盯着锅底等它浮上来'],
    tofu: ['冻豆腐吸汁王', '吃的不是豆腐，是汤'],
    lotus: ['藕断丝连派', '脆就完事了'],
    lettuce: ['生菜闪电侠', '一秒下锅，一秒出锅'],
    gongcai: ['贡菜脆脆党', '只认咔嚓那一声'],
    napa: ['娃娃菜慢炖派', '吸饱了汤才好吃'],
    shiitake: ['香菇收集者', '每一朵都要十字刀'],
    wintermelon: ['冬瓜耐心王', '煮到透明，才配下嘴']
  };
  HP.persona = function (s, sceneId) {
    var eaten = s.eaten, ratio = eaten ? s.perfect / eaten : 0;
    var uses = s.cellUse.reduce(function (a, b) { return a + b; }, 0);
    var POT = HP.POTS[s.potId] || HP.POTS.jiugong;
    var sum = function (idx) { return idx.reduce(function (a, i) { return a + (s.cellUse[i] || 0); }, 0); };
    var center = uses ? sum(POT.center) / uses : 0, corners = uses ? sum(POT.corners) / uses : 0;
    var fav = null, favN = 0;
    for (var k in s.pickedBy) if (s.pickedBy.hasOwnProperty(k) && s.pickedBy[k] > favN) { fav = k; favN = s.pickedBy[k]; }

    if (eaten === 0) return ['光看不吃', '锅都快烧干了，你一口没动'];
    if (s.trip >= 1) return ['见过小人的人', '云南朋友建议你先去医院看看'];
    if (s.strawberry >= 3) return ['黑暗料理王', '川渝人看了沉默，草莓看了流泪'];
    if (s.enoki >= 4) return ['金针菇：明天见', 'See you tomorrow'];
    if (sceneId === 'team') {
      if (s.rude >= 2) return ['没眼力见', '领导筷子还没动，你已经吃上了'];
      if (s.blockedBoss >= 2) return ['职场勇士', '连领导的筷子都敢挡'];
      if (s.servedBad >= 2) return ['领导的眼中钉', '给领导夹的不是生的就是老的'];
      if (s.served >= 4) return ['捧场王', '给领导涮的每一块都恰到好处'];
      if (s.toastOk >= 3 && s.toastMiss === 0) return ['饭局情商王', '涮得好，酒也敬得好'];
    }
    if (s.authentic >= 3) return ['七上八下大师', '重庆人看了都要给你递一瓶冰啤酒'];
    if (s.bestCombo >= 8) return ['连击狂魔', '一出手就停不下来'];
    if (ratio >= 0.75 && s.perfect >= 8) return ['火候判官', '每一块都在最好的那一秒出锅'];
    if (sceneId === 'solo') return ratio >= 0.55 ? ['一人食艺术家', '一个人吃火锅，也要吃得精致'] : ['孤独的美食家', '没人抢，火候还是差了一点'];
    if (s.stolen >= 4) return ['被抢专业户', '老王说今天这顿吃得很满意'];
    if (s.blocked >= 4) return ['护食狂魔', '谁也别想从你锅里夹走一片肉'];
    if (s.raw >= 3) return ['生吃勇士', '你的肠胃正在给你打电话'];
    if (s.over >= 4) return ['炖菜大师', '你是来吃火锅的还是来熬汤的'];
    if (sceneId === 'bros' && s.toastMiss >= 2) return ['领导的眼中钉', '吃得挺香，就是忘了看领导的杯子'];
    if (s.potId === 'yuanyang') {
      if (uses >= 6 && corners >= 0.7) return ['清汤养生派', '不吃辣也能把火锅吃明白'];
      if (uses >= 6 && center >= 0.8) return ['红汤死忠粉', '鸳鸯锅的清汤，你一筷子没碰'];
    } else {
      if (uses >= 6 && center >= 0.6) return ['中间格霸主', '火最旺的地方，永远是你的'];
      if (uses >= 6 && corners >= 0.5) return ['慢炖哲学家', '四个角落才是火锅的灵魂'];
    }
    if (eaten >= 8 && s.veg > s.meat) return ['养生火锅派', '吃火锅也要多吃蔬菜'];
    if (fav && favN >= 4 && favN / eaten >= 0.4 && FAV[fav]) return FAV[fav];
    if (s.stolen === 0 && s.blocked === 0 && eaten >= 6) return ['佛系食客', '没人抢你，你也不抢别人'];
    if (ratio >= 0.4) return ['火锅老手', '有点东西，再练练就能出师'];
    return ['火锅新秀', '下次盯紧一点，别光顾着聊天'];
  };
})();
