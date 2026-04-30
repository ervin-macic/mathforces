
export enum Page {
  About = 'ABOUT',
  Play = 'PLAY',
  Leaderboard = 'LEADERBOARD',
  Progress = 'PROGRESS',
  SessionSettings = 'SESSION_SETTINGS',
  Competition = 'COMPETITION',
}

export interface Problem {
  id: number;
  statement: string;
  topic: string;
  hints: string[];
  /** Official solution in Markdown+LaTeX; present only for MathNet-imported problems */
  solution?: string;
  /** MOHS difficulty scale: -60 (trivial) to +60 (hardest ever seen), stored in multiples of 5 */
  difficulty: number;
  /** URL or reference string: AoPS thread, IMO official, etc. */
  source_ref?: string;
  /** Source competition tag, e.g. "IMO", "RMM", "EGMO", "BMO", "AoPS" */
  source_tag?: string;
}

export interface SolvedProblem {
  problem: Problem;
  timeSpent: number;         // seconds
  difficultyRating: number;  // 1–10 user rating
  solvedAt: Date;
  usedHintLevel?: number;    // 0–3, how many hints were revealed
  status?: 'solved' | 'skipped';
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  country: string;
}

/**
 * Per-topic aggregated knowledge profile derived from all solved/skipped history.
 * Used by the recommendation engine to compute candidate scores.
 */
export interface TopicProfile {
  topic: string;
  totalAttempts: number;
  totalSolved: number;
  /** Weighted average of difficulty for problems the user has solved in this topic */
  avgSolvedDifficulty: number;
  /** Weighted average of time spent (seconds) in this topic */
  avgTimeSpent: number;
  /** Fraction of attempted problems solved: 0–1 */
  solveRate: number;
  /** IDs of the last N problems shown in this topic (recency tracking) */
  recentProblemIds: number[];
}

/**
 * Full user knowledge profile across all topics.
 */
export interface UserKnowledgeProfile {
  topicProfiles: Record<string, TopicProfile>;
  /** IDs of problems shown in the current session */
  sessionProblemIds: number[];
  /** ID of the problem that was just shown (for context) */
  currentProblemId: number | null;
  /** Last action taken by the user */
  lastAction: 'solved' | 'skipped' | null;
}
