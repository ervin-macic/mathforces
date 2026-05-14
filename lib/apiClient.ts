/**
 * MathForces API Client
 *
 * Wraps all backend API calls. When the server is unavailable (e.g. running
 * the Vite dev server without the backend), every call falls back gracefully
 * to the in-memory constants so the app remains functional.
 *
 * In local dev, leave VITE_API_URL empty — the Vite proxy forwards /api and
 * /health to localhost:3001. Set VITE_API_URL only when running without the
 * Vite dev server (e.g. vite preview or a separate deployment).
 */

import { Problem, SolvedProblem } from '../types';
import { PROBLEMS } from '../constants';
import { selectNextProblem } from './recommendationEngine';
import { withAuthHeaders, AuthUser } from './auth';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '';

if (typeof window !== 'undefined') {
  console.log('[MathForces apiClient] init', {
    VITE_API_URL: API_BASE || '(empty — using Vite proxy / same-origin)',
    viteMode: (import.meta as any).env?.MODE,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const merged = withAuthHeaders({
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  const res = await fetch(`${API_BASE}${path}`, merged);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err = new Error(`API ${path} → ${res.status}: ${text}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Returns true if the backend appears to be reachable. */
let _backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  // Use relative URL when no explicit API_BASE; the Vite dev proxy routes
  // /health → Express. In production the Express server serves the frontend
  // at the same origin so relative URLs work there too.
  const healthUrl = API_BASE ? `${API_BASE}/health` : '/health';
  try {
    const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    _backendAvailable = res.ok;
    console.log('[MathForces apiClient] GET /health', {
      healthUrl,
      ok: res.ok,
      status: res.status,
      backendAvailable: _backendAvailable,
    });
  } catch (err) {
    _backendAvailable = false;
    console.warn('[MathForces apiClient] GET /health failed', { healthUrl, err });
  }
  return _backendAvailable;
}

// ─── Problems ────────────────────────────────────────────────────────────────

/** Fetch all problems from the API; fall back to in-memory constants. */
export async function fetchProblems(): Promise<Problem[]> {
  const backendOk = await isBackendAvailable();
  if (!backendOk) {
    console.log(
      '[MathForces apiClient] fetchProblems → embedded fallback, count:',
      PROBLEMS.length,
    );
    return PROBLEMS;
  }
  try {
    const list = await apiFetch<Problem[]>('/api/problems');
    console.log('[MathForces apiClient] GET /api/problems ok, count:', list?.length ?? 0);
    return list;
  } catch (err) {
    console.warn('[MathForces apiClient] GET /api/problems failed; using embedded constants', err);
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

export interface GoogleAuthResult extends AuthUser {
  token: string;
}

/** Exchange a Google ID token (credential) for a Mathforces session. */
export async function googleSignIn(idToken: string): Promise<GoogleAuthResult> {
  return apiFetch<GoogleAuthResult>('/api/users/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

/** Validate the stored JWT and fetch the current user. Returns null on 401. */
export async function fetchMe(): Promise<AuthUser | null> {
  if (!(await isBackendAvailable())) return null;
  try {
    return await apiFetch<AuthUser>('/api/users/me');
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return null;
    console.warn('[apiClient] /api/users/me failed', err);
    return null;
  }
}

// ─── Attempts (history) ──────────────────────────────────────────────────────

interface AttemptRow {
  id: number;
  sessionId: string;
  status: 'solved' | 'skipped';
  timeSpent: number;
  difficultyRating: number | null;
  usedHintLevel: number;
  solvedAt: string;
  problem: Problem;
}

/** Load the full attempt history for a user. Empty array if backend is down. */
export async function fetchUserAttempts(userId: number): Promise<SolvedProblem[]> {
  if (!(await isBackendAvailable())) return [];
  try {
    const rows = await apiFetch<AttemptRow[]>(`/api/attempts?userId=${userId}`);
    // Server returns most-recent first; reverse so chronological order matches
    // the "append on solve" semantics used elsewhere in the app.
    return rows
      .slice()
      .reverse()
      .map(r => ({
        problem: r.problem,
        timeSpent: r.timeSpent,
        difficultyRating: r.difficultyRating ?? 0,
        solvedAt: new Date(r.solvedAt),
        usedHintLevel: r.usedHintLevel,
        status: r.status,
      }));
  } catch (err) {
    console.warn('[apiClient] /api/attempts fetch failed', err);
    return [];
  }
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
