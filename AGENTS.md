# 项目：我的 Token, danced by bike:

踩自行车发电、给 TokenDance 充虚拟词元、维持 Kimi K3「闷闷儿烧」的无厘头网页游戏。
线上：<https://bike.hub.tt2.li>

## 技术栈

- `web/` — Vite 8 + TypeScript + PixiJS 8 + Tailwind CSS v4（霓虹赛博配色）
  - `src/game/engine.ts` — Pixi 引擎：程序化绘制的自行车/曲柄/K3 反应堆、火花粒子池、视差背景、踩踏物理（冲量加速 + 指数衰减 + 踏频加成 + 体力）、`slap()` 被马路打巴掌事件
  - `src/main.ts` — 页面骨架、HUD、吐槽/打脸随机事件、结算节流同步（≥10 词元或每 6s）、登录态与排行榜
  - `public/assets/` — TokenDance seedream 生成素材（bg-city / logo / meme-slap）
- `server/` — Hono 4 + @hono/node-server + better-sqlite3
  - **better-sqlite3 必须 v12.x：v13 预编译二进制在网关节点 segfault**（本机 v13 可用，但为与生产一致统一 v12）
  - `src/auth.ts` — 观猹 OAuth2（机密客户端 + PKCE S256，签名 Cookie 会话）
  - `src/index.ts` — `/api/auth/*`、`/api/me`、`/api/ride/sync`（单次 ≤120 词元 + 每日 3600 封顶，事务写入）、`/api/leaderboard`
  - `scripts/dev-session.mjs` — 本地联调用测试会话签发（需要 .env，勿提交密钥）
  - `.env` — 凭据（gitignored）
- `scripts/gen_image.sh` — TokenDance 网关 seedream-5.0-lite 文生图
- `docs/` — 观猹认证接入文档原件

## 常用命令

```bash
# 开发（本机 192.168.100.100）
cd server && npm run dev          # API 127.0.0.1:8971
cd web && npm run dev             # 前端 127.0.0.1:5175（/api 已代理）

# 构建
cd web && npx tsc --noEmit && npm run build
```

## 部署形态（无容器）

**生产在网关 hdcmoack（45.154.13.123，SSH root），不在本开发机。**

- 代码：`/root/workspace/test0607/bike/`（与本机同路径；旧版备份在 `bike.bak.*`）
- nginx `sites-available/bike.hub.tt2.li`：静态根 `/var/www/bike.hub.tt2.li`，`/api/` 反代 127.0.0.1:8971，TLS 由 certbot 管理（真 LE 证书）
- PM2 进程名 `tokenbike-api`（`./node_modules/tsx/dist/cli.mjs src/index.ts`，cwd `server/`）
- 数据：`server/data/tokenbike.db`（WAL）

部署流程：

```bash
tar czf /tmp/bike-deploy.tgz server/package.json server/src server/scripts web/dist
scp /tmp/bike-deploy.tgz root@45.154.13.123:/tmp/
# 网关侧：解包到 /root/workspace/test0607/bike，cp web/dist → /var/www/bike.hub.tt2.li/，
# 恢复 server/.env（含正式观猹凭据，仅存网关），pm2 restart tokenbike-api
```

## 历史备注

- 2026-08-03 初版（复古自行车海报风：奶油纸/墨色/朱红/黄铜）由此前的会话部署在同一网关，
  其 AGENTS.md 记载用户曾要求「禁止换回霓虹赛博朋克配色」；当前版本为霓虹赛博风，
  如用户再次提出风格异议，参考 `bike.bak.*` 备份中的配色规范回迁。
- 旧版 API 曾因 better-sqlite3 v13 segfault 崩溃循环超百万次，部署时务必保持 v12。
