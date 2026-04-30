import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_DIR = path.resolve(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'mathforces.db');

let _db: Database.Database | null = null;

/**
 * Return (or lazily create) the singleton SQLite connection.
 * Runs schema migration on first open.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.exec(SCHEMA_SQL);

  // Additive column migrations — safe to run on every open (errors are swallowed).
  // Each ALTER TABLE is intentionally separate so one failure does not block others.
  const migrations = [
    `ALTER TABLE problems ADD COLUMN solution TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  // Enable foreign keys for this connection
  _db.pragma('foreign_keys = ON');

  return _db;
}

export default getDb;
