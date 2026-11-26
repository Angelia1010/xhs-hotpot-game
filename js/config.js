/* 游戏数值与素材配置。改数值只需要动这个文件。 */
var HP = window.HP = window.HP || {};

/* 锅底：汤面椭圆 + 分区。分区可以是九宫格的矩形，也可以是鸳鸯锅被 S 形隔板分开的两半。
   heat 火力倍率；mul 得分倍率；tint 菜泡在汤里时盖的颜色 */
HP.POTS = {
  jiugong: {
    name: '九宫格', img: 'pot', ell: { cx: 0.497, cy: 0.503, rx: 0.356, ry: 0.366 },
    kind: 'grid', vx: [0.366, 0.625], hy: [0.371, 0.615], half: 0.013,
    heat: [0.6, 1.0, 0.6, 1.0, 1.5, 1.0, 0.6, 1.0, 0.6],
    mul: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    tint: ['120,8,2', '120,8,2', '120,8,2', '120,8,2', '120,8,2', '120,8,2', '120,8,2', '120,8,2', '120,8,2'],
    labels: [[4, '火最大', '#ffd35c'], [0, '火小', '#9fd8ff'], [2, '火小', '#9fd8ff'], [6, '火小', '#9fd8ff'], [8, '火小', '#9fd8ff']],
    center: [4], corners: [0, 2, 6, 8], edges: [0, 2, 6, 8], cap: 2
  },
  yuanyang: {
    name: '鸳鸯锅', img: 'pot_yuanyang', ell: { cx: 0.495, cy: 0.5, rx: 0.352, ry: 0.372 },
    kind: 'split', half: 0.016,
    // S 形隔板中线：[y, x]（相对锅图）
    divider: [[0.100, 0.542], [0.146, 0.518], [0.195, 0.483], [0.244, 0.464], [0.293, 0.457], [0.342, 0.464], [0.391, 0.483],
              [0.439, 0.508], [0.488, 0.532], [0.537, 0.547], [0.586, 0.550], [0.635, 0.542], [0.684, 0.525], [0.732, 0.500],
              [0.781, 0.477], [0.830, 0.454], [0.880, 0.437], [0.900, 0.430]],
    heat: [1.25, 0.75], mul: [1, 1.3], tint: ['120,8,2', '150,118,40'],
    labels: [[0, '红汤 熟得快', '#ffd35c'], [1, '清汤 分×1.3', '#ffe9b0']], labelShift: 0.05,
    center: [0], corners: [1], edges: [0, 1], cap: 6, unlock: 800
  }
};
HP.POT_ORDER = ['jiugong', 'yuanyang'];

/* 食材：a~b 为完美窗口（泡在汤里的秒数 × 火力），size 为相对锅宽的显示尺寸
   mode: 'drop' 丢进锅里煮；'swish' 按住在锅里涮，松手捞起
   veg: 素菜（算荤素搭配）；unlock: 解锁价格（没有就是初始菜）
   dips: 上下提放次数窗口（authentic: 算「正宗七上八下」；dipName: 达成时的叫法）；sinker: 生的沉底、熟了浮起
   special: 每道解锁菜自带一个新操作（见 HP.SPECIAL）；tip: 第一次下锅的提示 */
