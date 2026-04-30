import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { getDb } from './db/database';
import problemsRouter from './routes/problems';
import attemptsRouter from './routes/attempts';
import usersRouter from './routes/users';

const PORT = process.env.API_PORT ?? 3001;

// Initialise DB (applies schema migrations)
getDb();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/problems', problemsRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/users',    usersRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`MathForces API listening on http://localhost:${PORT}`);
});

export default app;
