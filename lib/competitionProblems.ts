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

const SELECTION_ATTEMPTS = 20000;

function topicKey(p: Problem): string {
  return (p.topic ?? '').trim() || '__unknown__';
}

function isValidP2(p1: Problem, p2: Problem): boolean {
  if (p2.id === p1.id) return false;
  if (topicKey(p2) === topicKey(p1)) return false;
  if (p2.difficulty < SLOT2_MIN || p2.difficulty > SLOT2_MAX) return false;
  if (p2.difficulty <= p1.difficulty) return false;
  return true;
}

function isValidP3(p1: Problem, p2: Problem, p3: Problem): boolean {
  if (p3.id === p1.id || p3.id === p2.id) return false;
  const k3 = topicKey(p3);
  if (k3 === topicKey(p1) || k3 === topicKey(p2)) return false;
  if (p3.difficulty < SLOT3_MIN) return false;
  if (p3.difficulty <= p2.difficulty) return false;
  return true;
}

/**
 * Whether any triple exists: three distinct topics, MOHS strictly increasing,
 * within the configured MOHS bands for each slot.
 */
export function canPickCompetitionProblems(problems: Problem[]): boolean {
  const slot1 = problems.filter(
    p => p.difficulty >= SLOT1_MIN && p.difficulty <= SLOT1_MAX,
  );
  for (const p1 of slot1) {
    for (const p2 of problems) {
      if (!isValidP2(p1, p2)) continue;
      for (const p3 of problems) {
        if (isValidP3(p1, p2, p3)) return true;
      }
    }
  }
  return false;
}

/**
 * Pick three problems: distinct topics, strictly increasing MOHS, random among valid triples.
 * Returns null if no triple satisfies constraints.
 */
export function pickCompetitionProblems(problems: Problem[]): Problem[] | null {
  const slot1 = problems.filter(
    p => p.difficulty >= SLOT1_MIN && p.difficulty <= SLOT1_MAX,
  );
  if (slot1.length === 0) return null;

  for (let i = 0; i < SELECTION_ATTEMPTS; i++) {
    const p1 = slot1[randomIntExclusive(slot1.length)];
    const p2Candidates = problems.filter(p => isValidP2(p1, p));
    if (p2Candidates.length === 0) continue;
    const p2 = p2Candidates[randomIntExclusive(p2Candidates.length)];
    const p3Candidates = problems.filter(p => isValidP3(p1, p2, p));
    if (p3Candidates.length === 0) continue;
    const p3 = p3Candidates[randomIntExclusive(p3Candidates.length)];
    return [p1, p2, p3];
  }

  // Extremely unlikely: guarantee a triple if one exists (deterministic order).
  for (const p1 of slot1) {
    for (const p2 of problems) {
      if (!isValidP2(p1, p2)) continue;
      for (const p3 of problems) {
        if (isValidP3(p1, p2, p3)) return [p1, p2, p3];
      }
    }
  }

  return null;
}