HP.FOODS = {
  beef:          { name: '肥牛',     mode: 'swish', a: 4,  b: 6.5, size: 0.095, price: 15, depth: 0.15 },
  tenderbeef:    { name: '嫩牛肉',   mode: 'swish', a: 3,  b: 5,   size: 0.100, price: 18, depth: 0.15, unlock: 400,
                   special: 'shake', shakes: 3, tip: '嫩牛肉要抖散：涮的时候<b>左右晃 3 下</b>，不然粘成一坨' },
  maodu:         { name: '毛肚',     mode: 'swish', a: 4,  b: 10,  size: 0.105, price: 25, depth: 0.10, dips: [7, 8], authentic: true },
  strawberry_maodu: { name: '草莓毛肚', mode: 'swish', a: 4, b: 10, size: 0.100, price: 30, depth: 0.10, dips: [7, 8], authentic: true, unlock: 1000,
                   special: 'strawberry', tip: '网红梗菜：照样七上八下，吃完川渝人会沉默' },
  duckintestine: { name: '鸭肠',     mode: 'swish', a: 3,  b: 5,   size: 0.115, price: 18, depth: 0.10, unlock: 200,
                   dips: [3, 4], dipName: '三上三下，卷了！', tip: '鸭肠<b>三上三下</b>就卷了：拖进锅后上下提放 3~4 次' },
  goose:         { name: '鹅肠',     mode: 'swish', a: 3.5, b: 5.5, size: 0.115, price: 22, depth: 0.10, unlock: 400,
                   special: 'still', tip: '鹅肠一提就断：拖进锅里<b>按住别上下提</b>' },
  kidney:        { name: '腰片',     mode: 'swish', a: 4,  b: 6.5, size: 0.100, price: 20, depth: 0.12, unlock: 500,
                   special: 'hot', tip: '腰片要在<b>火最大的地方</b>涮，火小了有腥味' },
  huanghou:      { name: '黄喉',     mode: 'drop',  a: 8,  b: 12,  size: 0.110, price: 22, depth: 0.12, unlock: 300,
                   special: 'drift', tip: '黄喉会在锅里<b>漂来漂去</b>，漂到大火格熟得快' },
  shrimp:        { name: '虾滑',     mode: 'drop',  a: 6,  b: 9,   size: 0.075, price: 20, depth: 0.0, sinker: true },
  beefball:      { name: '牛肉丸',   mode: 'drop',  a: 7,  b: 11,  size: 0.075, price: 16, depth: 0.0, sinker: true, unlock: 400,
                   special: 'burst', tip: '牛肉丸熟过头会<b>爆汁</b>：浮起来就赶紧捞' },
  duckblood:     { name: '鸭血',     mode: 'drop',  a: 15, b: 22,  size: 0.080, price: 12, depth: 0.30 },
  luncheon:      { name: '午餐肉',   mode: 'drop',  a: 5,  b: 12,  size: 0.085, price: 8,  depth: 0.12 },
  tofu:          { name: '冻豆腐',   mode: 'drop',  a: 8,  b: 16,  size: 0.085, price: 8,  depth: 0.25, veg: true, unlock: 250,
                   special: 'soak', soak: 6, tip: '冻豆腐<b>越煮越入味</b>：过了火候再等一会儿也是完美' },
  potato:        { name: '土豆片',   mode: 'drop',  a: 8,  b: 15,  size: 0.085, price: 6,  depth: 0.12, veg: true },
  lotus:         { name: '藕片',     mode: 'drop',  a: 6,  b: 12,  size: 0.085, price: 8,  depth: 0.12, veg: true, unlock: 250,
                   special: 'crisp', tip: '藕片要脆：<b>刚变色就捞</b>分最高，捞晚了就面了' },
  lettuce:       { name: '生菜',     mode: 'swish', a: 1,  b: 2.5, size: 0.100, price: 5,  depth: 0.10, veg: true, tip: '生菜烫一下就好，一不留神就蔫了' },
  gongcai:       { name: '贡菜',     mode: 'swish', a: 2,  b: 4,   size: 0.100, price: 8,  depth: 0.10, veg: true, unlock: 200,
                   special: 'share', tip: '贡菜是大家分的：<b>夹给同桌分数 ×2</b>，自己吃只有一半' },
  napa:          { name: '娃娃菜',   mode: 'drop',  a: 9,  b: 18,  size: 0.090, price: 6,  depth: 0.15, veg: true },
  enoki:         { name: '金针菇',   mode: 'drop',  a: 5,  b: 10,  size: 0.090, price: 8,  depth: 0.12, veg: true, unlock: 250,
                   special: 'tangle', tip: '金针菇缠成一团，要<b>点两下</b>才夹得起来' },
  shiitake:      { name: '香菇',     mode: 'drop',  a: 7,  b: 13,  size: 0.085, price: 8,  depth: 0.12, veg: true, unlock: 250,
                   special: 'sink', tip: '香菇熟透会<b>沉下去</b>，沉了就老了' },
  wintermelon:   { name: '冬瓜',     mode: 'drop',  a: 14, b: 24,  size: 0.085, price: 6,  depth: 0.15, veg: true, unlock: 200,
                   special: 'bulky', tip: '冬瓜最慢，还<b>占两个位置</b>，煮到透明再捞' },
  jianshouqing:  { name: '见手青',   mode: 'drop',  a: 10, b: 16,  size: 0.085, price: 30, depth: 0.12, veg: true, unlock: 1000,
                   special: 'trip', tip: '见手青一定要煮熟！没熟就吃会「看见小人」' }
};
/* 特殊玩法的短标签（托盘、菜单里显示） */
HP.SPECIAL = { shake: '要抖散', still: '别提起', hot: '要大火', drift: '会漂', burst: '会爆汁', soak: '越煮越香', crisp: '要脆',
  share: '要分享', sink: '会下沉', bulky: '占两格', tangle: '会缠住', trip: '要煮熟', strawberry: '梗菜' };
