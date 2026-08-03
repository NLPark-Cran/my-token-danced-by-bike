# 我的 Token, danced by bike:

> 一台固定单车,一台黄铜发电机,一颗永远吃不饱的 K3 核心。
> 你负责踩,它负责烧 —— 踩得越快,词元来得越快。
> 线上地址: <https://bike.hub.tt2.li>

## 玩法

- **左右方向键 `←` `→` 交替狂敲** = 踩踏板(手机用屏幕上的「左蹬 / 右蹬」大按钮)
- 踩得越快 → 功率(W)越高 → 词元产出越多
- 注意**腿力**条:耗尽后功率大幅下降,歇一歇恢复
- 随机无厘头事件:被马路扇巴掌功率 ×1.5、链条掉了、K3 核心饿了 ×2……
- **观猹 OAuth2 登录**后词元才会入账并登上「词元富豪榜」

## 技术栈(2026 版)

| 层 | 选型 |
| --- | --- |
| 前端 | Vite 8 · TypeScript · PixiJS 8(WebGL 程序化绘制骑手/曲柄/粒子)· Tailwind CSS v4 |
| 后端 | Hono 4 + @hono/node-server · better-sqlite3(WAL)· tsx |
| 认证 | 观猹 OAuth2 Authorization Code + PKCE(机密客户端,签名 Cookie 会话) |
| 部署 | 裸机无容器:nginx(静态 + `/api` 反代)+ certbot TLS + PM2 |
| 素材 | seedream-5.0-pro 文生图(复古海报风 Hero / Logo / 贴纸)+ 观猹官方 logo |
| 设计 | 复古自行车海报:奶油纸 / 墨绿 / 朱红 / 黄铜,衬线大标题 |

## 目录

```
web/      # Vite 前端(PixiJS 游戏)
server/   # Hono API(OAuth、结算、排行榜)
scripts/  # 素材生成脚本(TokenDance 网关)
docs/     # 观猹认证接入文档(原始资料)
```

## 本地开发

```bash
# 后端(http://127.0.0.1:8971)
cd server && npm install && npm run dev

# 前端(http://127.0.0.1:5175,/api 已代理到 8971)
cd web && npm install && npm run dev
```

服务端配置见 `server/.env`(不存在时用 `server/src/config.ts` 中的开发默认值,
即观猹文档提供的测试客户端凭据;正式凭据请通过 `.env` 覆盖)。

## 部署(本仓库对应的线上环境)

```bash
cd web && npm run build
rsync -a --delete dist/ /var/www/bike.hub.tt2.li/
pm2 start "npm run start" --name tokenbike-api --cwd server   # 或 pm2 restart tokenbike-api
```

## 防作弊说明

客户端每 5 秒上报本窗口累计的「曲柄功」(焦耳),服务端按
窗口时长 × 人类功率上限(1500W)封顶后折算词元(0.08 词元/焦耳)。
排行榜因此具有基本可信度,但请勿对它太上头 —— 这只是个无厘头游戏。

## 免责声明

本站词元为虚拟娱乐数值,与 TokenDance 真实额度没有任何关系(除非大佬说真的给)。
