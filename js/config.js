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
   dips: 七上八下次数；sinker: 生的沉底、熟了浮起；special: 特殊玩法；tip: 第一次下锅的提示 */
HP.FOODS = {
  beef:          { name: '肥牛',     mode: 'swish', a: 4,  b: 6.5, size: 0.095, price: 15, depth: 0.15 },
  tenderbeef:    { name: '嫩牛肉',   mode: 'swish', a: 3,  b: 5,   size: 0.100, price: 18, depth: 0.15, unlock: 400 },
  maodu:         { name: '毛肚',     mode: 'swish', a: 4,  b: 10,  size: 0.105, price: 25, depth: 0.10, dips: [7, 8] },
  strawberry_maodu: { name: '草莓毛肚', mode: 'swish', a: 4, b: 10, size: 0.100, price: 30, depth: 0.10, dips: [7, 8], unlock: 1000,
                   special: 'strawberry', tip: '网红梗菜：照样七上八下，吃完川渝人会沉默' },
  duckintestine: { name: '鸭肠',     mode: 'swish', a: 3,  b: 5,   size: 0.115, price: 18, depth: 0.10, unlock: 200 },
  goose:         { name: '鹅肠',     mode: 'swish', a: 3.5, b: 5.5, size: 0.115, price: 22, depth: 0.10, unlock: 400 },
  kidney:        { name: '腰片',     mode: 'swish', a: 4,  b: 6.5, size: 0.100, price: 20, depth: 0.12, unlock: 500 },
  huanghou:      { name: '黄喉',     mode: 'drop',  a: 8,  b: 12,  size: 0.110, price: 22, depth: 0.12, unlock: 300 },
  shrimp:        { name: '虾滑',     mode: 'drop',  a: 6,  b: 9,   size: 0.075, price: 20, depth: 0.0, sinker: true },
  beefball:      { name: '牛肉丸',   mode: 'drop',  a: 7,  b: 11,  size: 0.075, price: 16, depth: 0.0, sinker: true, unlock: 400 },
  duckblood:     { name: '鸭血',     mode: 'drop',  a: 15, b: 22,  size: 0.080, price: 12, depth: 0.30 },
  luncheon:      { name: '午餐肉',   mode: 'drop',  a: 5,  b: 12,  size: 0.085, price: 8,  depth: 0.12 },
  tofu:          { name: '冻豆腐',   mode: 'drop',  a: 8,  b: 16,  size: 0.085, price: 8,  depth: 0.25, veg: true, unlock: 250 },
  potato:        { name: '土豆片',   mode: 'drop',  a: 8,  b: 15,  size: 0.085, price: 6,  depth: 0.12, veg: true },
  lotus:         { name: '藕片',     mode: 'drop',  a: 6,  b: 12,  size: 0.085, price: 8,  depth: 0.12, veg: true, unlock: 250 },
  lettuce:       { name: '生菜',     mode: 'swish', a: 1,  b: 2.5, size: 0.100, price: 5,  depth: 0.10, veg: true, tip: '生菜烫一下就好，一不留神就蔫了' },
  gongcai:       { name: '贡菜',     mode: 'swish', a: 2,  b: 4,   size: 0.100, price: 8,  depth: 0.10, veg: true, unlock: 200 },
  napa:          { name: '娃娃菜',   mode: 'drop',  a: 9,  b: 18,  size: 0.090, price: 6,  depth: 0.15, veg: true },
  enoki:         { name: '金针菇',   mode: 'drop',  a: 5,  b: 10,  size: 0.090, price: 8,  depth: 0.12, veg: true, unlock: 250,
                   special: 'tangle', tip: '金针菇缠成一团，要点两下才夹得起来' },
  shiitake:      { name: '香菇',     mode: 'drop',  a: 7,  b: 13,  size: 0.085, price: 8,  depth: 0.12, veg: true, unlock: 250 },
  wintermelon:   { name: '冬瓜',     mode: 'drop',  a: 14, b: 24,  size: 0.085, price: 6,  depth: 0.15, veg: true, unlock: 200, tip: '冬瓜最慢，煮到透明再捞' },
  jianshouqing:  { name: '见手青',   mode: 'drop',  a: 10, b: 16,  size: 0.085, price: 30, depth: 0.12, veg: true, unlock: 1000,
                   special: 'trip', tip: '见手青一定要煮熟！没熟就吃会「看见小人」' }
};
HP.FOOD_ORDER = ['beef', 'tenderbeef', 'maodu', 'strawberry_maodu', 'duckintestine', 'goose', 'kidney', 'huanghou',
  'shrimp', 'beefball', 'duckblood', 'luncheon', 'tofu', 'potato', 'lotus',
  'lettuce', 'gongcai', 'napa', 'enoki', 'shiitake', 'wintermelon', 'jianshouqing'];
HP.VERSION = '1.1.0';
HP.RULES = 4;   // 计分规则版本：改了计分就 +1，旧版最高分作废重算
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
  speech: { text: '领导：我简单讲两句……', sub: '讲话时别动筷子', dur: 4.5, ok: 30, miss: -30 }
};

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
    bad: ['哎哟这没熟啊', '姑牙不好，咬不动'], miss: ['现在的年轻人哦……', '光顾着自己吃'], thanks: ['哎哟乖', '你也多吃'] }
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
  solo: { name: '一人食', desc: '没人点菜也没人抢，只比火候有多准', npcs: [], events: ['soup', 'fire'], tip: '没人跟你抢，专心看火候' }
};
HP.SCENE_ORDER = ['bros', 'team', 'date', 'family', 'solo'];
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
HP.dayKey = function (d) {
  d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

HP.ASSETS = {
  optional: (function () {
    var out = [];
    ['laowang', 'friend', 'boss', 'date', 'auntie'].forEach(function (id) { ['wait', 'happy', 'angry'].forEach(function (m) { out.push('avatar_' + id + '_' + m); }); });
    return out;
  })(),
  scene: ['pot', 'pot_yuanyang', 'table', 'card_bg', 'chopsticks_closed', 'hand_laowang', 'hand_boss', 'hand_friend'],
  food: HP.FOOD_ORDER
};