HP.dipsOf = function (type) { var F = HP.FOODS[type]; return F.dips ? (F.authentic ? '七上八下' : F.dipName ? '三上三下' : '') : ''; };
HP.slotOf = function (type) { return HP.FOODS[type].special === 'bulky' ? 2 : 1; };
HP.FOOD_ORDER = ['beef', 'tenderbeef', 'maodu', 'strawberry_maodu', 'duckintestine', 'goose', 'kidney', 'huanghou',
  'shrimp', 'beefball', 'duckblood', 'luncheon', 'tofu', 'potato', 'lotus',
  'lettuce', 'gongcai', 'napa', 'enoki', 'shiitake', 'wintermelon', 'jianshouqing'];
HP.VERSION = '1.4.0';
HP.RULES = 5;   // 计分规则版本：改了计分就 +1，旧版最高分作废重算
HP.CROWD = { free: 6, min: 0.3 };   // 锅里超过 6 块菜，火力按 6/块数 分摊（汤不滚了），下再多也不会熟得更多
/* 越贵的菜分越高：¥5 ×0.7 … ¥15 ×1.1 … ¥30 ×1.7 */
HP.ptsOf = function (type) { return Math.round((0.5 + HP.FOODS[type].price * 0.04) * 100) / 100; };
/* 同一道菜一局里吃第几块的得分系数：前 3 块满分，再吃就腻了 */
HP.TIRED = [1, 1, 1, 0.6, 0.4, 0.2];
HP.TIRED_FREE = 3;
HP.BALANCE_BONUS = 80;        // 一局荤素各吃 3 块以上的加分

/* 同桌 NPC：手的素材、从哪一侧伸进来、筷子尖在素材里的位置 */
HP.NPCS = [
  { id: 'laowang', name: '老王', img: 'hand_laowang', side: 'top',   tip: [0.481, 0.999] },
  { id: 'friend',  name: '闺蜜', img: 'hand_friend',  side: 'left',  tip: [0.467, 0.999] },
  { id: 'boss',    name: '领导', img: 'hand_boss',    side: 'right', tip: [0.544, 0.999] }
];

HP.ROUND_TIME = 60;           // 一局秒数：短一点，更想「再来一局」
HP.NPC_FIRST_DELAY = 9;       // 开局多少秒后 NPC 才开始抢
HP.NPC_WARN = 1.1;            // 抢之前的预警时长
HP.HINT_OFF_BONUS = 1.2;      // 关掉火候提示（老手模式）的得分加成

/* 三幕：开局点菜（轻松）→ 高峰（单子叠单子，有人抢、有人敬酒）→ 收尾（放缓，最后一轮） */
HP.PHASES = [
  { until: 15, npc: [10, 14], event: [999, 999], order: [3, 5], maxOrders: 1 },
  { until: 45, npc: [7, 11], event: [9, 13], order: [3, 5.5], maxOrders: 2 },
  { until: 999, npc: [7, 10], event: [8, 11], order: [4, 7], maxOrders: 2 }
];
HP.EVENT_FIRST = 15;          // 第一个突发事件出现时间
HP.ORDER_FIRST = 2.5;         // 第一张单出现时间

/* 突发事件 */
HP.EVENTS = {
  soup:  { text: '服务员：给您加点汤~', sub: '锅里降温了', heat: 0.35, dur: 4.5 },
  fire:  { text: '老王把火开到了最大！', sub: '熟得飞快，盯紧了', heat: 1.75, dur: 5 },
  toast: { text: '领导举杯：来，走一个！', sub: '快点「干杯」', dur: 2.8, ok: 20, miss: -30 },
  speech: { text: '领导：我简单讲两句……', sub: '讲话时别动筷子', dur: 4.5, ok: 30, miss: -30 },
  song: { text: '大家一起唱生日歌！', sub: '唱歌的时候别动筷子', dur: 5.5, ok: 40, miss: -30 },
  proposal: { text: '隔壁桌有人求婚了！', sub: '全桌都在看热闹，趁现在多吃几口', dur: 6 }
};
HP.QUIET = { speech: 1, song: 1 };   // 这些事件进行中不能动筷子

