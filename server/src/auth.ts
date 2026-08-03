import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { db } from './db.js';
import { config } from './config.js';

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export interface SessionUser {
  user_id: number;
  nickname: string;
  avatar_url: string;
}

const OAUTH_COOKIE = 'tb_oauth';
const SESSION_COOKIE = 'tb_session';

export async function handleLogin(c: Context) {
  const state = b64url(randomBytes(16));
  const { verifier, challenge } = pkce();
  await setSignedCookie(c, OAUTH_COOKIE, JSON.stringify({ state, verifier }), config.cookieSecret, {
    httpOnly: true,
    secure: config.publicOrigin.startsWith('https'),
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });
  const url = new URL(config.watchaAuthorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.watchaClientId,
    redirect_uri: config.redirectUri,
    scope: 'read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return c.redirect(url.toString());
}

export async function handleCallback(c: Context) {
  const err = c.req.query('error');
  if (err) return c.redirect(`/?oauth_error=${encodeURIComponent(err)}`);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const jarRaw = await getSignedCookie(c, config.cookieSecret, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: '/' });
  if (!code || !state || !jarRaw) return c.redirect('/?oauth_error=missing_params');

  let jar: { state: string; verifier: string };
  try {
    jar = JSON.parse(jarRaw);
  } catch {
    return c.redirect('/?oauth_error=bad_jar');
  }
  if (jar.state !== state) return c.redirect('/?oauth_error=bad_state');

  // code → token
  const tokenResp = await fetch(config.watchaTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.watchaClientId,
      client_secret: config.watchaClientSecret,
      code_verifier: jar.verifier,
    }).toString(),
  });
  const tokenJson: any = await tokenResp.json().catch(() => null);
  if (!tokenResp.ok || !tokenJson?.access_token) {
    return c.redirect(`/?oauth_error=${encodeURIComponent(tokenJson?.error_description || 'token_failed')}`);
  }

  // token → userinfo
  const uiResp = await fetch(
    `${config.watchaUserinfoUrl}?access_token=${encodeURIComponent(tokenJson.access_token)}`,
  );
  const uiJson: any = await uiResp.json().catch(() => null);
  const info = uiJson?.data;
  if (!uiResp.ok || !info?.user_id) {
    return c.redirect(`/?oauth_error=${encodeURIComponent(uiJson?.message || 'userinfo_failed')}`);
  }

  db.prepare(
    `INSERT INTO users(user_id, nickname, avatar_url, created_at) VALUES(?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname, avatar_url=excluded.avatar_url`,
  ).run(info.user_id, info.nickname ?? '', info.avatar_url ?? '', Date.now());
  db.prepare(`INSERT OR IGNORE INTO balances(user_id, updated_at) VALUES(?, ?)`).run(
    info.user_id,
    Date.now(),
  );

  const sessionToken = b64url(randomBytes(32));
  const expiresAt = Date.now() + config.sessionTtlSec * 1000;
  db.prepare(`INSERT INTO sessions(token, user_id, expires_at) VALUES(?,?,?)`).run(
    sessionToken,
    info.user_id,
    expiresAt,
  );
  await setSignedCookie(c, SESSION_COOKIE, sessionToken, config.cookieSecret, {
    httpOnly: true,
    secure: config.publicOrigin.startsWith('https'),
    sameSite: 'Lax',
    maxAge: config.sessionTtlSec,
    path: '/',
  });
  return c.redirect('/');
}

export async function currentUser(c: Context): Promise<SessionUser | null> {
  const token = await getSignedCookie(c, config.cookieSecret, SESSION_COOKIE);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.user_id, u.nickname, u.avatar_url FROM sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as SessionUser | undefined;
  return row ?? null;
}

export async function handleLogout(c: Context) {
  const token = await getSignedCookie(c, config.cookieSecret, SESSION_COOKIE);
  if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
}
