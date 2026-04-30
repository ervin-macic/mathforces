
# MathForces

Personalised math olympiad training — solve successively harder problems and receive AI-generated hints.

## Architecture

```
frontend/  (Vite + React + TypeScript)
  lib/
    recommendationEngine.ts  ← pure problem-selection scoring (also used server-side)
    mohsService.ts           ← MOHS difficulty update rule (frontend copy)
    apiClient.ts             ← fetches from backend with graceful in-memory fallback
server/  (Express + better-sqlite3)
  src/
    db/          ← schema, init, seed
    routes/      ← /api/problems, /api/attempts, /api/users
    services/    ← recommendationService, mohsService
data/
  problems.seed.json   ← curated problem bank (source: AoPS / IMO / BMO)
  mathforces.db        ← SQLite database (created on first run)
```

## Run Locally

**Prerequisites:** Node.js ≥ 18

### Frontend only (no backend required)

```bash
npm install
npm run dev        # http://localhost:5173
```

The app works fully offline — the recommendation engine and MOHS updates run in-memory.

### With backend (recommended for multi-user + persistent data)

```bash
# Terminal 1 — Backend
cd server
npm install
npm run db:seed    # seed the problem bank (idempotent)
npm run dev        # http://localhost:3001

# Terminal 2 — Frontend
# Uncomment VITE_API_URL in .env.local:
#   VITE_API_URL=http://localhost:3001
npm run dev
```

## Environment Variables

`.env.local`:

```
GEMINI_API_KEY=...          # for AI hint generation
VITE_API_URL=               # leave empty for frontend-only mode
                            # set to http://localhost:3001 to use backend

API_PORT=3001               # server port
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:3002
                            # comma-separated list of allowed origins for CORS
                            # add whichever port Vite binds to on your machine
JWT_SECRET=change-me-in-production
```

## Deploy to Railway

Two services: **API** (Express + SQLite) and **Frontend** (static Vite build).

### 1 · Push to GitHub

```bash
git push origin revamp
```

### 2 · API service

In the Railway dashboard:

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

**Volume** — attach a Railway volume mounted at `/app/data`.
The database resolves to that path automatically (`dist/db/` → `../../data` = `/app/data`).

**Variables** (API service only):

```
JWT_SECRET=<long random string>
FRONTEND_ORIGIN=https://<your-frontend>.up.railway.app
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 3 · Seed the database (one-time)

Once the API service is deployed and the volume is mounted, open a Railway shell for the API service and run:

```bash
npm run db:seed
```

This is idempotent — safe to run multiple times. It loads all 275 problems from
`data/problems.seed.json` (committed in the repo, so it is available at build time).

### 4 · Frontend service

| Setting | Value |
|---|---|
| Root directory | *(repo root)* |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |

**Variables** (frontend service, build-time):

```
VITE_API_URL=https://<your-api>.up.railway.app
```

Changing `VITE_API_URL` requires a frontend rebuild.

### 5 · Verify

```bash
# Health check
curl https://<your-api>.up.railway.app/health

# CORS (replace origin with your frontend URL)
curl -H "Origin: https://<your-frontend>.up.railway.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://<your-api>.up.railway.app/api/problems \
     -I
# Expect: Access-Control-Allow-Origin header matching your frontend URL
```

Or run the bundled script (fill in your URLs first):

```bash
API_URL=https://<your-api>.up.railway.app \
FRONTEND_URL=https://<your-frontend>.up.railway.app \
bash scripts/verify-deploy.sh
```

## MOHS Difficulty Scale

Problems are scored in MOHS units (-60 to +60, multiples of 5):

| Range  | Level                              |
|--------|------------------------------------|
| -60–0  | Too easy for competitions          |
|  5–15  | National competition easy (IMO P1) |
| 20–35  | National competition hard / IMO P2 |
| 40–50  | IMO P3 / Hardest national          |
| 55–60  | IMO P6 ceiling                     |

When a user rates a problem, the stored MOHS is updated:
`new_mohs = round5(clamp(old * 0.70 + perceived * 0.30))`

Source-based floors/ceilings prevent a single rating from moving an IMO P6 too far down.

## Adding Problems

Edit `data/problems.seed.json` then re-run:

```bash
cd server && npm run db:seed
```

Each problem needs: `statement`, `topic`, `mohs`, `hint1`, `hint2`, `hint3`, and optionally `source_ref` and `source_tag`.
