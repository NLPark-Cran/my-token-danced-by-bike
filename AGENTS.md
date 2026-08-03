# 项目:我的 Token, danced by bike:

踩自行车发电赚虚拟词元的网页游戏。线上:<https://bike.hub.tt2.li>

## 结构

- `web/` — Vite 8 + TypeScript + PixiJS 8 + Tailwind CSS v4 前端
  - `src/game/engine.ts` — 游戏引擎(程序化绘制的复古线稿骑手/曲柄/粒子,设计坐标 1280×720)
  - `src/main.ts` — 页面骨架、HUD、结算循环、随机事件、排行榜、登录态
  - `public/assets/` — AI 生成素材(seedream,复古海报风)+ 观猹官方 logo
- `server/` — Hono 4 + better-sqlite3(必须 v12.x,**v13 预编译二进制在本机 segfault**)
  - `src/auth.ts` — 观猹 OAuth2(机密客户端 + PKCE S256,签名 Cookie + sqlite 会话)
  - `src/index.ts` — API:/api/auth/*、/api/pedal/sync(服务端 1500W 封顶防作弊)、/api/leaderboard
  - `.env` — 正式凭据(gitignored);缺省时回退到观猹文档的测试凭据
- `scripts/gen_image.sh` — TokenDance 网关 seedream-5.0-pro 文生图
- `docs/` — 观猹认证接入文档原件

## 常用命令

```bash
# 开发
cd server && npm run dev          # API 127.0.0.1:8971
cd web && npm run dev             # 前端 127.0.0.1:5175(/api 已代理)

# 部署(本机即生产)
cd web && npx tsc --noEmit && npm run build
rsync -a --delete dist/ /var/www/bike.hub.tt2.li/
pm2 restart tokenbike-api         # 改 server 后
```

## 部署形态(无容器)

- nginx `sites-available/bike.hub.tt2.li`:静态根 `/var/www/bike.hub.tt2.li`,`/api/` 反代 127.0.0.1:8971,TLS 由 certbot 管理
- PM2 进程名 `tokenbike-api`(`npx tsx src/index.ts`,cwd `server/`)
- 数据:`server/data/tokenbike.db`(WAL)

## 设计规范

复古自行车海报风:奶油纸 `#F2EDE3` / 墨色 `#1C2420` / 朱红 `#C8411F` / 黄铜 `#B98A2F`;
标题衬线(font-serif),正文无衬线;禁止换回霓虹赛博朋克配色。
文案不出现内部梗/人物指代;无厘头仅限游戏事件本身。
