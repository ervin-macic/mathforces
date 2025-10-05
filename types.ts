
export enum Page {
  About = 'ABOUT',
  Play = 'PLAY',
  Leaderboard = 'LEADERBOARD',
  Progress = 'PROGRESS',
  SessionSettings = 'SESSION_SETTINGS',
}

export interface Problem {
  id: number;
  statement: string;
  topic: string;
  hints: string[];
}

export interface SolvedProblem {
  problem: Problem;
  timeSpent: number; // in seconds
  difficultyRating: number; // 1-5
  solvedAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  country: string;
}