/* ---------- 同桌的人：坐在锅对面，会点单、会抢菜、会有反应 ----------
   seat：L 左 / C 中 / R 右；hand：抢菜时用哪只手（对应 HP.NPCS）
   prefs：爱点的菜；auth：点毛肚时要求七上八下的概率 */
HP.DINERS = {
  laowang: { name: '老王', hand: 'laowang', color: '#d98a3a', auth: 0.5,
    prefs: ['beef', 'maodu', 'luncheon', 'duckintestine', 'kidney', 'beefball', 'goose', 'tenderbeef', 'huanghou', 'potato'],
    order: ['{d}！快快快', '给我来块{d}', '兄弟，{d}整一个'],
    happy: ['兄弟够意思！', '香！这口绝了', '还是你懂我'], meh: ['凑合吧', '也还行'],
    bad: ['这也太生了吧', '这都煮成鞋垫了'], miss: ['不给是吧，我自己抢', '等得我都饿瘦了'], thanks: ['谢了兄弟', '正好想吃'] },
  friend: { name: '闺蜜', hand: 'friend', color: '#ef7fa0', auth: 0,
    prefs: ['shrimp', 'tenderbeef', 'lettuce', 'tofu', 'enoki', 'strawberry_maodu', 'lotus', 'napa', 'shiitake', 'gongcai', 'beef'],
    order: ['帮我涮块{d}嘛~', '想吃{d}！', '{d}{d}{d}'],
    happy: ['呜呜好好吃，爱你', '你是我的神', '就是这个味'], meh: ['嗯……还行', '下次再嫩一点'],
    bad: ['呸呸，生的！', '老得咬不动了'], miss: ['哼，不理你了', '算了我自己来'], thanks: ['哇谢谢宝', '你怎么知道我想吃'] },
  boss: { name: '领导', hand: 'boss', color: '#6d7fa8', auth: 1,
    prefs: ['maodu', 'huanghou', 'shrimp', 'duckblood', 'tenderbeef', 'goose', 'kidney', 'duckintestine'],
    order: ['小同志，来块{d}', '这个{d}不错，给我夹一块', '{d}，七上八下会不会？'],
    happy: ['不错，有前途', '小同志很会来事嘛', '这火候，可以'], meh: ['嗯。', '还行，继续努力'],
    bad: ['这……能吃吗？', '你平时就这么涮的？'], miss: ['……（领导看了你一眼）', '算了，我不饿'], thanks: ['哦，谢谢', '有心了'] },
  date: { name: '相亲对象', hand: 'laowang', color: '#7bb39a', auth: 0,
    prefs: ['lettuce', 'shrimp', 'tofu', 'beef', 'napa', 'lotus', 'tenderbeef', 'wintermelon', 'shiitake'],
    order: ['那个……能帮我夹块{d}吗', '我想尝尝{d}', '{d}看起来好好吃'],
    happy: ['你好会照顾人啊', '好吃！你好厉害', '（脸红了）谢谢'], meh: ['嗯嗯，挺好的', '谢谢你'],
    bad: ['没、没事，我能吃……', '（偷偷吐掉了）'], miss: ['没事没事，我不饿', '（默默低头玩手机）'], thanks: ['啊，谢谢', '你也吃呀'] },
  auntie: { name: '七大姑', hand: 'friend', color: '#c9573f', auth: 0,
    prefs: ['tofu', 'potato', 'napa', 'wintermelon', 'duckblood', 'lotus', 'shiitake', 'luncheon', 'lettuce'],
    order: ['给姑夹块{d}，要软乎的', '{d}给姑来一块', '姑想吃{d}'],
    happy: ['这孩子真懂事', '比你表哥强多了', '好孩子，多吃点'], meh: ['还行，就是硬了点', '凑合'],
    bad: ['哎哟这没熟啊', '姑牙不好，咬不动'], miss: ['现在的年轻人哦……', '光顾着自己吃'], thanks: ['哎哟乖', '你也多吃'] },
  newbie: { name: '新人', hand: 'friend', color: '#7fa7d9', auth: 0, quiet: true,
    prefs: ['lettuce', 'potato', 'tofu', 'luncheon', 'napa', 'enoki', 'shrimp'],
    order: ['那个……我能吃块{d}吗', '{d}……可以吗', '（小声）{d}'],
    happy: ['谢谢前辈！', '前辈人真好', '（感动得眼泪汪汪）'], meh: ['谢、谢谢', '嗯嗯！'],
    bad: ['（硬着头皮吃了）', '没、没事的'], miss: ['（默默低头）', '（悄悄放下了筷子）'], thanks: ['啊，谢谢前辈', '受宠若惊'] },
  gf: { name: '老王女朋友', hand: 'friend', color: '#b8475a', auth: 0.3,
    prefs: ['tenderbeef', 'shrimp', 'maodu', 'duckintestine', 'lotus', 'huanghou', 'beef', 'enoki'],
    order: ['帮我涮块{d}呗', '听说你涮{d}很厉害？', '{d}来一块~'],
    happy: ['老王，学着点！', '难怪老王总夸你', '这口绝了'], meh: ['还行还行', '一般般啦'],
    bad: ['这……老王你朋友靠谱吗', '生的啊！'], miss: ['老王，你这朋友不太行啊', '算了我自己来'], thanks: ['谢啦', '你人真好'] }
};

