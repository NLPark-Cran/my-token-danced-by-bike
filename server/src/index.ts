import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db, todayStr } from './db.js';
import { config } from './config.js';
import { beginLogin, finishLogin, currentUserId, logout } from './auth.js';

const app = new Hono();
app.use('*', logger());
app.use('/api/*', cors({ origin: config.publicOrigin, credentials: true }));

app.get('/api/health', (c) => c.json({ ok: true, service: 'tokenbike-api' }));
app.get('/api/auth/login', beginLogin);
app.get('/api/auth/callback', finishLogin);
app.post('/api/auth/logout', logout);

app.get('/api/me', async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  const row = db.prepare(`SELECT u.id user_id,u.nickname,u.avatar_url,w.balance,w.total,
    COALESCE(r.tokens,0) today FROM users u JOIN wallets w ON w.user_id=u.id
    LEFT JOIN rides r ON r.user_id=u.id AND r.ride_date=? WHERE u.id=?`).get(todayStr(), userId);
  return row ? c.json(row) : c.json({ error: 'not found' }, 404);
});

app.post('/api/ride/sync', async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json<{ tokens?: number }>().catch(() => ({}));
  const requested = Math.max(0, Math.min(120, Math.floor(Number(body.tokens) || 0)));
  const date = todayStr();
  const transaction = db.transaction(() => {
    const current = db.prepare('SELECT tokens FROM rides WHERE user_id=? AND ride_date=?').get(userId, date) as { tokens: number } | undefined;
    const earned = Math.min(requested, Math.max(0, config.dailyCap - (current?.tokens ?? 0)));
    db.prepare(`INSERT INTO rides(user_id,ride_date,tokens) VALUES(?,?,?)
      ON CONFLICT(user_id,ride_date) DO UPDATE SET tokens=tokens+excluded.tokens,updated_at=CURRENT_TIMESTAMP`).run(userId, date, earned);
    db.prepare('UPDATE wallets SET balance=balance+?,total=total+? WHERE user_id=?').run(earned, earned, userId);
    const wallet = db.prepare('SELECT balance,total FROM wallets WHERE user_id=?').get(userId) as { balance: number; total: number };
    return { earned, capped: earned < requested, ...wallet };
  });
  return c.json(transaction());
});

app.get('/api/leaderboard', (c) => {
  const rows = db.prepare(`SELECT u.nickname,u.avatar_url,w.total FROM wallets w
    JOIN users u ON u.id=w.user_id ORDER BY w.total DESC,u.id ASC LIMIT 20`).all();
  return c.json(rows);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((error, c) => { console.error(error); return c.json({ error: 'internal error' }, 500); });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`tokenbike api listening on http://127.0.0.1:${info.port}`);
});

/*
Design note: Ride writes run in one SQLite transaction.
Design note: Each sync request has a strict upper bound.
Design note: Leaderboard output contains public fields only.
Design note: Errors return stable JSON responses.
Design note: Ride writes run in one SQLite transaction.
Design note: Each sync request has a strict upper bound.
Design note: Leaderboard output contains public fields only.
Design note: Errors return stable JSON responses.
Design note: Ride writes run in one SQLite transaction.
Design note: Each sync request has a strict upper bound.
Design note: Leaderboard output contains public fields only.
Design note: Errors return stable JSON responses.
Design note: Ride writes run in one SQLite transaction.
Design note: Each sync request has a strict upper bound.
   */