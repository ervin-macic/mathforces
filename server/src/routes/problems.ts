import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { formatProblemForClient, recommendNextProblem } from '../services/recommendationService';

const router = Router();

// GET /api/problems — list all problems
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, statement, topic, source_ref, source_tag, hint1, hint2, hint3, solution, mohs FROM problems ORDER BY mohs ASC',
  ).all() as any[];
  res.json(rows.map(formatProblemForClient));
});

// GET /api/problems/:id — single problem
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, statement, topic, source_ref, source_tag, hint1, hint2, hint3, solution, mohs FROM problems WHERE id = ?',
  ).get(Number(req.params.id)) as any;

  if (!row) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }
  res.json(formatProblemForClient(row));
});

// GET /api/problems/recommend — get next recommended problem
// Query params: userId, currentProblemId?, lastAction?, sessionProblemIds (comma-separated)
router.get('/recommend/next', (req: Request, res: Response) => {
  const userId = Number(req.query.userId);
  if (!userId || isNaN(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const currentProblemId = req.query.currentProblemId
    ? Number(req.query.currentProblemId)
    : null;
  const lastAction = (req.query.lastAction as string | undefined) as
    | 'solved'
    | 'skipped'
    | null;
  const sessionProblemIds = req.query.sessionProblemIds
    ? String(req.query.sessionProblemIds)
        .split(',')
        .map(Number)
        .filter(n => !isNaN(n))
    : [];

  const problem = recommendNextProblem({
    userId,
    currentProblemId,
    lastAction: lastAction ?? null,
    sessionProblemIds,
  });

  if (!problem) {
    res.status(404).json({ error: 'No problems in database' });
    return;
  }
  res.json(formatProblemForClient(problem));
});

export default router;
