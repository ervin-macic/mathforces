/**
 * Seed the database with problems from data/problems.seed.json.
 *
 * Run with:
 *   ts-node src/db/seed.ts
 *
 * The script is idempotent: it skips problems whose statement already exists
 * in the database (matched by the first 80 characters of the statement).
 * To re-seed from scratch, delete `server/data/mathforces.db` first.
 */

import path from 'path';
import fs from 'fs';
import { getDb } from './database';
import { MOHS_MIN, MOHS_MAX } from '../services/mohsService';

interface SeedProblem {
  statement: string;
  topic: string;
  source_ref?: string;
  source_tag?: string;
  mohs: number;
  mohs_locked?: number;
  hint1: string;
  hint2: string;
  hint3: string;
  solution?: string;
}

const SEED_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'problems.seed.json');

function validateSeedRow(row: unknown, index: number): row is SeedProblem {
  const r = row as any;
  if (typeof r.statement !== 'string' || r.statement.trim() === '') {
    console.warn(`[seed] Row ${index}: missing statement — skipping`);
    return false;
  }
  if (!['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'].includes(r.topic)) {
    console.warn(`[seed] Row ${index}: invalid topic "${r.topic}" — skipping`);
    return false;
  }
  if (typeof r.mohs !== 'number' || r.mohs < MOHS_MIN || r.mohs > MOHS_MAX) {
    console.warn(`[seed] Row ${index}: mohs ${r.mohs} out of range — skipping`);
    return false;
  }
  if (!r.hint1 || !r.hint2 || !r.hint3) {
    console.warn(`[seed] Row ${index}: missing one or more hints — skipping`);
    return false;
  }
  return true;
}

function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found at: ${SEED_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(SEED_PATH, 'utf-8');
  const problems: unknown[] = JSON.parse(raw);

  const db = getDb();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO problems
      (statement, topic, source_ref, source_tag, hint1, hint2, hint3, mohs, mohs_locked, solution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO problem_difficulty_events
      (problem_id, old_mohs, new_mohs, reason)
    VALUES (?, 0, ?, 'seed_import')
  `);

  // Check for duplicates by statement prefix
  const existingStatements = new Set<string>(
    (db.prepare('SELECT statement FROM problems').all() as { statement: string }[])
      .map(r => r.statement.slice(0, 80)),
  );

  let inserted = 0;
  let skipped = 0;

  const runBatch = db.transaction(() => {
    problems.forEach((row, i) => {
      if (!validateSeedRow(row, i)) { skipped++; return; }
      const prefix = row.statement.slice(0, 80);
      if (existingStatements.has(prefix)) {
        console.log(`[seed] Skipping duplicate: "${prefix.slice(0, 50)}..."`);
        skipped++;
        return;
      }

      // Round mohs to nearest 5
      const mohs = Math.round(row.mohs / 5) * 5;

      const info = insert.run(
        row.statement,
        row.topic,
        row.source_ref ?? null,
        row.source_tag ?? null,
        row.hint1,
        row.hint2,
        row.hint3,
        mohs,
        row.mohs_locked ?? 0,
        row.solution ?? '',
      );

      if (info.changes > 0) {
        insertEvent.run(info.lastInsertRowid, mohs);
        existingStatements.add(prefix);
        inserted++;
      }
    });
  });

  runBatch();

  console.log(`\n✓ Seed complete — inserted: ${inserted}, skipped: ${skipped}`);
  db.close();
}

main();
