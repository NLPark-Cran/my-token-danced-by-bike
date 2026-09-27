# 我的 Token, danced by bike:

🚲⚡ 踩自行车发电，给 TokenDance 充虚拟词元，维持 Kimi K3「闷闷儿烧」——观猹 FDE 共学营无厘头网页游戏。

线上：**<https://bike.hub.tt2.li>**

## 玩法

- 点击/触摸画面或狂敲空格模拟踩踏，有节奏地踩（约每秒 4~5 次）触发踏频加成
- 功率超过怠速阈值后开始产出虚拟词元，自动同步进 TokenDance 虚拟额度
- 体力会耗尽，休息恢复；K3 核心随功率「闷闷儿烧」
- 小心：马路会随机伸出一只手给你一巴掌（速度折损）
- 观猹登录后词元才会入账，排行榜记录词元富豪

## 技术栈

Vite 8 · TypeScript · PixiJS 8 · Tailwind CSS v4 · Hono 4 · better-sqlite3 · 观猹 OAuth2（PKCE）

## 开发

```bash
cd server && npm install && npm run dev   # API :8971
cd web && npm install && npm run dev      # 前端 :5175
```

构建与部署见 [AGENTS.md](./AGENTS.md)。
