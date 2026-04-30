/**
 * Server-side MOHS update service.
 *
 * Applies the MOHS update rule to a problem and persists both the updated
 * `problems.mohs` column and an event row in `problem_difficulty_events`.
 */

import { getDb } from '../db/database';

export const MOHS_MIN = -60;
export const MOHS_MAX = 60;
export const MOHS_STEP = 5;
const USER_WEIGHT = 0.30;

const SOURCE_BOUNDS: Record<string, { floor?: number; ceiling?: number }> = {
  IMO_P1: { floor: 15, ceiling: 40 },
  IMO_P2: { floor: 25, ceiling: 50 },
  IMO_P3: { floor: 40, ceiling: 60 },
  IMO_P4: { floor: 15, ceiling: 40 },
  IMO_P5: { floor: 25, ceiling: 50 },
  IMO_P6: { floor: 40, ceiling: 60 },
  RMM_P3: { floor: 35, ceiling: 60 },
  EGMO_P4: { floor: 30, ceiling: 55 },
  BMO:     { floor: 10, ceiling: 45 },
  IMO:     { floor: 20 },
  AoPS:    {},
};

function ratingToMohs(rating: number): number {
  const clamped = Math.max(1, Math.min(10, rating));
  return Math.round((clamped * 5) / MOHS_STEP) * MOHS_STEP;
}

function quantise(raw: number): number {
  return Math.round(raw / MOHS_STEP) * MOHS_STEP;
}

function clamp(v: number): number {
  return Math.max(MOHS_MIN, Math.min(MOHS_MAX, v));
}

function applySourceBounds(mohs: number, sourceTag: string | null): number {
  if (!sourceTag) return mohs;
  const bounds = SOURCE_BOUNDS[sourceTag] ?? SOURCE_BOUNDS[sourceTag.split('_')[0]] ?? {};
  let v = mohs;
  if (bounds.floor !== undefined) v = Math.max(v, bounds.floor);
  if (bounds.ceiling !== undefined) v = Math.min(v, bounds.ceiling);
  return quantise(clamp(v));
}

interface ProblemRow {
  id: number;
  mohs: number;
  mohs_locked: number;
  source_tag: string | null;
}

/**
 * Apply a user rating to a problem's MOHS and persist the change.
 * Returns the new MOHS value (or the current one if no change was needed).
 */
export function applyUserRating(problemId: number, userRating: number): number {
  const db = getDb();

  const row = db.prepare(
    'SELECT id, mohs, mohs_locked, source_tag FROM problems WHERE id = ?',
  ).get(problemId) as ProblemRow | undefined;

  if (!row) throw new Error(`Problem ${problemId} not found`);
  if (row.mohs_locked) return row.mohs;

  const perceived = ratingToMohs(userRating);
  const rawNew = row.mohs * (1 - USER_WEIGHT) + perceived * USER_WEIGHT;
  let newMohs = quantise(clamp(rawNew));
  newMohs = applySourceBounds(newMohs, row.source_tag);

  if (newMohs === row.mohs) return row.mohs;

  const updateProblem = db.prepare(
    'UPDATE problems SET mohs = ? WHERE id = ?',
  );
  const insertEvent = db.prepare(
    `INSERT INTO problem_difficulty_events (problem_id, old_mohs, new_mohs, reason)
     VALUES (?, ?, ?, ?)`,
  );

  const runUpdate = db.transaction(() => {
    updateProblem.run(newMohs, problemId);
    insertEvent.run(problemId, row.mohs, newMohs, `user_rating:${userRating}`);
  });

  runUpdate();
  return newMohs;
}
