/**
 * SQLite schema definitions for MathForces.
 *
 * All CREATE TABLE statements use IF NOT EXISTS so the script is idempotent
 * and safe to run on every server start.
 */

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT   NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Problems ───────────────────────────────────────────────────────────────
-- mohs: -60 to +60 stored in multiples of 5.
-- source_tag: e.g. "IMO", "IMO_P6", "RMM_P3", "EGMO", "BMO", "AoPS"
CREATE TABLE IF NOT EXISTS problems (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  statement    TEXT    NOT NULL,
  topic        TEXT    NOT NULL CHECK(topic IN ('Algebra','Geometry','Combinatorics','Number Theory')),
  source_ref   TEXT,                        -- URL or "IMO 2011 Problem 2" etc.
  source_tag   TEXT,                        -- short tag for bounds lookup
  hint1        TEXT    NOT NULL DEFAULT '',
  hint2        TEXT    NOT NULL DEFAULT '',
  hint3        TEXT    NOT NULL DEFAULT '',
  solution     TEXT    NOT NULL DEFAULT '',  -- official solution (Markdown+LaTeX)
  mohs         INTEGER NOT NULL DEFAULT 0   -- current MOHS value
                        CHECK(mohs >= -60 AND mohs <= 60),
  mohs_locked  INTEGER NOT NULL DEFAULT 0   -- 1 = source prior prevents large drift
                        CHECK(mohs_locked IN (0,1)),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to auto-update updated_at on problem edits
CREATE TRIGGER IF NOT EXISTS problems_updated_at
  AFTER UPDATE ON problems
  FOR EACH ROW
BEGIN
  UPDATE problems SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ── Attempts ───────────────────────────────────────────────────────────────
-- One row per problem shown to a user (both solved and skipped).
CREATE TABLE IF NOT EXISTS attempts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id        INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  session_id        TEXT    NOT NULL,        -- UUID of the play session
  status            TEXT    NOT NULL CHECK(status IN ('solved','skipped')),
  time_spent_sec    INTEGER NOT NULL DEFAULT 0,
  user_rating_1_10  INTEGER              -- NULL for skipped attempts
                    CHECK(user_rating_1_10 IS NULL OR
                          (user_rating_1_10 >= 1 AND user_rating_1_10 <= 10)),
  used_hint_level   INTEGER NOT NULL DEFAULT 0
                    CHECK(used_hint_level >= 0 AND used_hint_level <= 3),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_user   ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_problem ON attempts(problem_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);

-- ── Problem difficulty events ───────────────────────────────────────────────
-- Audit trail every time a problem's MOHS is updated.
CREATE TABLE IF NOT EXISTS problem_difficulty_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  old_mohs   INTEGER NOT NULL,
  new_mohs   INTEGER NOT NULL,
  reason     TEXT    NOT NULL,  -- e.g. "user_rating:7" or "seed_import"
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diff_events_problem ON problem_difficulty_events(problem_id);
`;
