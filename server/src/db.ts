import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'tokenbike.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id    INTEGER PRIMARY KEY,
  nickname   TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(user_id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS balances (
  user_id    INTEGER PRIMARY KEY REFERENCES users(user_id),
  balance    REAL NOT NULL DEFAULT 0,
  total      REAL NOT NULL DEFAULT 0,
  today      REAL NOT NULL DEFAULT 0,
  day        TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value REAL NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO kv(key, value) VALUES ('global_total', 0);
`);

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function touchDay(b: { today: number; day: string }) {
  const t = todayStr();
  if (b.day !== t) {
    b.today = 0;
    b.day = t;
  }
  return b;
}
