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
    { id: 'score_3000', name: '火锅高手', desc: '一局拿到 3000 分', coins: 200, test: function (t, s) { return s.score >= 3000; } },
    { id: 'score_6000', name: '火锅之神', desc: '一局拿到 6000 分', coins: 500, test: function (t, s) { return s.score >= 6000; } },
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
      v: 2, rules: HP.RULES, personas: {}, tutorialDone: false, best: 0, bestBy: {}, games: 0, coins: 0,
      unlocked: HP.FOOD_ORDER.filter(function (id) { return !HP.FOODS[id].unlock; }),
      loadout: null,
      totals: { perfect: 0, authentic: 0, blocked: 0, stolen: 0, served: 0, toastOk: 0, eaten: 0, raw: 0 },
      perfectBy: {}, ach: {}, streak: { last: 0, n: 0 }, daily: { day: 0, best: 0, plays: 0 }, lastPlayDay: 0, seen: {}, pots: ['jiugong'], pot: 'jiugong',
      stars: {}, cardStars: {}, bond: {}, moments: [], bondSeen: {}
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
    // 计分规则改过（防刷分），旧规则下的最高分不再算数
    if ((old.rules || 1) < HP.RULES) { p.best = 0; p.bestBy = {}; p.daily.best = 0; p.rulesReset = true; }
    p.rules = HP.RULES;
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
    var wd = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100).getDay();
    return { seed: seed, menu: menu, scene: HP.DAILY_SCENES[wd], pot: r() < 0.34 ? 'yuanyang' : 'jiugong' };
  };
  /* 今日饭局期数：从上线那天算第 1 期 */
  HP.issueOf = function (day) {
    var d = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100), s = new Date(2026, 10, 23);
    return '第 ' + (Math.round((d - s) / 864e5) + 1) + ' 期';
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
    if (s.score > (p.bestBy[bestKey] || 0) && s.score > 0 && !ctx.practice) {
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
    // 每日一锅：只有当天第一局算今日成绩，之后是练习
    if (ctx.daily) {
      if (p.daily.day !== today) { p.daily.day = today; p.daily.best = 0; p.daily.plays = 0; }
      if (!p.daily.plays) { p.daily.best = s.score; p.daily.stars = s.stars || 0; out.dailyFirst = true; }
      p.daily.plays++;
    }
    // 星级：剧本、饭局卡各记最高
    if (s.stars != null) {
      if (s.stars > (p.stars[ctx.scene] || 0)) p.stars[ctx.scene] = s.stars;
      if (s.card && s.stars > (p.cardStars[s.card] || 0)) p.cardStars[s.card] = s.stars;
    }

    // 累计数据
    var oldTitle = HP.titleOf(p), T = p.totals;
    T.perfect += s.perfect; T.authentic += s.authentic; T.blocked += s.blocked; T.stolen += s.stolen;
    T.served += s.served; T.toastOk += s.toastOk; T.eaten += s.eaten; T.raw += s.raw;
    for (k in s.perfectBy) if (s.perfectBy.hasOwnProperty(k)) p.perfectBy[k] = (p.perfectBy[k] || 0) + s.perfectBy[k];
    p.games++;
    out.cardUp = HP.CARDS.filter(function (c) { return c.unlockGames === p.games; });
    var newTitle = HP.titleOf(p);
    if (newTitle !== oldTitle) out.titleUp = newTitle;

    // 成就
    HP.ACHIEVEMENTS.forEach(function (a) {
      if (!p.ach[a.id] && a.test(T, s, p)) { p.ach[a.id] = 1; out.ach.push(a); out.coins += a.coins; out.lines.push(['成就 · ' + a.name, a.coins]); }
    });
    p.coins += out.coins;
    return out;
  };

  /* ---------- 饭局人格：看你这局怎么吃、怎么照顾人，不只看分数 ----------
     rare：N 普通 / R 稀有 / SR 罕见 / SSR 传说；best / worst：最佳饭搭子、千万别一起吃 */
  HP.PERSONAS = [
    { id: 'trip', name: '见过小人的人', line: '见手青没熟就吃，现在看什么都在跳舞', rare: 'SR', best: 'yangsheng', worst: 'shengchi',
      test: function (s) { return s.trip >= 1; } },
    { id: 'shilian', name: '失恋陪护师', line: '老王哭了一晚上，你喂了他一晚上毛肚', rare: 'SR', best: 'laomazi', worst: 'ganfan', card: 'heartbreak',
      hint: '也许在老王最难过的时候……', test: function (s) { return s.card === 'heartbreak' && s.cardGoal >= 3; } },
    { id: 'jianfei', name: '减肥破坏者', line: '她说不要，你说再吃一口', rare: 'SR', best: 'roushi', worst: 'yangsheng', card: 'diet',
      hint: '闺蜜减肥的时候，偷偷……', test: function (s) { return s.card === 'diet' && s.dietCheat >= 2; } },
    { id: 'yinlu', name: '职场引路人', line: '新人记住了你，你是 TA 的第一位好前辈', rare: 'SR', best: 'mianao', worst: 'hushi', card: 'newbie',
      hint: '公司来了新人……', test: function (s) { return s.card === 'newbie' && s.cardGoal >= 3; } },
    { id: 'heian', name: '黑暗火候师', line: '灯都灭了，你的火候还是一秒不差', rare: 'SR', best: 'huohou', worst: 'shengchi', card: 'blackout',
      hint: '看不见的时候也能……', test: function (s) { return s.card === 'blackout' && s.perfect >= 6; } },
    { id: 'aa', name: 'AA 战士', line: '这顿饭你只花了一份毛肚钱，吃得一点不少', rare: 'SR', best: 'guicai', worst: 'laomazi', card: 'aa',
      hint: '有人提议 AA 的时候……', test: function (s) { return s.card === 'aa' && s.self >= 3 && s.selfSpend <= 60; } },
    { id: 'shengri', name: '生日宴主持人', line: '歌唱得齐，菜夹得勤，寿星感动哭了', rare: 'SR', best: 'qifen', worst: 'moyu', card: 'birthday',
      hint: '有人过生日的时候……', test: function (s) { return s.card === 'birthday' && s.cardGoal >= 2 && !s.songBreak && s.songOk >= 1; } },
    { id: 'chenluan', name: '趁乱干饭人', line: '全场都在看求婚，只有你在认真吃', rare: 'SR', best: 'ganfan', worst: 'qifen', card: 'proposal',
      hint: '别人都在看热闹的时候……', test: function (s) { return s.card === 'proposal' && s.propEat >= 3; } },
    { id: 'zhugong', name: '神助攻', line: '老王的终身大事，有一半功劳是你的', rare: 'SSR', best: 'laomazi', worst: 'ganfan', card: 'gfdate',
      hint: '老王有一天会带一个人来……', test: function (s) { return s.card === 'gfdate' && s.cardGoal >= 3; } },
    { id: 'tianxuan', name: '天选饭搭子', line: '技术好、会照顾人、还不抢菜，谁不想跟你吃火锅', rare: 'SSR', best: 'tianxuan', worst: 'ganfan',
      test: function (s, x) { return s.orders >= 4 && x.serveRatio >= 0.3 && x.serveRatio <= 0.75 && x.perfRate >= 0.7 && s.orderMiss <= 1 && !s.toastMiss && !s.speechBreak && s.score >= 2200; } },
    { id: 'danshen', name: '单身原因找到了', line: '相亲对象饿着肚子，你吃得满嘴流油', rare: 'R', best: 'ganfan', worst: 'laomazi',
      test: function (s) { return s.sceneId === 'date' && s.self >= 6 && (s.servedTo.date || 0) <= 1; } },
    { id: 'xiangqin', name: '相亲成功体质', line: '一顿火锅的功夫，对面已经在偷偷看你了', rare: 'R', best: 'laomazi', worst: 'danshen',
      test: function (s) { return s.sceneId === 'date' && (s.servedTo.date || 0) >= 4 && s.servedBad <= 1; } },
    { id: 'bieren', name: '别人家的孩子', line: '七大姑逢人就夸你，表哥压力很大', rare: 'R', best: 'qifen', worst: 'moyu',
      test: function (s) { return s.sceneId === 'family' && (s.servedTo.auntie || 0) >= 3 && !s.speechBreak; } },
    { id: 'duanshui', name: '端水大师', line: '一碗水端得比锅底还平', rare: 'SR', best: 'qifen', worst: 'hushi',
      test: function (s, x) { return x.diners >= 2 && x.minFed >= 3 && x.maxFed - x.minFed <= 1; } },
    { id: 'tianpin', name: '甜品胃', line: '火锅里涮草莓，你是认真的吗', rare: 'SR', best: 'trip', worst: 'qishang',
      test: function (s) { return s.strawberry >= 2; } },
    { id: 'qishang', name: '七上八下传承人', line: '四川老师傅看了都点头', rare: 'SR', best: 'huohou', worst: 'tianpin',
      test: function (s) { return s.authentic >= 3; } },
    { id: 'huohou', name: '火候强迫症', line: '差一秒都不行，你对毛肚比对对象还认真', rare: 'SR', best: 'qishang', worst: 'xiedian',
      test: function (s, x) { return x.total >= 8 && x.perfRate >= 0.9; } },
    { id: 'laomazi', name: '老妈子', line: '自己没吃两口，全桌都被你喂饱了', rare: 'R', best: 'ganfan', worst: 'hushi',
      test: function (s, x) { return s.served >= 5 && x.serveRatio >= 0.6; } },
    { id: 'mianao', name: '领导的小棉袄', line: '领导的杯子就没空过，升职加薪指日可待', rare: 'R', best: 'qifen', worst: 'shekong',
      test: function (s) { return (s.servedTo.boss || 0) >= 3 && s.toastOk >= 1 && !s.toastMiss; } },
    { id: 'shekong', name: '社恐涮菜机', line: '不说话，只涮菜，用毛肚表达爱', rare: 'R', best: 'qifen', worst: 'mianao',
      test: function (s) { return s.toastMiss >= 1 && !s.toastOk && s.served >= 3; } },
    { id: 'qifen', name: '气氛组组长', line: '饭桌上最会来事的就是你', rare: 'R', best: 'shekong', worst: 'moyu',
      test: function (s) { return s.toastOk + s.speechOk >= 2 && !s.toastMiss && !s.speechBreak && s.ordersDone >= 3; } },
    { id: 'hushi', name: '护食战神', line: '在你面前，没人夹得走一片肉', rare: 'R', best: 'beiqiang', worst: 'laomazi',
      test: function (s) { return s.blocked >= 4; } },
    { id: 'beiqiang', name: '被抢专业户', line: '你涮的每一片肉，都进了别人的嘴', rare: 'N', best: 'hushi', worst: 'ganfan',
      test: function (s) { return s.stolen >= 3; } },
    { id: 'shengchi', name: '生吃挑战者', line: '不熟也敢吃，胃是铁打的', rare: 'N', best: 'xiedian', worst: 'huohou',
      test: function (s) { return s.raw + s.rawServed >= 3; } },
    { id: 'xiedian', name: '鞋垫制造机', line: '你的耐心，让每片肉都变成了鞋垫', rare: 'N', best: 'shengchi', worst: 'huohou',
      test: function (s) { return s.over >= 4; } },
    { id: 'jinzhengu', name: '金针菇缠斗者', line: '跟金针菇纠缠了一整局，赢了吗', rare: 'R', best: 'yangsheng', worst: 'roushi',
      test: function (s) { return s.enoki >= 3; } },
    { id: 'ganfan', name: '干饭王', line: '火锅局？不，是我的个人自助餐', rare: 'N', best: 'laomazi', worst: 'tianxuan',
      test: function (s, x) { return s.self >= 8 && x.serveRatio <= 0.15; } },
    { id: 'guicai', name: '贵菜鉴赏家', line: '只挑贵的，这顿 AA 谁也别想占你便宜', rare: 'R', best: 'roushi', worst: 'yangsheng',
      test: function (s) { return s.self >= 5 && s.expSelf / s.self >= 0.5; } },
    { id: 'roushi', name: '肉食动物', line: '青菜？那是锅底的装饰', rare: 'N', best: 'yangsheng', worst: 'yangsheng',
      test: function (s) { return s.self >= 6 && s.meat / s.self >= 0.85; } },
    { id: 'yangsheng', name: '养生派', line: '来火锅店吃了一顿沙拉', rare: 'N', best: 'roushi', worst: 'guicai',
      test: function (s) { return s.self >= 5 && s.veg / s.self >= 0.6; } },
    { id: 'moyu', name: '摸鱼食客', line: '来了，坐了，吃了两口，走了', rare: 'N', best: 'laomazi', worst: 'qifen',
      test: function (s, x) { return x.total <= 5; } },
    { id: 'suiyuan', name: '随缘干饭人', line: '不争不抢，吃得开心最重要', rare: 'N', best: 'hushi', worst: 'huohou',
      test: function () { return true; } }
  ];
  /* 图鉴里没拿过的人格给一句模糊线索 */
  var HINTS = {
    trip: '跟某种蘑菇有关……', tianxuan: '什么都做得刚刚好的人', danshen: '相亲的时候只顾着自己吃', xiangqin: '相亲的时候很会照顾人',
    bieren: '家宴上，七大姑最喜欢的那种孩子', duanshui: '每个人都照顾得一样多', tianpin: '火锅里出现了不该出现的水果', qishang: '毛肚涮得特别讲究',
    huohou: '几乎每一块都是完美', laomazi: '自己不吃，一直给别人夹', mianao: '很会照顾领导', shekong: '不接酒，只会默默给人夹菜',
    qifen: '敬酒、讲话一个不落', hushi: '谁的筷子都别想伸过来', beiqiang: '总是被人抢', shengchi: '不熟也敢吃', xiedian: '煮得太久了',
    jinzhengu: '跟某种菜缠斗', ganfan: '只顾自己吃', guicai: '只挑贵的吃', roushi: '一口青菜都不碰', yangsheng: '素菜吃得比肉多',
    moyu: '一局只动了几筷子', suiyuan: '什么都不特别'
  };
  HP.PERSONAS.forEach(function (x) { if (!x.hint) x.hint = HINTS[x.id] || ''; });

  /* 差一点就是另一个人格：只差一项、差得不多时，告诉玩家差什么 */
  var NEAR = {
    mianao: function (s) { var b = s.servedTo.boss || 0; return b === 2 && !s.toastMiss ? '再给领导夹 1 块' : null; },
    laomazi: function (s, x) { return s.served >= 3 && x.serveRatio >= 0.45 && x.serveRatio < 0.6 ? '再多喂别人几块，少吃两口' : null; },
    qishang: function (s) { return s.authentic === 2 ? '再涮 1 次正宗七上八下' : null; },
    huohou: function (s, x) { return x.total >= 8 && x.perfRate >= 0.78 && x.perfRate < 0.9 ? '完美率再高一点（这局 ' + Math.round(x.perfRate * 100) + '%，要 90%）' : null; },
    hushi: function (s) { return s.blocked === 3 ? '再挡 1 双筷子' : null; },
    duanshui: function (s, x) { return x.diners >= 2 && x.minFed >= 2 && x.maxFed - x.minFed <= 2 && !(x.minFed >= 3 && x.maxFed - x.minFed <= 1) ? '每个人都照顾得再平均一点' : null; },
    qifen: function (s) { return s.toastOk + s.speechOk === 1 && !s.toastMiss && !s.speechBreak ? '再接一次酒、或者认真听一次讲话' : null; },
    tianxuan: function (s, x) { return s.orders >= 4 && x.serveRatio >= 0.3 && x.serveRatio <= 0.75 && x.perfRate >= 0.6 && s.score >= 1600 && s.orderMiss <= 2 ? '再稳一点，就是传说人格' : null; },
    xiangqin: function (s) { return s.sceneId === 'date' && (s.servedTo.date || 0) === 3 ? '再给相亲对象夹 1 块' : null; },
    bieren: function (s) { return s.sceneId === 'family' && (s.servedTo.auntie || 0) === 2 && !s.speechBreak ? '再给七大姑夹 1 块' : null; }
  };
  HP.nearPersona = function (s, got, owned) {
    var x = HP.personaMetrics(s), best = null, order = { SSR: 4, SR: 3, R: 2, N: 1 };
    HP.PERSONAS.forEach(function (p) {
      if (p.id === got.id) return;
      var txt = null;
      if (p.card) { if (s.card === p.card) { var C = HP.cardById(p.card), pr = HP.cardProgress(C, s); if (pr && !pr.done && pr.need - pr.cur === 1) txt = '饭局目标只差 1 次'; } }
      else if (NEAR[p.id]) txt = NEAR[p.id](s, x);
      if (!txt) return;
      var score = order[p.rare] + (owned[p.id] ? 0 : 5);
      if (!best || score > best.score) best = { p: p, text: txt, score: score };
    });
    return best;
  };
  HP.RARE = { N: '普通', R: '稀有', SR: '罕见', SSR: '传说' };
  HP.personaById = function (id) { for (var i = 0; i < HP.PERSONAS.length; i++) if (HP.PERSONAS[i].id === id) return HP.PERSONAS[i]; return null; };
  HP.personaMetrics = function (s) {
    var total = s.self + s.served, fed = [], k;
    for (k in s.servedTo) if (s.servedTo.hasOwnProperty(k)) fed.push(s.servedTo[k]);
    var dn = (HP.SCENES[s.sceneId] && HP.SCENES[s.sceneId].diners) || [];
    while (fed.length < dn.length) fed.push(0);
    return { total: total, serveRatio: total ? s.served / total : 0, perfRate: total ? s.perfect / total : 0,
             diners: dn.length, minFed: fed.length ? Math.min.apply(null, fed) : 0, maxFed: fed.length ? Math.max.apply(null, fed) : 0 };
  };
  HP.persona = function (s) {
    var x = HP.personaMetrics(s);
    for (var i = 0; i < HP.PERSONAS.length; i++) if (HP.PERSONAS[i].test(s, x)) return HP.PERSONAS[i];
    return HP.PERSONAS[HP.PERSONAS.length - 1];
  };
})();
