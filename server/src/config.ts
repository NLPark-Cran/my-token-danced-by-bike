import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

if (existsSync(envPath)) {
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) continue;
    const key = line.slice(0, split).trim();
    const value = line.slice(split + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const int = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${name}`);
  return value;
};

export const config = {
  port: int('PORT', 8971),
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:5175',
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev-only-change-me-before-deploy',
  oauth: {
    authorizeUrl: process.env.WATCHA_AUTHORIZE_URL ?? 'https://watcha.cn/oauth/authorize',
    tokenUrl: process.env.WATCHA_TOKEN_URL ?? 'https://watcha.cn/oauth/token',
    userInfoUrl: process.env.WATCHA_USERINFO_URL ?? 'https://watcha.cn/api/oauth/userinfo',
    clientId: process.env.WATCHA_CLIENT_ID ?? '',
    clientSecret: process.env.WATCHA_CLIENT_SECRET ?? '',
    redirectUri: process.env.WATCHA_REDIRECT_URI ?? 'http://localhost:8971/api/auth/callback',
    scopes: process.env.WATCHA_SCOPES ?? 'read',
  },
  dailyCap: int('DAILY_TOKEN_CAP', 3600),
};

/*
Design note: Configuration remains dependency-free.
                      */