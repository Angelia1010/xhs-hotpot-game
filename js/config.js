/* 游戏数值与素材配置。改数值只需要动这个文件。 */
var HP = window.HP = window.HP || {};

/* 锅图上的汤面几何（相对锅图宽高的比例坐标） */
HP.POT = {
  cx: 0.497, cy: 0.503,       // 汤面椭圆中心
  rx: 0.356, ry: 0.366,       // 汤面椭圆半径
  vx: [0.366, 0.625],         // 两条竖隔板中心
  hy: [0.371, 0.615],         // 两条横隔板中心
  half: 0.013                 // 隔板半宽
};

/* 九宫格火力：中心最旺，四角最弱 */
HP.HEAT = [0.6, 1.0, 0.6,
           1.0, 1.5, 1.0,
           0.6, 1.0, 0.6];

/* 食材：a~b 为完美窗口（泡在汤里的秒数 × 火力），size 为相对锅宽的显示尺寸
   mode: 'drop' 丢进锅里煮；'swish' 按住在锅里涮，松手捞起
   dips: 毛肚的「七上八下」次数区间 */
HP.FOODS = {
  luncheon:      { name: '午餐肉', mode: 'drop',  a: 5,  b: 12, size: 0.085, price: 8,  depth: 0.12 },
  potato:        { name: '土豆片', mode: 'drop',  a: 8,  b: 15, size: 0.085, price: 6,  depth: 0.12 },
  beef:          { name: '肥牛',   mode: 'swish', a: 4,  b: 6.5, size: 0.095, price: 15, depth: 0.15 },
  duckintestine: { name: '鸭肠',   mode: 'swish', a: 3,  b: 5,  size: 0.115, price: 18, depth: 0.10 },
  maodu:         { name: '毛肚',   mode: 'swish', a: 4,  b: 10,  size: 0.105, price: 25, depth: 0.10, dips: [7, 8] },
  shrimp:        { name: '虾滑',   mode: 'drop',  a: 6,  b: 9,  size: 0.075, price: 20, depth: 0.0, sinker: true },
  huanghou:      { name: '黄喉',   mode: 'drop',  a: 8,  b: 12, size: 0.110, price: 22, depth: 0.12 },
  duckblood:     { name: '鸭血',   mode: 'drop',  a: 15, b: 22, size: 0.080, price: 12, depth: 0.30 }
};
HP.FOOD_ORDER = ['beef', 'maodu', 'duckintestine', 'shrimp', 'huanghou', 'duckblood', 'luncheon', 'potato'];

/* 同桌 NPC：手的素材、从哪一侧伸进来、筷子尖在素材里的位置 */
HP.NPCS = [
  { id: 'laowang', name: '老王', img: 'hand_laowang', side: 'top',   tip: [0.481, 0.999] },
  { id: 'friend',  name: '闺蜜', img: 'hand_friend',  side: 'left',  tip: [0.467, 0.999] },
  { id: 'boss',    name: '领导', img: 'hand_boss',    side: 'right', tip: [0.544, 0.999] }
];

HP.ROUND_TIME = 90;           // 一局秒数
HP.NPC_FIRST_DELAY = 12;      // 开局多少秒后 NPC 才开始抢
HP.NPC_WARN = 1.1;            // 抢之前的预警时长
HP.HINT_OFF_BONUS = 1.2;      // 关掉火候提示（老手模式）的得分加成

/* 节奏三段：开局轻松 → 中段同桌开始抢 → 最后 20 秒手忙脚乱 */
HP.PHASES = [
  { until: 30, npc: [9, 13], event: [999, 999] },
  { until: 70, npc: [6, 10], event: [13, 17] },
  { until: 999, npc: [4, 7], event: [7, 10] }
];
HP.EVENT_FIRST = 24;          // 第一个突发事件出现时间

/* 突发事件 */
HP.EVENTS = {
  soup:  { text: '服务员：给您加点汤~', sub: '锅里降温了', heat: 0.35, dur: 4.5 },
  fire:  { text: '老王把火开到了最大！', sub: '熟得飞快，盯紧了', heat: 1.75, dur: 5 },
  toast: { text: '领导举杯：来，走一个！', sub: '快点「干杯」', dur: 2.8, ok: 20, miss: -30 }
};

HP.ASSETS = {
  scene: ['pot', 'table', 'chopsticks_closed', 'chopsticks_open', 'hand_laowang', 'hand_boss', 'hand_friend'],
  food: HP.FOOD_ORDER
};