/* 饭局剧本 */
HP.SCENES = {
  bros: { name: '朋友局', desc: '老王和闺蜜，一边点菜一边抢', npcs: ['laowang', 'friend'], events: ['soup', 'fire', 'soup'],
          diners: [['friend', 'L'], ['laowang', 'C']] },
  team: { name: '公司团建', desc: '领导点的菜要涮好，讲话别动筷，敬酒要接', npcs: ['laowang'], events: ['toast', 'speech', 'toast', 'fire'],
          diners: [['friend', 'L'], ['laowang', 'C'], ['boss', 'R']], bossFirst: 4, unlockGames: 2,
          names: { friend: '小美', laowang: '老王' },
          intro: ['开局先等领导动筷', '领导讲话时<b>别动筷子</b>', '领导举杯要<b>干杯</b>，领导点的菜要涮好'] },
  date: { name: '相亲局', desc: '对面坐着相亲对象，别光顾着自己吃', npcs: [], events: ['soup', 'fire'],
          diners: [['date', 'C']], unlockGames: 3, polite: true,
          intro: ['对面是相亲对象，<b>不会抢你的菜</b>', '多照顾 TA，自己吃太多会被嫌弃'] },
  family: { name: '家宴', desc: '七大姑、表哥、大舅，一桌人都要照顾到', npcs: ['laowang', 'boss'], events: ['speech', 'soup', 'toast', 'fire'],
          diners: [['auntie', 'L'], ['laowang', 'C'], ['boss', 'R']], unlockGames: 4,
          names: { laowang: '表哥', boss: '大舅' },
          speech: { text: '七大姑：你什么时候结婚啊？', sub: '被催婚了，先别动筷子' },
          toast: { text: '大舅举杯：来，祝你早日成家！', sub: '快点「干杯」' },
          intro: ['七大姑催婚时<b>别动筷子</b>', '大舅举杯要<b>干杯</b>', '一桌人都照顾到，才是好孩子'] },
  solo: { name: '一人食', desc: '没人点菜也没人抢，只比火候有多准', npcs: [], events: ['soup', 'fire'], tip: '没人跟你抢，专心看火候' },
  rush: { name: '翻台挑战', desc: '点单越来越快，等不到菜的人会离席，走 3 个就结束', npcs: ['laowang'], events: ['soup', 'fire'],
          diners: [['friend', 'L'], ['laowang', 'C'], ['auntie', 'R']], endless: true,
          intro: ['没有倒计时：<b>同桌等不到菜会离席</b>', '离席 <b>3 次</b>就结束；<b>40 秒</b>没人走，就有一位消气回来', '越往后点单越快，挑着先涮'] }
};
HP.SCENE_ORDER = ['bros', 'team', 'date', 'family', 'solo', 'rush'];
/* 翻台挑战：离席几次结束；同一道菜的「腻」每隔多少秒消退一半；连续多少秒没人离席就消掉一次 */
HP.RUSH = { strikes: 3, fatigueDecay: 45, calm: 40 };
/* 饭局夜：一晚赶三场，卡的效果叠加 */
HP.NIGHT = ['bros', 'team', 'family'];

