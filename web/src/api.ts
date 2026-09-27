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
}

export interface LeaderboardEntry {
  nickname: string;
  avatar_url: string;
  total: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<Me>('/api/me'),
  login: () => { location.href = '/api/auth/login'; },
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  sync: (tokens: number) => request<SyncResult>('/api/ride/sync', { method: 'POST', body: JSON.stringify({ tokens }) }),
  leaderboard: () => request<LeaderboardEntry[]>('/api/leaderboard'),
};

/*
Design note: Requests include the signed session cookie.
                    */