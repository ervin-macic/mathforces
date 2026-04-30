/**
 * Server-side recommendation service.
 *
 * Queries the SQLite DB to build a user's knowledge profile, then applies
 * the same scoring algorithm as the frontend engine.
 *
 * The frontend can call `GET /api/recommend?userId=<id>&currentProblemId=<id>&action=<solved|skipped>`
 * and receive the next recommended problem.
 */

import { getDb } from '../db/database';

// ─── Scoring weights (must match frontend engine) ────────────────────────────
const W_WEAK_TOPIC  = 0.40;
const W_DIFFICULTY  = 0.35;
const W_RECENCY     = 0.15;
const W_DIVERSITY   = 0.10;
const RECENCY_WINDOW = 5;
const TOPIC_DIVERSITY_WINDOW = 3;
const SKIP_EASIER_BIAS = 3;

// ─── Types ───────────────────────────────────────────────────────────────────
interface ProblemRow {
  id: number;
  statement: string;
  topic: string;
  source_ref: string | null;
  source_tag: string | null;
  hint1: string;
  hint2: string;
  hint3: string;
  solution: string;
  mohs: number;
}

interface TopicStats {
  totalAttempts: number;
  totalSolved: number;
  avgSolvedMohs: number;
  avgTimeSpent: number;
  recentProblemIds: number[];
}

// ─── Profile building ─────────────────────────────────────────────────────────

function buildTopicStats(userId: number): Record<string, TopicStats> {
  const db = getDb();

  const rows = db.prepare<[number], {
    topic: string;
    status: string;
    mohs: number;
    time_spent_sec: number;
    problem_id: number;
    created_at: string;
  }>(`
    SELECT p.topic, a.status, p.mohs, a.time_spent_sec, a.problem_id, a.created_at
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    WHERE a.user_id = ?
    ORDER BY a.created_at ASC
  `).all(userId);

  const stats: Record<string, TopicStats> = {};

  for (const row of rows) {
    if (!stats[row.topic]) {
      stats[row.topic] = {
        totalAttempts: 0,
        totalSolved: 0,
        avgSolvedMohs: 0,
        avgTimeSpent: 0,
        recentProblemIds: [],
      };
    }
    const s = stats[row.topic];
    s.totalAttempts++;
    s.avgTimeSpent =
      (s.avgTimeSpent * (s.totalAttempts - 1) + row.time_spent_sec) / s.totalAttempts;

    if (row.status === 'solved') {
      s.totalSolved++;
      s.avgSolvedMohs =
        (s.avgSolvedMohs * (s.totalSolved - 1) + row.mohs) / s.totalSolved;
    }
  }

  // Collect per-topic recent IDs (last RECENCY_WINDOW * 4 solved/skipped)
  const recentRows = [...rows].reverse().slice(0, RECENCY_WINDOW * 8);
  for (const topic of Object.keys(stats)) {
    stats[topic].recentProblemIds = recentRows
      .filter(r => r.topic === topic)
      .map(r => r.problem_id)
      .slice(0, RECENCY_WINDOW);
  }

  return stats;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function weaknessScore(
  topic: string,
  allStats: Record<string, TopicStats>,
): number {
  const s = allStats[topic];
  if (!s || s.totalAttempts === 0) return 0.85;

  const inverseRate = 1 - s.totalSolved / s.totalAttempts;
  const allTimes = Object.values(allStats).map(st => st.avgTimeSpent).filter(t => t > 0);
  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : 1;
  const normTime = s.avgTimeSpent / maxTime;

  return 0.6 * inverseRate + 0.4 * normTime;
}

function difficultyScore(
  problemMohs: number,
  topic: string,
  allStats: Record<string, TopicStats>,
  lastAction: string | null,
  currentMohs: number,
): number {
  const s = allStats[topic];
  let target: number;

  if (s && s.totalSolved > 0) {
    target = s.avgSolvedMohs;
    if (lastAction === 'solved') target += 1;
    else if (lastAction === 'skipped')
      target = Math.min(target, currentMohs - SKIP_EASIER_BIAS);
  } else {
    target = lastAction === 'skipped' ? currentMohs - SKIP_EASIER_BIAS : currentMohs;
  }

  const diff = Math.abs(problemMohs - target);
  return Math.exp(-(diff * diff) / 32);
}

function recencyScore(
  problemId: number,
  sessionProblemIds: number[],
  topicRecentIds: number[],
): number {
  const sessionRecent = sessionProblemIds.slice(-RECENCY_WINDOW);
  const sPos = sessionRecent.indexOf(problemId);
  if (sPos !== -1) return sPos / RECENCY_WINDOW;
  const tPos = topicRecentIds.indexOf(problemId);
  if (tPos !== -1) return 0.5 + 0.5 * (tPos / RECENCY_WINDOW);
  return 1.0;
}

function diversityScore(
  topic: string,
  sessionProblemIds: number[],
  allProblems: ProblemRow[],
): number {
  const recentTopics = sessionProblemIds
    .slice(-TOPIC_DIVERSITY_WINDOW)
    .map(id => allProblems.find(p => p.id === id)?.topic)
    .filter(Boolean) as string[];
  const count = recentTopics.filter(t => t === topic).length;
  return Math.max(0, 1 - count / TOPIC_DIVERSITY_WINDOW);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RecommendOptions {
  userId: number;
  currentProblemId: number | null;
  lastAction: 'solved' | 'skipped' | null;
  sessionProblemIds: number[];
}

/**
 * Return the full next recommended problem row from the DB.
 * Falls back to a random problem if no history exists.
 */
export function recommendNextProblem(opts: RecommendOptions): ProblemRow | null {
  const { userId, currentProblemId, lastAction, sessionProblemIds } = opts;
  const db = getDb();

  const allProblems = db.prepare<[], ProblemRow>(
    'SELECT id, statement, topic, source_ref, source_tag, hint1, hint2, hint3, solution, mohs FROM problems',
  ).all();

  if (allProblems.length === 0) return null;

  const topicStats = buildTopicStats(userId);
  const currentProblem = allProblems.find(p => p.id === currentProblemId) ?? null;
  const currentMohs = currentProblem?.mohs ?? 0;

  const candidates = allProblems.filter(p => p.id !== currentProblemId);
  if (candidates.length === 0) return allProblems[0] ?? null;

  const scored = candidates.map(p => ({
    problem: p,
    score:
      W_WEAK_TOPIC  * weaknessScore(p.topic, topicStats) +
      W_DIFFICULTY  * difficultyScore(p.mohs, p.topic, topicStats, lastAction, currentMohs) +
      W_RECENCY     * recencyScore(p.id, sessionProblemIds, topicStats[p.topic]?.recentProblemIds ?? []) +
      W_DIVERSITY   * diversityScore(p.topic, sessionProblemIds, allProblems),
  }));

  const maxScore = Math.max(...scored.map(s => s.score));
  const pool = scored.filter(s => s.score >= maxScore * 0.98);
  return pool[Math.floor(Math.random() * pool.length)].problem;
}

/**
 * Format a DB problem row as the frontend Problem shape.
 */
export function formatProblemForClient(row: ProblemRow) {
  return {
    id: row.id,
    statement: row.statement,
    topic: row.topic,
    hints: [row.hint1, row.hint2, row.hint3],
    solution: row.solution || undefined,
    difficulty: row.mohs,
    source_ref: row.source_ref ?? undefined,
    source_tag: row.source_tag ?? undefined,
  };
}
