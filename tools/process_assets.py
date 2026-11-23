"""把 GPT 生成的原图处理成游戏用的 webp 素材。
用法: python3 tools/process_assets.py <原图目录> <输出 img 目录>"""
import sys, os, json
from PIL import Image
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
FOOD = {  # 原图文件名 -> 食材 id
    'food_luncheon.png': 'luncheon', '02.png': 'potato', '03.png': 'beef',
    '04.png': 'duckintestine', '05.png': 'shrimp', '06.png': 'maodu',
    '07.png': 'huanghou', '08.png': 'duckblood',
    # 第二批
    'food_goose.png': 'goose', 'food_tenderbeef.png': 'tenderbeef', 'food_kidney.png': 'kidney', 'food_tofu.png': 'tofu',
    'food_lotus.png': 'lotus', 'food_beefball.png': 'beefball', 'food_strawberry_maodu.png': 'strawberry_maodu',
    'food_jianshouqing.png': 'jianshouqing',
    # 青菜
    'food_lettuce.png': 'lettuce', 'food_gongcai.png': 'gongcai', 'food_enoki.png': 'enoki', 'food_napa.png': 'napa',
    'food_wintermelon.png': 'wintermelon', 'food_shiitake.png': 'shiitake',
}
manifest = {'food': {}, 'plate': {}, 'scene': {}}

def bbox(im, th=24):
    """忽略几乎透明的噪点，按真实主体裁切"""
    m = im.getchannel('A').point(lambda v: 255 if v > th else 0)
    return m.getbbox()

def save(im, path, max_side, q=82):
    im = im.copy(); im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)
    return im.size

def split_states(im):
    """按透明列把横排三状态切开"""
    a = np.array(im.getchannel('A')) > 24
    cols = a.any(axis=0)
    runs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None: start = x
        if not v and start is not None:
            runs.append((start, x)); start = None
    if start is not None: runs.append((start, len(cols)))
    runs = [r for r in runs if r[1] - r[0] > 20]
    # 鸭肠第三态很小，若块数>3 则合并最近的
    while len(runs) > 3:
        gaps = [runs[i+1][0] - runs[i][1] for i in range(len(runs)-1)]
        i = gaps.index(min(gaps)); runs[i:i+2] = [(runs[i][0], runs[i+1][1])]
    assert len(runs) == 3, runs
    out = []
    for x0, x1 in runs:
        c = im.crop((x0, 0, x1, im.height)); out.append(c.crop(bbox(c)))
    return out

for fn, fid in FOOD.items():
    if not os.path.exists(os.path.join(SRC, fn)): continue
    im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
    states = split_states(im)
    # 三态统一缩放比例，保持相对大小（煮老会缩小）
    scale = 220 / max(max(s.size) for s in states)
    sizes = []
    for i, s in enumerate(states):
        s = s.resize((max(1, round(s.width*scale)), max(1, round(s.height*scale))), Image.LANCZOS)
        p = f'food/{fid}_{i}.webp'; s.save(os.path.join(OUT, p), 'WEBP', quality=82, method=6)
        sizes.append(list(s.size))
    manifest['food'][fid] = sizes

for fn in sorted(os.listdir(SRC)):
    if fn.startswith('plate_'):
        fid = fn[6:-4]; im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
        im = im.crop(bbox(im)); manifest['plate'][fid] = save(im, os.path.join(OUT, f'plate/{fid}.webp'), 320)

SCENE = {'pot.png': 1000, 'table.png': 1100, 'card_bg.png': 1080, 'chopsticks_open.png': 700,
         'chopsticks_closed.png': 700, 'ladle.png': 600, 'hand_laowang.png': 700,
         'hand_boss.png': 700, 'hand_friend.png': 700, 'pot_yuanyang.png': 1000}
for fn, side in SCENE.items():
    if not os.path.exists(os.path.join(SRC, fn)): continue
    im = Image.open(os.path.join(SRC, fn))
    if not fn.startswith('pot') and im.mode == 'RGBA': im = im.crop(bbox(im))
    q = 78 if im.mode == 'RGB' else 82
    manifest['scene'][fn[:-4]] = save(im, os.path.join(OUT, f'scene/{fn[:-4]}.webp'), side, q)

json.dump(manifest, open(os.path.join(OUT, 'manifest_' + os.path.basename(os.path.normpath(SRC)) + '.json'), 'w'), indent=1)
print(json.dumps(manifest))
