import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// minimal .env loader (KEY=VALUE lines, no deps)
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const config = {
  port: Number(process.env.PORT || 8971),
  // 观猹 OAuth2 — 默认为文档中的开发测试机密客户端,可用 .env 覆盖为正式凭据
  watchaClientId: process.env.WATCHA_CLIENT_ID || '1p9Mcr+CNLPAMFC0',
  watchaClientSecret: process.env.WATCHA_CLIENT_SECRET || 'aqkUs+5ZGLSVG6A/L/I0ib9uownWxH+w',
  watchaAuthorizeUrl: process.env.WATCHA_AUTHORIZE_URL || 'https://watcha.cn/oauth/authorize',
  watchaTokenUrl: process.env.WATCHA_TOKEN_URL || 'https://watcha.cn/oauth/api/token',
  watchaUserinfoUrl: process.env.WATCHA_USERINFO_URL || 'https://watcha.cn/oauth/api/userinfo',
  // 回调地址须与观猹后台登记的 domain 一致
  publicOrigin: process.env.PUBLIC_ORIGIN || 'https://bike.hub.tt2.li',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-only-cookie-secret-change-me',
  get redirectUri() {
    return `${this.publicOrigin}/api/auth/callback`;
  },
  // —— 游戏经济参数 ——
  // 词元产出 = 平均功率(W) * rate,服务端按时间窗封顶防作弊
  tokensPerWattSecond: 0.08,
  maxPlausibleWatts: 1500, // 人类冲刺极限附近,超过直接钳制
  syncMaxIntervalSec: 30,
  sessionTtlSec: 7 * 24 * 3600,
};
