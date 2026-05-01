Made during **Columbia University's hackathon Divhacks 2025**
**Won the productivity track.**

---

## Mathforces
**Mathforces** is an intelligent IMO-level math practice website aimed at students without access to olympiad coaches.

It uses a database of olympiad questions with difficulty spanning easy, medium, hard IMO problems, taken from the Art of Problem Solving website. For each question, a Gemini model generates a series of 3 progressive hints that guides the user to a full solution. In addition to Unlimited practice mode, the platform also has a competition mode with a format akin to the real IMO. 

---

## Overview

- **Difficulty feedback system** ([`lib/mohsService.ts`](lib/mohsService.ts))

After you solve (or skip), your rating and timing feed into profiles and can adjust problem **MOHS** ([Math Olympiad Hardness Scale](https://web.evanchen.cc/upload/MOHS-hardness.pdf)) over time, with sensible guards for known-hard sources (e.g. IMO hard problems aren't labeled "easy" casually)

- **The recommendation engine** [`lib/recommendationEngine`](lib/recommendationEngine.ts) 

Gives personalized next problem for candidates using:
1) weak-topic signal (E.g. if a student tends to solve hard geometry questions but struggles with easy combinatorics questions you should bias towards recommedning more combinatorics questions.)
2) proximity to your estimated skill band per topic (Don't recommend problems that are too hard)
3) recency/diversity in the current session (Don't recommend questions seen already)
4) (WIP) perceived problem quality/beauty

- **Curated problem pool** 

Problems mostly imported from [MathNet](https://mathnet.mit.edu/). The problems carry difficulty estimate on the **MOHS** scale (−60 to +60 in steps of 5: too easy → far beyond contest level), professionally verified solutions, and problem source.

- **Three progressive hints per problem** 

Aimed to help just enough to foster learning: Hint 1 is broad, Hint 2 stronger, Hint 3 almost decisive—without replacing real solve effort. Hints are **pregenerated** with **Gemini** and stored locally so play stays fast and deterministic at runtime—no on-demand generation during a session.

- **Modes**
**Endless** practice ([`pages/PlayPage.tsx`](pages/PlayPage.tsx)), and **Competition-style** practice ([`pages/CompetitionPage.tsx`](pages/CompetitionPage.tsx)) like a mock IMO.

- **Progress analysis**
Visible when logged in. Topic breakdown, recent solves, timing, and perceived difficulty trends ([`pages/ProgressPage.tsx`](pages/ProgressPage.tsx)).

---

## Stack

| Layer | Notes |
|--------|--------|
| **Frontend** | React 19 + Vite + TypeScript; MathJax for LaTeX; Recharts on Progress. |
| **Backend** | Optional Express API + **SQLite** (`server/`) for problems, attempts, and difficulty history. |
| **Offline dev** | Without the API, the app can fall back to bundled constants ([`lib/apiClient.ts`](lib/apiClient.ts)). |

---

## Repository layout

- `pages/` — route-level screens (About, Play, Competition, Progress, Leaderboard, …)
- `lib/` — recommendation engine, MOHS updates, API client
- `server/` — REST API, schema, migrations, seeds
- `data/` — Python helpers for imports and hint generation

---
