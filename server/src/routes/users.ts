import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from '../db/database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'mathforces-dev-secret-change-in-prod';
const BCRYPT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

interface JwtPayload {
  userId: number;
  username: string;
}

interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    req.auth = jwt.verify(token, JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Build a username unique within the users table from a Google email/name.
 * Tries the email-local-part first, then appends -1, -2, … on collision.
 */
function uniqueUsernameFromGoogle(email: string | undefined, name: string | undefined): string {
  const db = getDb();
  const base = (email?.split('@')[0] ?? name ?? 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'user';

  const stmt = db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1');
  if (!stmt.get(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!stmt.get(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// POST /api/users/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  if (username.length < 3 || username.length > 30) {
    res.status(400).json({ error: 'username must be 3–30 characters' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
  ).run(username, hash);

  const token = signToken({ userId: Number(info.lastInsertRowid), username });

  res.status(201).json({ userId: info.lastInsertRowid, username, token });
});

// POST /api/users/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
  ).get(username) as { id: number; username: string; password_hash: string } | undefined;

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });

  res.json({ userId: user.id, username: user.username, token });
});

// POST /api/users/google — sign in (or create) via Google ID token
router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'Server missing GOOGLE_CLIENT_ID' });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.warn('[Mathforces auth] Google ID token verify failed', err);
    res.status(401).json({ error: 'Invalid Google credential' });
    return;
  }

  if (!payload?.sub) {
    res.status(401).json({ error: 'Google credential missing subject' });
    return;
  }

  const sub = payload.sub;
  const email = payload.email;
  const name = payload.name ?? payload.given_name;
  const picture = payload.picture;

  const db = getDb();

  type UserRow = {
    id: number;
    username: string;
    google_sub: string | null;
    email: string | null;
    display_name: string | null;
    picture_url: string | null;
  };

  let user = db.prepare(
    'SELECT id, username, google_sub, email, display_name, picture_url FROM users WHERE google_sub = ?',
  ).get(sub) as UserRow | undefined;

  if (!user) {
    const username = uniqueUsernameFromGoogle(email, name);
    const info = db.prepare(
      `INSERT INTO users (username, password_hash, google_sub, email, display_name, picture_url)
       VALUES (?, '', ?, ?, ?, ?)`,
    ).run(username, sub, email ?? null, name ?? null, picture ?? null);
    user = {
      id: Number(info.lastInsertRowid),
      username,
      google_sub: sub,
      email: email ?? null,
      display_name: name ?? null,
      picture_url: picture ?? null,
    };
  } else {
    // Refresh profile fields on each sign-in (cheap; keeps avatar/name current).
    db.prepare(
      `UPDATE users SET email = ?, display_name = ?, picture_url = ? WHERE id = ?`,
    ).run(email ?? null, name ?? null, picture ?? null, user.id);
    user.email = email ?? null;
    user.display_name = name ?? null;
    user.picture_url = picture ?? null;
  }

  const token = signToken({ userId: user.id, username: user.username });

  res.json({
    userId: user.id,
    username: user.username,
    displayName: user.display_name ?? user.username,
    email: user.email,
    picture: user.picture_url,
    token,
  });
});

// GET /api/users/me — hydrate session from JWT
router.get('/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const auth = req.auth!;
  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, email, display_name, picture_url FROM users WHERE id = ?',
  ).get(auth.userId) as
    | {
        id: number;
        username: string;
        email: string | null;
        display_name: string | null;
        picture_url: string | null;
      }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'User no longer exists' });
    return;
  }

  res.json({
    userId: user.id,
    username: user.username,
    displayName: user.display_name ?? user.username,
    email: user.email,
    picture: user.picture_url,
  });
});

// GET /api/users/leaderboard — rank by number of solved problems
router.get('/leaderboard', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.picture_url,
      COUNT(CASE WHEN a.status = 'solved' THEN 1 END) AS solved_count,
      SUM(CASE WHEN a.status = 'solved' THEN p.mohs ELSE 0 END) AS total_mohs
    FROM users u
    LEFT JOIN attempts a ON a.user_id = u.id
    LEFT JOIN problems p ON p.id = a.problem_id
    GROUP BY u.id
    ORDER BY solved_count DESC, total_mohs DESC
    LIMIT 50
  `).all() as any[];

  const leaderboard = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    username: row.display_name ?? row.username,
    picture: row.picture_url ?? null,
    solvedCount: row.solved_count,
    totalMohs: row.total_mohs,
  }));

  res.json(leaderboard);
});

export default router;
