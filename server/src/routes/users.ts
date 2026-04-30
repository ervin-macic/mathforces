import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'mathforces-dev-secret-change-in-prod';
const BCRYPT_ROUNDS = 12;

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

  const token = jwt.sign({ userId: info.lastInsertRowid, username }, JWT_SECRET, {
    expiresIn: '30d',
  });

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

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '30d',
  });

  res.json({ userId: user.id, username: user.username, token });
});

// GET /api/users/leaderboard — rank by number of solved problems
router.get('/leaderboard', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
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
    username: row.username,
    solvedCount: row.solved_count,
    totalMohs: row.total_mohs,
  }));

  res.json(leaderboard);
});

export default router;
