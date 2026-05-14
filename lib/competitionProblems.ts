import type { Problem } from '../types';
import { randomIntExclusive } from './random';

/** Slot 1: ~5–10 MOHS */
const SLOT1_MIN = 5;
const SLOT1_MAX = 10;

/** Slot 2: 15–35 MOHS */
const SLOT2_MIN = 15;
const SLOT2_MAX = 35;

/** Slot 3: at least 25 MOHS */
const SLOT3_MIN = 25;

function topicKey(p: Problem): string {
  return (p.topic ?? '').trim() || '__unknown__';
}

function isValidTriple(p1: Problem, p2: Problem, p3: Problem): boolean {
  if (p1.id === p2.id || p1.id === p3.id || p2.id === p3.id) return false;
  const k1 = topicKey(p1);
  const k2 = topicKey(p2);
  const k3 = topicKey(p3);
  if (k1 === k2 || k1 === k3 || k2 === k3) return false;
  return true;
}

function pools(problems: Problem[]) {
  const pool1 = problems.filter(
    p => p.difficulty >= SLOT1_MIN && p.difficulty <= SLOT1_MAX,
  );
  const pool2 = problems.filter(
    p => p.difficulty >= SLOT2_MIN && p.difficulty <= SLOT2_MAX,
  );
  const pool3 = problems.filter(p => p.difficulty >= SLOT3_MIN);
  return { pool1, pool2, pool3 };
}

/**
 * Whether any triple exists: three distinct topics, MOHS in each slot band.
 * Order between slots is not enforced beyond those bands (e.g. P3 may be easier than P2).
 */
export function canPickCompetitionProblems(problems: Problem[]): boolean {
  const { pool1, pool2, pool3 } = pools(problems);
  for (const p1 of pool1) {
    for (const p2 of pool2) {
      for (const p3 of pool3) {
        if (isValidTriple(p1, p2, p3)) return true;
      }
    }
  }
  return false;
}

/**
 * Uniform random valid triple (same distribution every call → good variety on “Generate new”).
 */
export function pickCompetitionProblems(problems: Problem[]): Problem[] | null {
  const { pool1, pool2, pool3 } = pools(problems);
  if (pool1.length === 0 || pool2.length === 0 || pool3.length === 0) return null;

  let total = 0;
  for (const p1 of pool1) {
    for (const p2 of pool2) {
      for (const p3 of pool3) {
        if (isValidTriple(p1, p2, p3)) total++;
      }
    }
  }
  if (total === 0) return null;

  let target = randomIntExclusive(total);
  for (const p1 of pool1) {
    for (const p2 of pool2) {
      for (const p3 of pool3) {
        if (!isValidTriple(p1, p2, p3)) continue;
        if (target === 0) return [p1, p2, p3];
        target--;
      }
    }
  }

  return null;
}
