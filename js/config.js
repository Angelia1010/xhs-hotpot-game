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

/* 食材：a~b 为完美窗口（游戏秒 × 火力），size 为相对锅宽的显示尺寸 */
HP.FOODS = {
  luncheon:      { name: '午餐肉', a: 5,  b: 12, size: 0.085, price: 8,  depth: 0.12 },
  potato:        { name: '土豆片', a: 8,  b: 15, size: 0.085, price: 6,  depth: 0.12 },
  beef:          { name: '肥牛',   a: 6,  b: 9,  size: 0.095, price: 15, depth: 0.15 },
  duckintestine: { name: '鸭肠',   a: 4,  b: 7,  size: 0.115, price: 18, depth: 0.10 },
  maodu:         { name: '毛肚',   a: 7,  b: 10, size: 0.105, price: 25, depth: 0.10 },
  shrimp:        { name: '虾滑',   a: 6,  b: 9,  size: 0.075, price: 20, depth: 0.0, sinker: true },
  huanghou:      { name: '黄喉',   a: 8,  b: 12, size: 0.110, price: 22, depth: 0.12 },
  duckblood:     { name: '鸭血',   a: 15, b: 22, size: 0.080, price: 12, depth: 0.30 }
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
HP.NPC_INTERVAL = [7, 12];    // 抢菜间隔范围
HP.NPC_WARN = 1.1;            // 抢之前的预警时长

HP.ASSETS = {
  scene: ['pot', 'table', 'chopsticks_closed', 'chopsticks_open', 'hand_laowang', 'hand_boss', 'hand_friend'],
  food: HP.FOOD_ORDER
};
