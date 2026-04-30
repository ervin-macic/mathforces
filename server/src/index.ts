import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Local dev: load from repo-root .env.local. On Railway this path won't exist,
// which is fine — Railway injects env vars directly into process.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { getDb } from './db/database';
import problemsRouter from './routes/problems';
import attemptsRouter from './routes/attempts';
import usersRouter from './routes/users';

// Railway (and most PaaS) injects PORT; API_PORT is the local-dev fallback.
const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001;

// Initialise DB (applies schema migrations)
getDb();

const app = express();

// FRONTEND_ORIGIN may be a comma-separated list for multi-port local dev,
// e.g. "http://localhost:5173,http://localhost:3000,http://localhost:3002"
const allowedOrigins: string[] = (
  process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
).split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g. same-origin, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not in allowlist`));
    }
  },
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
