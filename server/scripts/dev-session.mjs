// 本地联调用：插入一个测试骑手并签发会话 Cookie（仅限开发环境）
import { createHmac } from 'node:crypto';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const db = new Database(join(root, 'data', 'tokenbike.db'));
db.prepare(`INSERT INTO users (watcha_id,nickname,avatar_url,access_token) VALUES ('dev-rider','测试骑手','', 'dev')
  ON CONFLICT(watcha_id) DO NOTHING`).run();
const user = db.prepare(`SELECT id FROM users WHERE watcha_id='dev-rider'`).get();
db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(user.id);
const signature = createHmac('sha256', env.COOKIE_SECRET).update(String(user.id)).digest('base64');
console.log(`tokenbike_session=${user.id}.${signature}`);
