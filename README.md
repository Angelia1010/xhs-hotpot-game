# 火锅局 · 小红书涮火锅小游戏

一桌人的火锅模拟器：涮得好是技术，吃得好是情商。

## 本地预览
```
python3 -m http.server 8080
```
手机或浏览器打开 http://localhost:8080 。

## 目录
- `index.html` / `style.css`：唯一入口和界面样式
- `js/config.js`：食材火候、九宫格火力、NPC 等全部数值
- `js/fx.js`：沸腾气泡、涟漪、油光、热气等动态特效（程序绘制）
- `js/game.js`：熟度系统、触控、NPC 抢菜、绘制
- `js/audio.js`：Web Audio 合成音效（小工具不允许打包音频文件）
- `js/main.js`：加载、主循环、开始/结算页
- `img/`：处理后的 webp 素材（不放在 assets/，避免被平台静态资源优化移出包外、离线时加载失败）
- `tools/process_assets.py`：把 GPT 原图切成三状态、裁切、压缩成 webp

## 打包上传小红书
```
./tools/build.sh      # 生成 huoguoju.zip（只含运行需要的文件）
```
上传前，建议在 Builder Hub 上传页复制「调整为符合小红书规范的代码格式」口令，按官方 Skill 再校验一遍。

## 平台能力（js/platform.js）
- 存档：`setStorage/getStorage`（最高分、是否看过教学）；浏览器预览用 localStorage
- 震动：`vibrateShort`
- 保存结算卡：`saveImageToPhotosAlbum`（必须点击触发）
- 分享：`share`（客户端 9.53+，全屏容器，每天 10 次）
- 安全区：`getWindowInfo`，HUD 自动避开右上角胶囊按钮