/* ---------- 火锅日记：按天解锁机制和剧情（同样的内容，分摊到多天） ----------
   rules：这一天还没学的机制先关掉；lesson：开局前的教学步骤（tutorial.js 的 STEPS 序号）
   scenes / modes：这一天新开的剧本 / 玩法；story：完成这一天后同桌发的朋友圈 */
HP.DAYS = [
  /* 第一天就上招牌菜：肥牛、毛肚涮起来（视频里玩的就是这个），煮的菜也一起教；
     第一天没人抢菜、毛肚不考七上八下，先让新人吃爽。tray：这一天固定上桌的菜；stars：几颗星翻页；orderRate：第二颗星要完成多少点单 */
  { title: '第一次吃火锅', learn: '<b>涮</b>肥牛毛肚：拖进锅别松手，松手就捞；<b>煮</b>午餐肉虾滑：拖进锅松手，变色了点它捞；同桌点的菜拖到 TA 头像上',
    lesson: [0, 1, 3, 4, 6], scenes: ['bros'], rules: { steal: false, dips: false, events: false, cards: false },
    tray: ['beef', 'maodu', 'shrimp', 'luncheon', 'potato'], stars: 1, orderRate: 0.4,
    story: { who: 'friend', t: '第一次跟新朋友吃火锅，TA 给我涮的肥牛刚刚好', img: 'moment_friend_1' } },
  { title: '老王来抢菜', learn: '老王会<b>抢菜</b>：他的筷子伸过来，<b>点它</b>挡开',
    lesson: [5], rules: { dips: false, events: false, cards: false }, stars: 1, orderRate: 0.5,
    story: { who: 'laowang', t: '今天抢菜输了，这兄弟手是真快' } },
  { title: '七上八下', learn: '毛肚要上下提放 7~8 次；鸭肠三上三下',
    lesson: [2], rules: { events: false, cards: false }, stars: 1,
    story: { who: 'laowang', t: '服了，毛肚涮得比我们重庆人还讲究', img: 'moment_laowang_1' } },
  { title: '饭桌意外', learn: '服务员加汤会降温，老王开大火熟得飞快，盯紧火候',
    rules: { cards: false },
    story: { who: 'friend', t: '宣布：以后肥牛都归 TA 涮' } },
  { title: '公司团建', learn: '新剧本「公司团建」：先等领导动筷，领导讲话别动筷子，举杯要干杯',
    scenes: ['team'], rules: { cards: false },
    story: { who: 'boss', t: '今天团建，新同事挺有眼力见', img: 'moment_boss_1' } },
  { title: '饭局卡', learn: '每局开吃前从 3 张饭局卡里<b>挑一张</b>：规则会变，完成目标拿第三颗星',
    story: { who: 'friend', t: '今天老王失恋了，还好有毛肚', img: 'moment_friend_2' } },
  { title: '相亲局', learn: '新剧本「相亲局」：多照顾对面，别光顾着自己吃',
    scenes: ['date'], story: { who: 'date', t: '今天相亲，对方一直帮我夹菜……', img: 'moment_date_1' } },
  { title: '回家吃饭', learn: '新剧本「家宴」：七大姑催婚时别动筷子',
    scenes: ['family'], story: { who: 'auntie', t: '我家孩子真懂事，知道给长辈夹菜', img: 'moment_auntie_1' } },
  { title: '一晚赶三场', learn: '新玩法「饭局夜」：朋友局→团建→家宴连吃三桌，饭局卡效果一路叠加；新剧本「一人食」',
    scenes: ['solo'], modes: ['night'], story: { who: 'laowang', t: '一晚上赶三场饭局，这人胃是铁打的', img: 'moment_laowang_2' } },
  { title: '翻台挑战', learn: '新玩法「翻台挑战」：没有倒计时，同桌离席 3 次就结束',
    scenes: ['rush'], modes: ['rush'], story: { who: 'boss', t: '年轻人涮毛肚，七上八下，有板有眼', img: 'moment_boss_2' } }
];
HP.DAY_MAX = HP.DAYS.length;
HP.DAY_CAP = 3;          // 每个自然日最多推进几天剧情（留个念想明天再来）
HP.DAY_STARS = 2;        // 拿到几颗星算「这一天过关」（前几天在 HP.DAYS 里用 stars 放宽）
HP.dayStars = function (n) { var D = HP.DAYS[Math.max(1, Math.min(HP.DAY_MAX, n || 1)) - 1]; return (D && D.stars) || HP.DAY_STARS; };
HP.ORDER_RATE = 0.6;     // 第二颗星「大家都满意」：点单完成率

