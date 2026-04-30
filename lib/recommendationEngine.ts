/**
 * Recommendation Engine for MathForces
 *
 * Responsible for selecting the next problem based on a user's knowledge profile.
 * Kept as a pure TypeScript module with no React dependencies so it can be
 * imported on both the frontend and server-side.
 *
 * Scoring model (all weights sum to 1.0):
 *   - Weak-topic bonus    (0.40): prefer topics where the user has a low solve rate and/or
 *                                 high average time relative to difficulty
 *   - Difficulty proximity (0.35): target problems near the user's estimated skill band
 *                                  per topic; skip pressure biases toward easier problems
 *   - Recency penalty     (0.15): penalise problems shown recently in the session
 *   - Diversity bonus     (0.10): slightly prefer topics not shown in the last few turns
 *
 * For multi-user readiness all public functions accept a full profile object rather
 * than reading from any global state.
 */

import { Problem, SolvedProblem, TopicProfile, UserKnowledgeProfile } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENCY_WINDOW = 5;          // number of recent session problems that incur a penalty
const TOPIC_DIVERSITY_WINDOW = 3;  // last N problem topics that incur a diversity penalty
const SKIP_EASIER_BIAS = 3;        // shift target difficulty this many MOHS points easier on skip

// Scoring weights (must sum to 1)
const W_WEAK_TOPIC   = 0.40;
const W_DIFFICULTY   = 0.35;
const W_RECENCY      = 0.15;
const W_DIVERSITY    = 0.10;

// ---------------------------------------------------------------------------
// Profile building
// ---------------------------------------------------------------------------

/**
 * Derive a UserKnowledgeProfile from the full history of solved/skipped problems.
 * Keeps only the last RECENCY_WINDOW IDs as session context.
 */
