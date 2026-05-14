/**
 * Auth storage + helpers for the Mathforces frontend.
 *
 * Persists the JWT and user identity in localStorage so the session survives
 * full reloads. The companion endpoint is GET /api/users/me which validates
 * the token and returns the current user.
 */

const TOKEN_KEY = 'mf_token';
const USER_KEY = 'mf_user';

export interface AuthUser {
  userId: number;
  username: string;
  displayName: string;
  email?: string | null;
  picture?: string | null;
}

export interface StoredAuth {
  token: string;
  user: AuthUser;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredAuth(): StoredAuth | null {
  const ls = safeStorage();
  if (!ls) return null;
  const token = ls.getItem(TOKEN_KEY);
  const userRaw = ls.getItem(USER_KEY);
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as AuthUser;
    if (!user || typeof user.userId !== 'number') return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth): void {
  const ls = safeStorage();
  if (!ls) return;
  ls.setItem(TOKEN_KEY, auth.token);
  ls.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearStoredAuth(): void {
  const ls = safeStorage();
  if (!ls) return;
  ls.removeItem(TOKEN_KEY);
  ls.removeItem(USER_KEY);
}

export function getStoredToken(): string | null {
  return safeStorage()?.getItem(TOKEN_KEY) ?? null;
}

/** Inject `Authorization: Bearer <token>` if a token is present. */
export function withAuthHeaders(init: RequestInit = {}): RequestInit {
  const token = getStoredToken();
  if (!token) return init;
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  };
}
