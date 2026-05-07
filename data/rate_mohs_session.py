#!/usr/bin/env python3
"""
Interactive MOHS rater: show each problem's statement and solution, then store your
MOHS value in the SQLite database (see server/src/db/schema.ts for valid range).

Examples (from repository root):

  python3 data/rate_mohs_session.py -n 5
  python3 data/rate_mohs_session.py --number 10 --db server/data/mathforces.db
  python3 data/rate_mohs_session.py -n 8 --sequential
  python3 data/rate_mohs_session.py --number 3 --db /path/to/mathforces.db
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

# Match server/lib MOHS rules (schema + quantisation)
MOHS_MIN = -60
MOHS_MAX = 60
MOHS_STEP = 5

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "server/data/mathforces.db"


def quantise_mohs(raw: float) -> int:
    v = round(raw / MOHS_STEP) * MOHS_STEP
    return max(MOHS_MIN, min(MOHS_MAX, int(v)))


def parse_mohs_line(line: str) -> int | None:
    """Accept '35', '-10', ' 25 '. Return None if skip empty."""
    s = line.strip()
    if not s:
        return None
    if not re.fullmatch(r"-?\d+", s):
        raise ValueError(f"not an integer: {s!r}")
    return quantise_mohs(int(s))


def hr(char: str = "─", width: int = 72) -> str:
    return char * width


def fetch_problems(
    conn: sqlite3.Connection,
    n: int,
    *,
    sequential: bool,
) -> list[tuple[int, str, str, str, str | None, int]]:
    cur = conn.cursor()
    order = "id ASC" if sequential else "RANDOM()"
    cur.execute(
        f"""
        SELECT id, topic, statement, solution, source_ref, mohs
        FROM problems
        ORDER BY {order}
        LIMIT ?
        """,
        (n,),
    )
    return [
        (row[0], row[1], row[2], row[3] or "", row[4], row[5])
        for row in cur.fetchall()
    ]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Interactively set MOHS difficulty ratings and write them to the database."
    )
    parser.add_argument(
        "-n",
        "--number",
        type=int,
        required=True,
        metavar="N",
        help="How many problems to rate in this session.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB,
        help=f"Path to mathforces.db (default: {DEFAULT_DB.relative_to(ROOT)})",
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Walk problems in ascending id order (default: random order).",
    )

    args = parser.parse_args()
    if args.number < 1:
        print("error: --number must be at least 1", file=sys.stderr)
        return 2

    db_path = args.db.resolve()
    if not db_path.is_file():
        print(f"error: database file not found: {db_path}", file=sys.stderr)
        return 2

    sequential = bool(args.sequential)
    conn_pick = sqlite3.connect(db_path)
    try:
        rows = fetch_problems(conn_pick, args.number, sequential=sequential)
    finally:
        conn_pick.close()
    if len(rows) < args.number:
        print(
            f"note: only {len(rows)} problem(s) in the database (requested {args.number}).",
            file=sys.stderr,
        )

    if not rows:
        print("No problems to rate.", file=sys.stderr)
        return 1

    pending: list[tuple[int, int]] = []
    print(
        f"Session: {len(rows)} problem(s)  |  DB: {db_path}\n"
        f"MOHS range: {MOHS_MIN}…{MOHS_MAX} (stored in steps of {MOHS_STEP}).\n"
        "Commands: enter an integer MOHS; empty line = skip; "
        "'q' or 'quit' = end session and save ratings so far.\n"
        + hr("="),
        flush=True,
    )

    try:
        for idx, (pid, topic, statement, solution, source_ref, current_mohs) in enumerate(
            rows, start=1
        ):
            print(
                f"\n{hr('=')}\n"
                f"[{idx}/{len(rows)}]  Problem id={pid}  topic={topic}\n"
                f"Current MOHS in DB: {current_mohs}\n"
                + hr("-"),
                flush=True,
            )
            if source_ref:
                print(f"Source: {source_ref}\n", flush=True)
            print("STATEMENT\n", flush=True)
            print(statement.strip() if statement else "(empty)", flush=True)
            print("\n" + hr("-") + "\nSOLUTION\n", flush=True)
            print(solution.strip() if solution else "(no solution stored)", flush=True)
            print("\n" + hr("="), flush=True)

            while True:
                try:
                    raw = input(
                        f"MOHS for problem {pid} [{MOHS_MIN}…{MOHS_MAX}, step {MOHS_STEP}] "
                        "(empty=skip, q=quit): "
                    )
                except EOFError:
                    raw = "q"

                t = raw.strip().lower()
                if t in ("q", "quit", "exit"):
                    raise KeyboardInterrupt
                if not t:
                    print("  skipped", flush=True)
                    break
                try:
                    new_m = parse_mohs_line(raw)
                except ValueError as e:
                    print(f"  {e}; try again.", flush=True)
                    continue
                if new_m is None:
                    print("  skipped", flush=True)
                    break
                pending.append((pid, new_m))
                print(f"  queued MOHS = {new_m}", flush=True)
                break

    except KeyboardInterrupt:
        print("\n\nEnding session early…", flush=True)

    if not pending:
        print("No MOHS updates to write.", flush=True)
        return 0

    conn = sqlite3.connect(db_path)
    try:
        conn.executemany(
            "UPDATE problems SET mohs = ? WHERE id = ?",
            [(m, pid) for pid, m in pending],
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Wrote {len(pending)} MOHS update(s) to {db_path}.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
