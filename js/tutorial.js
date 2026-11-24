/* 新手引导：边玩边教，约 30 秒。每一步等玩家真的做到了才进入下一步。 */
var HP = window.HP = window.HP || {};

(function () {
  function Tutorial(game, ui) {
    this.game = game; this.ui = ui;   // ui: { say(text, opts), glow(id), plateCenter(id), done() }
    this.step = -1; this.timer = null;
  }
  HP.Tutorial = Tutorial;

  Tutorial.prototype.finger = function (nx, ny) {
    var g = this.game, p = g.toScreen(nx, ny);
    return { x: p.x, y: p.y + 54 * g.unit };   // 菜显示在手指上方 54
  };

  /* list：这次要教哪几步（火锅日记每天只教当天的新机制）；不传就是完整教学
     done：最后一步「学会了」的标题和文字 */
  Tutorial.ALL = [0, 1, 2, 3, 4, 5, 6];
  Tutorial.prototype.start = function (list, done) {
    var g = this.game;
    this.list = (list && list.length ? list : Tutorial.ALL).slice(); this.pos = 0; this.done = done || null;
    g.mode = 'tutorial'; g.reset(); g.hints = true; g.tutorialHeat = 1; g.running = true;
    this.go(this.list[0]);
  };
  /* 当前这步学会了：去下一步，教完就是「学会了」 */
  Tutorial.prototype.next = function () {
    this.pos++;
    this.go(this.pos < this.list.length ? this.list[this.pos] : 7);
  };

  /* 步骤编号按这次实际要教的内容算：火锅日记第 1 天只教煮、护食、照顾同桌，就是第 1~3 步 */
  var NAMES = ['涮', '涮', '七上八下', '煮', '煮', '护食', '照顾同桌'];
  Tutorial.prototype.label = function (name) {
    var seen = [], L = this.list || Tutorial.ALL;
    for (var i = 0; i <= this.pos && i < L.length; i++) if (seen.indexOf(NAMES[L[i]]) < 0) seen.push(NAMES[L[i]]);
    if (seen.indexOf(name) < 0) seen.push(name);
    return '第 ' + (seen.indexOf(name) + 1) + ' 步 · ' + name;
  };

  Tutorial.prototype.later = function (ms, fn) {
    var self = this; clearTimeout(this.timer);
    this.timer = setTimeout(function () { fn.call(self); }, ms);
  };

  Tutorial.prototype.go = function (i) {
    var g = this.game, ui = this.ui, self = this;
    this.step = i; g.ghost = null; ui.glow(null);
    var STEPS = [
      function () {
        ui.say(self.label('涮'), '按住「肥牛」拖到锅中间，<b>先别松手</b>');
        ui.glow('beef');
        g.ghost = { mode: 'drag', t: 0, points: function () { return [ui.plateCenter('beef'), self.finger(0.5, 0.5)]; } };
      },
      function () {
        ui.say(self.label('涮'), '按着在汤里涮……<b>颜色变浅棕、圈变绿</b>就松手捞起');
      },
      function () {
        ui.say(self.label('七上八下'), '毛肚讲究<b>七上八下</b>：拖进锅后不松手，<b>上下提放 7~8 次</b>，再松手');
        ui.glow('maodu');
        g.ghost = { mode: 'drag', t: 0, points: function () { return [ui.plateCenter('maodu'), self.finger(0.5, 0.5)]; } };
      },
      function () {
        ui.say(self.label('煮'), '「煮」的菜不用按着：把<b>午餐肉</b>拖进锅里就<b>松手</b>');
        ui.glow('luncheon');
        g.ghost = { mode: 'drag', t: 0, points: function () { return [ui.plateCenter('luncheon'), self.finger(0.27, 0.5)]; } };
      },
      function () {
        ui.say(self.label('煮'), '盯着它：<b>颜色变了、圈变绿</b>，点一下捞起来');
        g.tutorialHeat = 2.2;
        g.ghost = { mode: 'tap', t: 0, points: function () {
          var f = g.foods.filter(function (x) { return x.state === 'in' && x.d >= HP.FOODS[x.type].a; })[0];
          return f ? [g.toScreen(f.nx, f.ny)] : [];
        } };
      },
      function () {
        g.tutorialHeat = 1;
        // 放一块快熟的鸭血，让老王来抢
        var p = g.randomSoupPoint(1, 0.04);
        g.addFood('duckblood', p.nx, p.ny);
        var f = g.foods[g.foods.length - 1]; f.d = HP.FOODS.duckblood.a * 0.9;
        var n = g.npcs[0];
        g.sendNpc(n, f, 2.6);
        ui.say(self.label('护食'), '老王盯上你的鸭血了！他的筷子伸过来时，<b>点他的筷子挡开</b>');
        g.ghost = { mode: 'tap', t: 0, points: function () {
          if (!n.tip || (n.phase !== 'warn' && n.phase !== 'reach')) return [];
          return [{ x: n.tip.x + n.dir.x * g.potSize * 0.05, y: n.tip.y + n.dir.y * g.potSize * 0.05 }];
        } };
      },
      function () {
        // 闺蜜点单：锅里放一块快熟的午餐肉，教「拖给 TA」
        var fr = g.diners.filter(function (x) { return x.id === 'friend'; })[0] || g.diners[0];
        var p = g.randomSoupPoint(3, 0.04);
        g.addFood('luncheon', p.nx, p.ny);
        var f = g.foods[g.foods.length - 1]; f.d = HP.FOODS.luncheon.a + 1;
        fr.order = { type: 'luncheon', auth: false, t: 0, ttl: 999 };
        g.dinerSay(fr, '帮我夹块午餐肉嘛~', 3);
        ui.say(self.label('照顾同桌'), '闺蜜点了午餐肉：<b>按住锅里的午餐肉，拖到她头像上</b>');
        g.ghost = { mode: 'drag', t: 0, points: function () {
          var q = g.foods.filter(function (x) { return x.state === 'in' && x.type === 'luncheon'; })[0];
          return q ? [g.toScreen(q.nx, q.ny), { x: fr.x, y: fr.y }] : [];
        } };
      },
      function () {
        var D = self.done;
        ui.say(D ? D.title : '学会了！', D ? D.text : '一局 <b>60 秒</b>：同桌点的菜涮好了拖给 TA，自己也别饿着。吃完测你是<b>哪种饭搭子</b>', { button: '开吃' });
      }
    ];
    STEPS[i]();
  };

  Tutorial.prototype.onAction = function (name, d) {
    var s = this.step;
    if (s === 0 && name === 'holdEnter' && d.type === 'beef') this.next();
    else if (s === 1 && name === 'holdRelease') {
      this.ui.say(this.label('涮'), d.kind === 'perfect' ? '<b>漂亮！</b>就是这个火候' : d.kind === 'raw' ? '还生着呢，下次多涮一会儿' : '差不多就是这样，下次盯紧颜色');
      this.later(1300, function () { this.next(); });
    }
    else if ((s === 0 || s === 1) && name === 'holdCancel') { this.pos = this.list.indexOf(0); this.go(0); }
    else if (s === 2 && name === 'holdEnter' && d.type === 'maodu') {
      var self = this, g = this.game;
      this.ui.say(this.label('七上八下'), '手指<b>往上提、再放下</b>算一次，头顶会计数');
      g.ghost = { mode: 'updown', t: 0, points: function () { return g.hold ? [{ x: g.hold.x, y: g.hold.y }] : []; } };
    }
    else if (s === 2 && name === 'holdRelease' && d.type === 'maodu') {
      this.ui.say(this.label('七上八下'), d.dips >= 7 && d.dips <= 8 ? '<b>正宗七上八下！</b>这块值 150 分' : '提放了 ' + d.dips + ' 次，7~8 次才算正宗');
      this.later(1500, function () { this.next(); });
    }
    else if (s === 3 && name === 'drop') this.next();
    else if (s === 4 && name === 'pick') {
      this.ui.say(this.label('煮'), d.kind === 'perfect' ? '<b>完美！</b>煮的菜就这么捞' : '捞起来了！下次等圈变绿再点');
      this.later(1300, function () { this.next(); });
    }
    else if (s === 5 && (name === 'block' || name === 'stolen')) {
      this.game.ghost = null;
      this.ui.say(this.label('护食'), name === 'block' ? '<b>挡住了！</b>正式开吃时同桌会更快' : '被抢走了……正式开吃时手要更快');
      this.later(1500, function () { this.next(); });
    }
    else if (s === 6 && name === 'serve') {
      this.game.ghost = null;
      this.ui.say(this.label('照顾同桌'), d.match && d.kind === 'perfect' ? '<b>送达！</b>点的菜涮得好，分最高' : '夹过去了！点的菜火候好，分更高');
      this.later(1500, function () { this.next(); });
    }
    else if (s === 6 && name === 'pick') {
      this.ui.say(this.label('照顾同桌'), '哈哈你自己吃掉了，再试一次：<b>按住不放，拖到闺蜜头像上</b>');
      this.later(1600, function () { this.go(6); });
    }
  };

  Tutorial.prototype.stop = function () {
    clearTimeout(this.timer); this.step = -1;
    this.game.ghost = null; this.ui.glow(null);
  };
})();