/* 阵营：九宫格派 vs 鸳鸯派（排行榜内测能力可用时才显示） */
/* 排行榜榜位（平台只给 1~5 号）：
   剧本局（4 号）新号第一局就能上榜：朋友局 / 团建 / 相亲 / 家宴 / 一人食，火锅日记的局也算，取最好的一局；
   今日火锅只比当天（同一锅才公平）；翻台、饭局夜比本周 / 总榜。5 号留着以后用 */
HP.BOARDS = { daily: 1, rush: 2, night: 3, round: 4 };
HP.RANK_ORDER = ['round', 'daily', 'rush', 'night'];
HP.RANKS = {
  round: { board: 4, periods: ['week', 'all'], name: '剧本局', go: 'diary', desc: '朋友局、团建、相亲、家宴、一人食都算（火锅日记的局也算），取你最好的一局' },
  daily: { board: 1, periods: ['day'], name: '今日火锅', go: 'daily', desc: '所有人吃同一锅，只有当天第一局算' },
  rush: { board: 2, periods: ['week', 'all'], name: '翻台挑战', go: 'rush', desc: '撑得越久分越高' },
  night: { board: 3, periods: ['week', 'all'], name: '饭局夜', go: 'night', desc: '一晚三桌的总分' }
};
HP.PERIOD = { day: '今日', week: '本周', month: '本月', all: '总榜' };
/* 排行榜用不了时首页入口上的说明（未授权 / 没开通按文档直接隐藏入口，不在这里） */
HP.RANK_NOTE = {
  browser: '在小红书 App 里打开就能看榜、上榜',
  unknown: '用手机小红书扫码打开就能看榜、上榜',
  old: '小红书升级到 9.51 以上就能看榜、上榜',
  nofn: '排行榜暂未开放，敬请期待'
};
HP.RESET = { day: '每天 0 点（北京时间）换榜', week: '每周一 0 点（北京时间）换榜', month: '每月 1 日换榜', all: '记历史最好成绩' };
/* 每日一锅：按星期换剧本（0=周日） */
HP.DAILY_SCENES = ['family', 'team', 'bros', 'date', 'team', 'bros', 'family'];

/* 可复现的随机数：每日一锅用日期做种子，所有人同一局 */
HP.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
/* 一局里分开的几条随机数流：赛程（事件、抢菜、点单）只受种子决定，不受玩家操作影响；台词另走一条 */
HP.streams = function (seed) {
  if (!seed) return { ev: Math.random, npc: Math.random, card: Math.random, ord: function () { return Math.random; }, talk: Math.random };
  var s = seed >>> 0;
  return {
    ev: HP.rng(s), npc: HP.rng(s ^ 0x5bd1e995), card: HP.rng(s ^ 0x27d4eb2f), talk: HP.rng(s ^ 0x165667b1),
    ord: function (i) { return HP.rng((s ^ 0x9e3779b9) + i * 7919); }
  };
};
HP.dayKey = function (d) {
  d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

HP.ASSETS = {
  optional: (function () {
    var out = [];
    ['laowang', 'friend', 'boss', 'date', 'auntie', 'newbie', 'gf'].forEach(function (id) { ['wait', 'happy', 'angry'].forEach(function (m) { out.push('avatar_' + id + '_' + m); }); });
    ['heartbreak', 'diet', 'newbie', 'blackout', 'aa', 'birthday', 'proposal', 'freemaodu', 'gfdate'].forEach(function (id) { out.push('card_' + id); });
    ['laowang_1', 'laowang_2', 'friend_1', 'friend_2', 'boss_1', 'boss_2', 'date_1', 'date_2', 'auntie_1', 'auntie_2', 'newbie_1', 'gf_1'].forEach(function (id) { out.push('moment_' + id); });
    out.push('bowl', 'pair_bg');
    return out;
  })(),
  scene: ['pot', 'pot_yuanyang', 'table', 'card_bg', 'chopsticks_closed', 'hand_laowang', 'hand_boss', 'hand_friend'],
  food: HP.FOOD_ORDER
};
