/**
 * MathForces API Client
 *
 * Wraps all backend API calls. When the server is unavailable (e.g. running
 * the Vite dev server without the backend), every call falls back gracefully
 * to the in-memory constants so the app remains functional.
 *
 * Set VITE_API_URL in .env.local to point at the backend, e.g.:
 *   VITE_API_URL=http://localhost:3001
 */

import { Problem, SolvedProblem } from '../types';
import { PROBLEMS } from '../constants';
import { selectNextProblem } from './recommendationEngine';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Returns true if the backend appears to be reachable. */
let _backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  if (!API_BASE) {
    _backendAvailable = false;
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

// ─── Problems ────────────────────────────────────────────────────────────────

/** Fetch all problems from the API; fall back to in-memory constants. */
export async function fetchProblems(): Promise<Problem[]> {
  if (!(await isBackendAvailable())) return PROBLEMS;
  try {
    return await apiFetch<Problem[]>('/api/problems');
  } catch {
    console.warn('[apiClient] Failed to fetch problems; using local constants');
    return PROBLEMS;
  }
}

/**
 * Ask the backend for the next recommended problem.
 * Falls back to the frontend recommendation engine if the API is unavailable.
 */
export async function fetchNextProblem(opts: {
  userId: number | null;
  problems: Problem[];
  solvedProblems: SolvedProblem[];
  sessionProblemIds: number[];
  currentProblemId: number | null;
  lastAction: 'solved' | 'skipped' | null;
}): Promise<Problem | null> {
  const {
    userId,
    problems,
    solvedProblems,
    sessionProblemIds,
    currentProblemId,
    lastAction,
  } = opts;

  if (userId && (await isBackendAvailable())) {
    try {
      const params = new URLSearchParams({
        userId: String(userId),
        ...(currentProblemId != null && { currentProblemId: String(currentProblemId) }),
        ...(lastAction && { lastAction }),
        ...(sessionProblemIds.length > 0 && {
          sessionProblemIds: sessionProblemIds.join(','),
        }),
      });
      return await apiFetch<Problem>(`/api/problems/recommend/next?${params}`);
    } catch {
      console.warn('[apiClient] Recommendation API unavailable; using local engine');
    }
  }

  // Local fallback
  const idx = selectNextProblem(
    problems,
    solvedProblems,
    sessionProblemIds,
    currentProblemId,
    lastAction,
  );
  return problems[idx] ?? null;
}

// ─── Attempts ────────────────────────────────────────────────────────────────

export interface AttemptPayload {
  userId: number;
  problemId: number;
  sessionId: string;
  status: 'solved' | 'skipped';
  timeSpentSec: number;
  userRating?: number;
  usedHintLevel?: number;
}

/**
 * Record an attempt on the backend.
 * Silently no-ops when the backend is unavailable (state is kept in frontend anyway).
 */
export async function postAttempt(payload: AttemptPayload): Promise<void> {
  if (!(await isBackendAvailable())) return;
  try {
    await apiFetch('/api/attempts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[apiClient] Failed to post attempt:', err);
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: number;
  username: string;
  token: string;
}

export async function register(username: string, password: string): Promise<AuthResult> {
  return apiFetch<AuthResult>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string): Promise<AuthResult> {
  return apiFetch<AuthResult>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardApiEntry {
  rank: number;
  userId: number;
  username: string;
  solvedCount: number;
  totalMohs: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardApiEntry[]> {
  if (!(await isBackendAvailable())) return [];
  try {
    return await apiFetch<LeaderboardApiEntry[]>('/api/users/leaderboard');
  } catch {
    return [];
  }
}
