import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { applyUserRating } from '../services/mohsService';

const router = Router();

// POST /api/attempts — record a solved or skipped attempt
router.post('/', (req: Request, res: Response) => {
  const {
    userId,
    problemId,
    sessionId,
    status,
    timeSpentSec,
    userRating,
    usedHintLevel,
  } = req.body as {
    userId: number;
    problemId: number;
    sessionId: string;
    status: 'solved' | 'skipped';
    timeSpentSec: number;
    userRating?: number;
    usedHintLevel?: number;
  };

  if (!userId || !problemId || !sessionId || !status) {
    res.status(400).json({ error: 'userId, problemId, sessionId and status are required' });
    return;
  }

  const db = getDb();

  const insertAttempt = db.prepare(`
    INSERT INTO attempts
      (user_id, problem_id, session_id, status, time_spent_sec, user_rating_1_10, used_hint_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    const info = insertAttempt.run(
      userId,
      problemId,
      sessionId,
      status,
      timeSpentSec ?? 0,
      status === 'solved' && userRating ? userRating : null,
      usedHintLevel ?? 0,
    );

    // Update MOHS only for solved + rated problems
    let newMohs: number | null = null;
    if (status === 'solved' && userRating) {
      newMohs = applyUserRating(problemId, userRating);
    }

    return { attemptId: info.lastInsertRowid, newMohs };
  });

  const result = run();
  res.status(201).json(result);
});

// GET /api/attempts?userId=<id> — retrieve user's attempt history
router.get('/', (req: Request, res: Response) => {
  const userId = Number(req.query.userId);
  if (!userId || isNaN(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT
      a.id, a.session_id, a.status, a.time_spent_sec,
      a.user_rating_1_10, a.used_hint_level, a.created_at,
      p.id AS problem_id, p.statement, p.topic,
      p.source_ref, p.source_tag, p.mohs,
      p.hint1, p.hint2, p.hint3, p.solution
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(userId) as any[];

  const formatted = rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    timeSpent: row.time_spent_sec,
    difficultyRating: row.user_rating_1_10,
    usedHintLevel: row.used_hint_level,
    solvedAt: row.created_at,
    problem: {
      id: row.problem_id,
      statement: row.statement,
      topic: row.topic,
      hints: [row.hint1, row.hint2, row.hint3],
      solution: row.solution || undefined,
      difficulty: row.mohs,
      source_ref: row.source_ref ?? undefined,
      source_tag: row.source_tag ?? undefined,
    },
  }));

  res.json(formatted);
});

export default router;
