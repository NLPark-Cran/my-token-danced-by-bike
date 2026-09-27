import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { db } from './db.js';
import { config } from './config.js';

const SESSION_COOKIE = 'tokenbike_session';
const OAUTH_COOKIE = 'tokenbike_oauth';
const cookieOptions = { httpOnly: true, secure: config.publicOrigin.startsWith('https:'), sameSite: 'Lax' as const, path: '/' };

const b64url = (buffer: Buffer) => buffer.toString('base64url');
const sha256 = (value: string) => b64url(createHash('sha256').update(value).digest());

export async function beginLogin(c: Context) {
  if (!config.oauth.clientId) return c.json({ error: 'OAuth client is not configured yet' }, 503);
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const payload = Buffer.from(JSON.stringify({ state, verifier, at: Date.now() })).toString('base64url');
  await setSignedCookie(c, OAUTH_COOKIE, payload, config.cookieSecret, { ...cookieOptions, maxAge: 600 });
  const url = new URL(config.oauth.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.oauth.clientId);
  url.searchParams.set('redirect_uri', config.oauth.redirectUri);
  url.searchParams.set('scope', config.oauth.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', sha256(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return c.redirect(url.toString());
}

export async function finishLogin(c: Context) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const signed = await getSignedCookie(c, config.cookieSecret, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, cookieOptions);
  if (!code || !state || !signed) return c.json({ error: 'Invalid OAuth callback' }, 400);
  let saved: { state: string; verifier: string; at: number };
  try { saved = JSON.parse(Buffer.from(signed, 'base64url').toString('utf8')); }
  catch { return c.json({ error: 'Invalid OAuth state' }, 400); }
  if (saved.state !== state || Date.now() - saved.at > 600_000) return c.json({ error: 'Expired OAuth state' }, 400);

  const form = new URLSearchParams({
    grant_type: 'authorization_code', code,
    redirect_uri: config.oauth.redirectUri,
    client_id: config.oauth.clientId,
    client_secret: config.oauth.clientSecret,
    code_verifier: saved.verifier,
  });
  const tokenResponse = await fetch(config.oauth.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  if (!tokenResponse.ok) return c.json({ error: 'Token exchange failed' }, 502);
  const token = await tokenResponse.json() as { access_token: string; refresh_token?: string };
  const profileResponse = await fetch(config.oauth.userInfoUrl, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) return c.json({ error: 'User profile failed' }, 502);
  const profile = await profileResponse.json() as Record<string, unknown>;
  const watchaId = String(profile.id ?? profile.user_id ?? '');
  if (!watchaId) return c.json({ error: 'Profile missing user id' }, 502);
  const nickname = String(profile.nickname ?? profile.name ?? `骑手-${watchaId.slice(-4)}`);
  const avatar = String(profile.avatar_url ?? profile.avatar ?? '');
  const upsert = db.prepare(`INSERT INTO users (watcha_id,nickname,avatar_url,access_token,refresh_token)
    VALUES (?,?,?,?,?) ON CONFLICT(watcha_id) DO UPDATE SET nickname=excluded.nickname,avatar_url=excluded.avatar_url,
    access_token=excluded.access_token,refresh_token=excluded.refresh_token,updated_at=CURRENT_TIMESTAMP RETURNING id`);
  const row = upsert.get(watchaId, nickname, avatar, token.access_token, token.refresh_token ?? '') as { id: number };
  db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(row.id);
  await setSignedCookie(c, SESSION_COOKIE, String(row.id), config.cookieSecret, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  return c.redirect(config.publicOrigin);
}

export async function currentUserId(c: Context) {
  const value = await getSignedCookie(c, config.cookieSecret, SESSION_COOKIE);
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function logout(c: Context) {
  deleteCookie(c, SESSION_COOKIE, cookieOptions);
  return c.json({ ok: true });
}

/*
Design note: OAuth state is short-lived and signed.
Design note: PKCE uses an S256 verifier challenge.
Design note: Secrets remain on the server.
Design note: The profile upsert preserves one local user.
Design note: OAuth state is short-lived and signed.
Design note: PKCE uses an S256 verifier challenge.
Design note: Secrets remain on the server.
                 */