export function buildUserKnowledgeProfile(
  solvedProblems: SolvedProblem[],
  sessionProblemIds: number[],
  currentProblemId: number | null,
  lastAction: 'solved' | 'skipped' | null,
): UserKnowledgeProfile {
  const topicProfiles: Record<string, TopicProfile> = {};

  for (const sp of solvedProblems) {
    const { topic } = sp.problem;
    if (!topicProfiles[topic]) {
      topicProfiles[topic] = {
        topic,
        totalAttempts: 0,
        totalSolved: 0,
        avgSolvedDifficulty: 0,
        avgTimeSpent: 0,
        solveRate: 0,
        recentProblemIds: [],
      };
    }
    const profile = topicProfiles[topic];
    profile.totalAttempts += 1;
    if (sp.status !== 'skipped') {
      profile.totalSolved += 1;
      // Running average of difficulty for solved problems
      profile.avgSolvedDifficulty =
        (profile.avgSolvedDifficulty * (profile.totalSolved - 1) + sp.problem.difficulty) /
        profile.totalSolved;
    }
    // Running average of time spent (all attempts)
    profile.avgTimeSpent =
      (profile.avgTimeSpent * (profile.totalAttempts - 1) + sp.timeSpent) /
      profile.totalAttempts;
  }

  // Compute solve rates and collect recent problem IDs per topic
  const recentHistory = [...solvedProblems].reverse().slice(0, RECENCY_WINDOW * 4);
  for (const topic of Object.keys(topicProfiles)) {
    const profile = topicProfiles[topic];
    profile.solveRate =
      profile.totalAttempts > 0 ? profile.totalSolved / profile.totalAttempts : 0;
    profile.recentProblemIds = recentHistory
      .filter(sp => sp.problem.topic === topic)
      .map(sp => sp.problem.id)
      .slice(0, RECENCY_WINDOW);
  }

  return {
    topicProfiles,
    sessionProblemIds,
    currentProblemId,
    lastAction,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a [0, 1] weakness score for a topic.
 * High score → the user needs more practice in this topic.
 *
 * Combines:
 *   - Inverse solve rate: 1 - solveRate
 *   - Normalised average time: higher time relative to topic norms → higher weakness
 */
function topicWeaknessScore(
  topicProfile: TopicProfile | undefined,
  allTopicProfiles: Record<string, TopicProfile>,
): number {
  if (!topicProfile || topicProfile.totalAttempts === 0) {
    // Unseen topics are high priority – the user has never tried them
    return 0.85;
  }

  const inverseRate = 1 - topicProfile.solveRate;

  // Normalise avgTimeSpent across all known topics
  const allTimes = Object.values(allTopicProfiles)
    .map(tp => tp.avgTimeSpent)
    .filter(t => t > 0);
  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : 1;
  const normalisedTime = topicProfile.avgTimeSpent / maxTime;

  return 0.6 * inverseRate + 0.4 * normalisedTime;
}

/**
 * Compute a [0, 1] difficulty proximity score.
 * High score → the problem difficulty is close to the user's target for this topic.
 *
 * Target difficulty = current solved average for the topic, optionally adjusted for
 * skip pressure (biased easier) or progression (biased slightly harder after solving).
 */
function difficultyProximityScore(
  problemDifficulty: number,
  topicProfile: TopicProfile | undefined,
  lastAction: 'solved' | 'skipped' | null,
  currentProblemDifficulty: number,
): number {
  let targetDifficulty: number;

  if (topicProfile && topicProfile.totalSolved > 0) {
    targetDifficulty = topicProfile.avgSolvedDifficulty;
    if (lastAction === 'solved') {
      // Encourage slight upward progression
      targetDifficulty += 1;
    } else if (lastAction === 'skipped') {
      // Back off from the current difficulty
      targetDifficulty = Math.min(targetDifficulty, currentProblemDifficulty - SKIP_EASIER_BIAS);
    }
  } else {
    // No history for this topic: target near the current problem difficulty
    targetDifficulty = lastAction === 'skipped'
      ? currentProblemDifficulty - SKIP_EASIER_BIAS
      : currentProblemDifficulty;
  }

  const diff = Math.abs(problemDifficulty - targetDifficulty);
  // Gaussian-like decay: score = exp(-diff^2 / (2 * sigma^2)), sigma ≈ 4 MOHS
  return Math.exp(-(diff * diff) / 32);
}

/**
 * Compute a [0, 1] recency penalty inverted to a bonus.
 * Problems not seen recently score 1.0; recently-seen ones score lower.
 */
function recencyScore(
  problemId: number,
  sessionProblemIds: number[],
  topicRecentIds: number[],
): number {
  const sessionRecent = sessionProblemIds.slice(-RECENCY_WINDOW);
  const sessionPos = sessionRecent.indexOf(problemId);
  if (sessionPos !== -1) {
    // Closer to the end = more recently seen
    return sessionPos / RECENCY_WINDOW;
  }
  const topicPos = topicRecentIds.indexOf(problemId);
  if (topicPos !== -1) {
    return 0.5 + 0.5 * (topicPos / RECENCY_WINDOW);
  }
  return 1.0;
}

/**
 * Compute a [0, 1] topic diversity bonus.
 * Penalises the same topic appearing in the last TOPIC_DIVERSITY_WINDOW problems.
 */
function diversityScore(
  topic: string,
  sessionProblemIds: number[],
  allProblems: Problem[],
): number {
  const recentTopics = sessionProblemIds
    .slice(-TOPIC_DIVERSITY_WINDOW)
    .map(id => allProblems.find(p => p.id === id)?.topic)
    .filter(Boolean) as string[];
  const count = recentTopics.filter(t => t === topic).length;
  return Math.max(0, 1 - count / TOPIC_DIVERSITY_WINDOW);
}

/**
 * Score a single candidate problem against the user profile.
 * Returns a score in [0, 1]; higher is better.
 */
export function scoreCandidateProblem(
  candidate: Problem,
  profile: UserKnowledgeProfile,
  allProblems: Problem[],
): number {
  const { topicProfiles, sessionProblemIds, lastAction, currentProblemId } = profile;
  const currentProblem = allProblems.find(p => p.id === currentProblemId);
  const currentDifficulty = currentProblem?.difficulty ?? 0;

  const topicProfile = topicProfiles[candidate.topic];

  const s_weak = topicWeaknessScore(topicProfile, topicProfiles);
  const s_diff = difficultyProximityScore(
    candidate.difficulty,
    topicProfile,
    lastAction,
    currentDifficulty,
  );
  const s_recency = recencyScore(
    candidate.id,
    sessionProblemIds,
    topicProfile?.recentProblemIds ?? [],
  );
  const s_diversity = diversityScore(candidate.topic, sessionProblemIds, allProblems);

  return (
    W_WEAK_TOPIC * s_weak +
    W_DIFFICULTY * s_diff +
    W_RECENCY    * s_recency +
    W_DIVERSITY  * s_diversity
  );
}

// ---------------------------------------------------------------------------
// Main selection function
// ---------------------------------------------------------------------------

/**
 * Select the next problem index from `problems` given the user's knowledge profile.
 *
 * Returns the index into `problems` of the chosen problem.
 *
 * Excludes the current problem. If no suitable candidate is found (e.g. only one
 * problem in the list), falls back to a random pick.
 */
export function getNextProblemIndex(
  problems: Problem[],
  profile: UserKnowledgeProfile,
): number {
  if (problems.length === 0) return 0;
  if (problems.length === 1) return 0;

  const candidates = problems
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.id !== profile.currentProblemId);

  if (candidates.length === 0) return 0;

  // Score all candidates
  const scored = candidates.map(({ p, index }) => ({
    index,
    score: scoreCandidateProblem(p, profile, problems),
  }));

  // Find max score and collect all candidates within 2% of it (tie-breaking pool)
  const maxScore = Math.max(...scored.map(s => s.score));
  const pool = scored.filter(s => s.score >= maxScore * 0.98);

  // Pick randomly from the pool to add variety while still respecting the ranking
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return chosen.index;
}

/**
 * Convenience: given a `SolvedProblem` array plus session context,
 * build the profile and immediately return the next problem index.
 */
export function selectNextProblem(
  problems: Problem[],
  solvedProblems: SolvedProblem[],
  sessionProblemIds: number[],
  currentProblemId: number | null,
  lastAction: 'solved' | 'skipped' | null,
): number {
  const profile = buildUserKnowledgeProfile(
    solvedProblems,
    sessionProblemIds,
    currentProblemId,
    lastAction,
  );
  return getNextProblemIndex(problems, profile);
}
