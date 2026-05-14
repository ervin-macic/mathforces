import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

function resolveDatabasePath(): string {
  const raw = process.env.MATHFORCES_DB_PATH?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  // Compiled from server/dist/db/*.js → ../../data = server/data (not repo-root /data).
  const dir = path.resolve(__dirname, '..', '..', 'data');
  return path.join(dir, 'mathforces.db');
}

const DB_PATH = resolveDatabasePath();
const DB_DIR = path.dirname(DB_PATH);

let _db: Database.Database | null = null;

/**
 * Return (or lazily create) the singleton SQLite connection.
 * Runs schema migration on first open.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  const existsBefore = fs.existsSync(DB_PATH);
  const sizeBefore = existsBefore ? fs.statSync(DB_PATH).size : 0;
  console.log('[MathForces db] opening SQLite', {
    MATHFORCES_DB_PATH: process.env.MATHFORCES_DB_PATH ?? '(unset — using compiled default)',
    cwd: process.cwd(),
    __dirname,
    DB_PATH,
    existsBeforeOpen: existsBefore,
    sizeBytesBeforeOpen: sizeBefore,
  });

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.exec(SCHEMA_SQL);

  // Additive column migrations — safe to run on every open (errors are swallowed).
  // Each ALTER TABLE is intentionally separate so one failure does not block others.
  const migrations = [
    `ALTER TABLE problems ADD COLUMN solution TEXT NOT NULL DEFAULT ''`,
    // Google OAuth user columns. Existing rows keep their password_hash; new
    // Google-only rows insert '' as a sentinel since SQLite cannot drop the
    // legacy NOT NULL constraint via ALTER.
    `ALTER TABLE users ADD COLUMN google_sub   TEXT`,
    `ALTER TABLE users ADD COLUMN email        TEXT`,
    `ALTER TABLE users ADD COLUMN display_name TEXT`,
    `ALTER TABLE users ADD COLUMN picture_url  TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)`,
  ];
  for (const sql of migrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  // Enable foreign keys for this connection
  _db.pragma('foreign_keys = ON');

  try {
    const row = _db.prepare('SELECT COUNT(*) AS c FROM problems').get() as { c: number };
    console.log('[MathForces db] problems table row count:', row.c);
  } catch (e) {
    console.warn('[MathForces db] could not count problems rows:', e);
  }

  return _db;
}

export default getDb;
