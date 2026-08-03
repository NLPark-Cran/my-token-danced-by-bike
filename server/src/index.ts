import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db, todayStr } from './db.js';
import { config } from './config.js';
import { handleLogin, handleCallback, handleLogout, currentUser } from './auth.js';

const app = new Hono();

app.use('/api/*', logger());
app.use(
  '/api/*',
  cors({ origin: config.publicOrigin, credentials: true }),
);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// —— 认证 ——
app.get('/api/auth/login', handleLogin);
app.get('/api/auth/callback', handleCallback);
app.post('/api/auth/logout', handleLogout);

app.get('/api/auth/me', async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ user: null });
  const b = getBalance(u.user_id);
  return c.json({
    user: { ...u, balance: round2(b.balance), total: round2(b.total), today: round2(b.today) },
  });
});

// —— 游戏结算 ——
// 客户端每 ~5s 上报本窗口的「曲柄功」(joules = 平均功率 * 秒数),
// 服务端按窗口时长与最大功率封顶后折算词元。
app.post('/api/pedal/sync', async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: 'unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  const joules = Number(body?.joules);
  const windowSec = Number(body?.window_sec);
  if (!Number.isFinite(joules) || !Number.isFinite(windowSec) || joules < 0 || windowSec <= 0) {
    return c.json({ error: 'bad_request' }, 400);
  }
  const win = Math.min(windowSec, config.syncMaxIntervalSec);
  const avgWatts = joules / windowSec;
  const cappedWatts = Math.min(avgWatts, config.maxPlausibleWatts);
  const earned = round2(cappedWatts * win * config.tokensPerWattSecond);

  if (earned > 0) {
    const tx = db.transaction(() => {
      const b = getBalance(u.user_id);
      const t = todayStr();
      const today = b.day === t ? b.today + earned : earned;
      db.prepare(
        `UPDATE balances SET balance=balance+?, total=total+?, today=?, day=?, updated_at=? WHERE user_id=?`,
      ).run(earned, earned, today, t, Date.now(), u.user_id);
      db.prepare(`UPDATE kv SET value=value+? WHERE key='global_total'`).run(earned);
    });
    tx();
  }

  const b = getBalance(u.user_id);
  return c.json({
    earned,
    capped: avgWatts > config.maxPlausibleWatts,
    balance: round2(b.balance),
    total: round2(b.total),
    today: round2(b.today),
  });
});

// —— 排行榜 ——
app.get('/api/leaderboard', (c) => {
  const t = todayStr();
  const rows = db
    .prepare(
      `SELECT u.user_id, u.nickname, u.avatar_url,
              b.total, CASE WHEN b.day = ? THEN b.today ELSE 0 END AS today
       FROM balances b JOIN users u ON u.user_id = b.user_id
       ORDER BY b.total DESC LIMIT 50`,
    )
    .all(t) as any[];
  const global = db.prepare(`SELECT value FROM kv WHERE key='global_total'`).get() as any;
  return c.json({
    top: rows.map((r, i) => ({ rank: i + 1, ...r, total: round2(r.total), today: round2(r.today) })),
    global_total: round2(global?.value ?? 0),
  });
});

function getBalance(userId: number) {
  db.prepare(`INSERT OR IGNORE INTO balances(user_id, updated_at) VALUES(?, ?)`).run(
    userId,
    Date.now(),
  );
  return db.prepare(`SELECT * FROM balances WHERE user_id = ?`).get(userId) as any;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  console.log(`[tokenbike] api listening on http://127.0.0.1:${info.port}`);
});
