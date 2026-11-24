/* 饭局卡：每局开吃前翻一张，决定这桌今天发生了什么。规则变化 + 本局目标（第三颗星）+ 专属人格。 */
var HP = window.HP = window.HP || {};

(function () {
  /* scenes：能在哪些剧本出现；swap：换座位上的人；noSteal：谁今天不抢菜；prefs：谁只点什么；
     extraTray：托盘额外加的菜；bond：需要某人羁绊满级才会出现；
     unlockGames：玩满几局才会出现（难懂的卡不给新手，也不进每日一锅） */
  HP.CARDS = [
    { id: 'heartbreak', name: '老王失恋了', color: '#5b6fa8',
      rule: '老王只点毛肚和肥牛，喂他分数 ×1.5；他今天没心情抢菜', goal: '喂老王 3 块毛肚', need: 3,
      scenes: ['bros', 'family'], noSteal: ['laowang'], prefs: { laowang: ['maodu', 'beef'] }, extraTray: ['maodu', 'beef'] },
    { id: 'diet', name: '闺蜜在减肥', color: '#6fae6a',
      rule: '闺蜜只点素菜；偷偷给她夹肉，她嘴上说不要……', goal: '完成闺蜜 3 单素菜', need: 3,
      scenes: ['bros', 'team'], prefs: { friend: ['lettuce', 'napa', 'tofu', 'lotus', 'potato', 'enoki', 'shiitake', 'gongcai', 'wintermelon'] },
      extraTray: ['lettuce', 'napa'] },
    { id: 'newbie', name: '领导带了新人', color: '#5f8fc6',
      rule: '小美的位置换成了新人。新人等不到菜也不吭声，只会默默失望', goal: '给新人夹 3 块菜', need: 3,
      scenes: ['team'], swap: { friend: 'newbie' } },
    { id: 'blackout', name: '店里停电了', color: '#3a3550',
      rule: '灯全黑了，火力忽大忽小，火候提示也看不见——只能看菜上的小星星', goal: '完美火候 6 块', need: 6, unlockGames: 5,
      scenes: ['bros', 'team', 'date', 'family', 'solo'] },
    { id: 'aa', name: '今天 AA', color: '#9a7b3a',
      rule: '自己吃要按菜价扣分，夹给别人不扣；¥20 以上的贵菜夹给别人分数 ×2', goal: '自己吃了 3 块以上，花费不超过 ¥60', need: 60,
      scenes: ['bros', 'team', 'date', 'family'] },
    { id: 'birthday', name: '生日局', color: '#d4608a',
      rule: '戴生日帽的是寿星。最后几秒一起唱生日歌，唱歌时别动筷子，唱完要干杯', goal: '给寿星夹 2 块菜，唱歌时不动筷', need: 2,
      scenes: ['bros', 'family'] },
    { id: 'proposal', name: '隔壁桌在求婚', color: '#c0587a',
      rule: '中途全桌扭头看热闹 6 秒：没人点单、没人抢菜，这时自己吃分数 ×2', goal: '趁乱吃到 3 块', need: 3,
      scenes: ['bros', 'team', 'date', 'family'] },
    { id: 'freemaodu', name: '周年庆送毛肚', color: '#c7782a',
      rule: '店家送了一大盘毛肚！涮出正宗七上八下分数 ×2', goal: '涮出 2 次七上八下', need: 2,
      scenes: ['bros', 'team', 'date', 'family', 'solo'], extraTray: ['maodu'] },
    { id: 'gfdate', name: '老王带女朋友来了', color: '#b8475a', bond: 'laowang',
      rule: '老王害羞得不敢点菜，闺蜜的位置坐着老王女朋友——替老王好好照顾她', goal: '女朋友的单 3 次完美', need: 3,
      scenes: ['bros'], swap: { friend: 'gf' }, noSteal: ['laowang'], shy: ['laowang'] }
  ];
  HP.cardById = function (id) { for (var i = 0; i < HP.CARDS.length; i++) if (HP.CARDS[i].id === id) return HP.CARDS[i]; return null; };

  /* 这桌能抽哪些卡 */
  HP.cardPool = function (sceneId, profile) {
    return HP.CARDS.filter(function (c) {
      if (c.scenes.indexOf(sceneId) < 0) return false;
      if (c.bond && (!profile || HP.bondLevel(profile, c.bond) < 5)) return false;
      if (c.unlockGames && (!profile || (profile.games || 0) < c.unlockGames)) return false;
      return true;
    });
  };
  /* 抽一张：羁绊卡解锁后有 35% 概率出现；每日一锅用种子抽，所有人同一张 */
  HP.pickCard = function (sceneId, profile, r) {
    r = r || Math.random;
    var pool = HP.cardPool(sceneId, profile);
    if (!pool.length) return null;
    var bond = pool.filter(function (c) { return c.bond; });
    if (bond.length && r() < 0.35) return bond[0];
    pool = pool.filter(function (c) { return !c.bond; });
    return pool[Math.floor(r() * pool.length)];
  };

  /* 本局目标进度：{ cur, need, done, text } */
  HP.cardProgress = function (card, s) {
    if (!card) return null;
    var cur, done;
    if (card.id === 'blackout') cur = s.perfect;
    else if (card.id === 'freemaodu') cur = s.authentic;
    else if (card.id === 'aa') {
      done = s.self >= 3 && s.selfSpend <= card.need;
      return { cur: s.selfSpend, need: card.need, done: done, text: '自己吃 ' + s.self + ' 块 · 花了 ¥' + s.selfSpend + ' / ¥' + card.need };
    } else if (card.id === 'birthday') {
      done = s.cardGoal >= card.need && !s.songBreak;
      return { cur: s.cardGoal, need: card.need, done: done, text: '给寿星夹 ' + Math.min(s.cardGoal, card.need) + ' / ' + card.need + (s.songBreak ? ' · 唱歌时动筷了' : '') };
    } else cur = s.cardGoal;
    done = cur >= card.need;
    return { cur: cur, need: card.need, done: done, text: card.goal + ' ' + Math.min(cur, card.need) + '/' + card.need };
  };

  /* 三颗星：吃饱了 / 大家都满意 / 完成饭局卡目标 */
  HP.starsOf = function (s, card) {
    var one = s.self >= 4;
    var two = s.orders ? s.ordersDone / s.orders >= 0.6 : (s.self ? s.perfect / s.self >= 0.6 : false);
    var p = HP.cardProgress(card, s), three = !!(p && p.done);
    return [one, two, three];
  };
  HP.STAR_TEXT = ['吃饱了', '大家都满意', '完成饭局目标'];
})();
