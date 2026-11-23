#!/bin/sh
# 打包成小红书小工具 zip：只放运行需要的文件
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/js dist/img/food dist/img/plate dist/img/scene
cp index.html style.css dist/
cp js/*.js dist/js/
cp img/food/*.webp dist/img/food/
cp img/plate/*.webp dist/img/plate/
for n in pot pot_yuanyang table card_bg chopsticks_closed hand_laowang hand_boss hand_friend; do cp img/scene/$n.webp dist/img/scene/; done
rm -f huoguoju.zip
(cd dist && python3 -c "
import zipfile, os
z = zipfile.ZipFile('../huoguoju.zip', 'w', zipfile.ZIP_DEFLATED)
for root, _, files in os.walk('.'):
    for f in sorted(files):
        p = os.path.join(root, f); z.write(p, os.path.relpath(p, '.'))
z.close()")
echo "built huoguoju.zip: $(du -h huoguoju.zip | cut -f1), $(find dist -type f | wc -l) files"
