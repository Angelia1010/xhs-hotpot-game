/* 饭后朋友圈 + 同桌羁绊：吃完饭，同桌的人可能会发一条朋友圈；羁绊升级会发剧情朋友圈。 */
var HP = window.HP = window.HP || {};

(function () {
  HP.BOND_LV = [1, 8, 20, 36, 56];          // 达到这些羁绊值就升到 Lv1~Lv5
  HP.BOND_IDS = ['laowang', 'friend', 'boss', 'date', 'auntie'];
  HP.bondLevel = function (p, id) {
    var v = (p.bond && p.bond[id]) || 0, lv = 0;
    for (var i = 0; i < HP.BOND_LV.length; i++) if (v >= HP.BOND_LV[i]) lv = i + 1;
    return lv;
  };

  /* 羁绊剧情：每人 5 条，升一级发一条（img 是可选配图） */
  HP.STORY = {
    laowang: [
      { t: '新认识一个饭搭子，涮毛肚比我还讲究，以后火锅局必须叫上', img: 'moment_laowang_1' },
      { t: '跟兄弟吃火锅，被 TA 挡了三次筷子。行，你赢了' },
      { t: '最近有点烦……还好有火锅，还好有你们' },
      { t: '跟大家说个事：我谈恋爱了！下次带她来见你们', img: 'moment_laowang_2' },
      { t: '带女朋友见了我最好的饭搭子，她说你涮毛肚比我强。我认了', img: 'moment_gf_1', unlock: '解锁饭局卡「老王带女朋友来了」' }
    ],
    friend: [
      { t: '认识了一个超会涮菜的人，以后吃火锅有着落了', img: 'moment_friend_1' },
      { t: '我宣布：TA 是我的专属涮菜师' },
      { t: '减肥第三天，被 TA 一块肥牛击溃' },
      { t: '吵架了，但 TA 给我涮了一块嫩牛肉。原谅了', img: 'moment_friend_2' },
      { t: '一辈子的饭搭子，就是你了' }
    ],
    boss: [
      { t: '今天团建，新同事挺有眼力见', img: 'moment_boss_1' },
      { t: '年轻人涮毛肚，七上八下，有板有眼' },
      { t: '转发：《职场中如何发现接班人》', img: 'moment_boss_2' },
      { t: '提名优秀员工一名，理由：很会照顾人' },
      { t: '退休前最后一次团建，有你们真好' }
    ],
    date: [
      { t: '今天相亲，对方一直帮我夹菜……', img: 'moment_date_1' },
      { t: '第二次见面，还是约了火锅' },
      { t: 'TA 记得我不吃香菜' },
      { t: '（配图）', img: 'moment_date_2' },
      { t: '今天开始，有人陪我吃一辈子火锅了' }
    ],
    auntie: [
      { t: '我家孩子真懂事，知道给长辈夹菜', img: 'moment_auntie_1' },
      { t: '孩子给我涮的冬瓜，软乎乎的，好吃' },
      { t: '给孩子介绍了个对象，下周见面' },
      { t: '孩子说不着急结婚，姑也不催了，多吃点' },
      { t: '全家福！今年最开心的一顿饭', img: 'moment_auntie_2' }
    ]
  };

  /* 普通饭后朋友圈：按这局发生的事挑一条 */
  function roundCandidates(s, diners) {
    var C = [], byId = {};
    diners.forEach(function (d) { byId[d.id] = d; });
    function add(id, t, w, img) { if (byId[id]) C.push({ who: id, t: t, w: w, img: img }); }
    var card = s.card;
    if (card === 'heartbreak') add('laowang', s.cardGoal >= 3 ? '谢谢兄弟陪我，毛肚管够，心不痛了' : '失恋了，连毛肚都不香了……', 5);
    if (card === 'diet') add('friend', s.dietCheat ? '说好的减肥呢……都怪 TA 一直给我夹肉' : '减肥餐也可以很快乐！', 5, 'moment_friend_1');
    if (card === 'newbie') add('newbie', s.cardGoal >= 2 ? '入职第一顿饭，前辈一直给我夹菜，好感动' : '入职第一顿团建，有点紧张……', 6, 'moment_newbie_1');
    if (card === 'birthday' && s.bdId) add(s.bdId, s.songBreak ? '生日歌唱到一半有人在偷吃，笑死' : '今年生日最开心的一天，谢谢大家', 6);
    if (card === 'proposal') add(diners[0] && diners[0].id, '隔壁求婚成功了！而某人全程在干饭', 4);
    if (card === 'aa') add('laowang', 'AA 制吃出了自助餐的感觉，有人很会算账', 4);
    if (card === 'blackout') add(diners[0] && diners[0].id, '吃到一半停电了，黑灯瞎火也挡不住吃火锅', 3);
    if (card === 'freemaodu') add('laowang', '周年庆送了一大盘毛肚，今天赚到了', 3, 'moment_laowang_1');
    if (card === 'gfdate') add('gf', '第一次见老王的朋友，人超好，还很会涮菜', 7, 'moment_gf_1');
    if (s.tripServed) diners.forEach(function (d) { if ((s.servedTo[d.id] || 0) > 0) add(d.id, '吃了一口没熟的见手青，看到了小人在锅边跳舞……', 8); });
    if (s.stolen >= 2) add('laowang', '今天从兄弟锅里抢了 ' + s.stolen + ' 块肉，爽', 4, 'moment_laowang_1');
    if (s.authentic && byId.laowang && (s.servedTo.laowang || 0) > 0) add('laowang', '兄弟给我涮了个正宗七上八下，值了', 3);
    if ((s.servedTo.boss || 0) >= 2) add('boss', '今天的火锅，火候很到位', 3, 'moment_boss_2');
    if ((s.servedTo.date || 0) >= 3) add('date', '今天吃得很开心，对面的人一直在照顾我', 4, 'moment_date_2');
    if (s.sceneId === 'date' && (s.servedTo.date || 0) <= 1 && s.self >= 5) add('date', '相亲对象很能吃……', 4, 'moment_date_1');
    if ((s.servedTo.auntie || 0) >= 2) add('auntie', '我家孩子知道给长辈夹菜，懂事', 3, 'moment_auntie_1');
    if ((s.servedTo.friend || 0) >= 3) add('friend', '有个会涮菜的朋友是什么体验？就是幸福', 3, 'moment_friend_2');
    if (s.orderMiss >= 3) diners.forEach(function (d) { add(d.id, '点了菜一直没等到，饿着肚子回家了', 2); });
    if (s.sceneId === 'team' && s.speechBreak) add('boss', '讲话的时候有人在偷偷夹菜，年轻人啊', 4);
    return C;
  }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function likesOf(diners, who, r) {
    return diners.filter(function (d) { return d.id !== who && r() < 0.75; }).map(function (d) { return d.name; });
  }
  var REPLY = ['哈哈哈哈', '下次还约', '羡慕', '我也要吃', '给我留点', '笑死', '确实', '哈哈谁啊'];

  /* 一局结束：更新羁绊，产出 0~2 条朋友圈（升级剧情优先） */
  HP.afterMeal = function (p, s, diners, sceneName, r) {
    r = r || Math.random;
    var posts = [], ups = [], day = HP.dayKey();
    p.bond = p.bond || {}; p.moments = p.moments || [];
    diners.forEach(function (d) {
      if (HP.BOND_IDS.indexOf(d.id) < 0) return;
      var before = HP.bondLevel(p, d.id);
      p.bond[d.id] = Math.max(0, (p.bond[d.id] || 0) + Math.max(-2, d.aff) + (d.fed ? 1 : 0));
      var after = HP.bondLevel(p, d.id);
      for (var lv = before + 1; lv <= after; lv++) {
        var st = HP.STORY[d.id][lv - 1];
        ups.push({ who: d.id, name: d.name, t: st.t, img: st.img, lv: lv, unlock: st.unlock || null });
      }
    });
    ups.slice(0, 2).forEach(function (u) { posts.push(u); });
    if (!posts.length) {
      var C = roundCandidates(s, diners), sum = 0;
      var fedSum = diners.reduce(function (a, d) { return a + Math.max(0, d.aff); }, 0);
      var chance = Math.min(0.7, 0.4 + fedSum * 0.04);
      if (C.length && r() < chance) {
        C.forEach(function (c) { sum += c.w; });
        var x = r() * sum, c0 = C[0];
        for (var i = 0; i < C.length; i++) { x -= C[i].w; if (x <= 0) { c0 = C[i]; break; } }
        var dn = diners.filter(function (d) { return d.id === c0.who; })[0];
        posts.push({ who: c0.who, name: dn ? dn.name : HP.DINERS[c0.who].name, t: c0.t, img: c0.img });
      }
    }
    posts.forEach(function (m) {
      m.likes = likesOf(diners, m.who, r);
      var others = diners.filter(function (d) { return d.id !== m.who; });
      if (others.length && r() < 0.6) m.reply = { name: pick(others, r).name, t: pick(REPLY, r) };
      m.day = day; m.scene = sceneName;
      p.moments.unshift(m);
    });
    if (p.moments.length > 50) p.moments.length = 50;
    return { posts: posts, ups: ups };
  };
})();
