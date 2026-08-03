export interface Me {
  user_id: number;
  nickname: string;
  avatar_url: string;
  balance: number;
  total: number;
  today: number;
}

export interface SyncResult {
  earned: number;
  capped: boolean;
  balance: number;
  total: number;
  today: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  nickname: string;
  avatar_url: string;
  total: number;
  today: number;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin', ...init });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json() as Promise<T>;
}

export const api = {
  me: () => req<{ user: Me | null }>('/api/auth/me'),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  sync: (joules: number, windowSec: number) =>
    req<SyncResult>('/api/pedal/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joules, window_sec: windowSec }),
    }),
  leaderboard: () =>
    req<{ top: LeaderboardEntry[]; global_total: number }>('/api/leaderboard'),
};
