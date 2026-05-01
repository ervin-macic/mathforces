"""
Generate three progressive hints for problems that have a solution but no hints,
and write them directly back into the MathForces SQLite database.

Usage (from repo root):
    python data/get_missing_hints.py [--db server/data/mathforces.db] [--limit 10] [--dry-run]

The script selects up to --limit problems ordered by id ASC where all three hint
columns are empty and the solution column is non-empty.  For each problem it calls
Gemini and parses a strict JSON response of shape {"hint1": ..., "hint2": ...,
"hint3": ...}, then issues a guarded UPDATE that only writes when hints are still
empty (safe to rerun).

"""

import argparse
import json
import os
import sqlite3
import time
from pathlib import Path

from google import genai
from google.genai.types import GenerateContentConfig


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def load_env_local(repo_root: Path) -> None:
    env_path = repo_root / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTIONS = """\
You are an expert math olympiad tutor. Given a competition problem and its \
official solution, produce exactly three progressive hints that guide a student \
toward the solution without revealing it outright.

Guidelines:
- Hint 1: A broad strategic idea or key observation that opens the problem.
- Hint 2: A more concrete intermediate step or technique to try.
- Hint 3: A strong nudge that essentially frames the crux — still short of \
restating the full solution or the final answer.
- Do NOT include the final answer or reproduce the official solution in any hint.
- Use inline LaTeX with single dollar signs ($...$) for math.  Double all \
backslashes (e.g. $\\\\frac{a}{b}$).
- Keep each hint to 1–3 sentences.
"""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "hint1": {"type": "string"},
        "hint2": {"type": "string"},
        "hint3": {"type": "string"},
    },
    "required": ["hint1", "hint2", "hint3"],
}


def build_prompt(row: dict) -> str:
    return f"""\
Problem statement:
{row['statement']}

Topic: {row['topic']}

Official solution (use this to anchor your hints — do not copy it verbatim):
{row['solution']}

Return ONLY a JSON object with keys hint1, hint2, hint3.
"""


# ---------------------------------------------------------------------------
# Core generation
# ---------------------------------------------------------------------------

def generate_hints(client: genai.Client, model_id: str, row: dict) -> dict | None:
    """Call Gemini and return {'hint1': ..., 'hint2': ..., 'hint3': ...} or None on failure."""
    prompt = build_prompt(row)
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTIONS,
                response_mime_type="application/json",
                response_json_schema=RESPONSE_SCHEMA,
            ),
        )
    except Exception as exc:
        print(f"  [ERROR] API call failed: {exc}")
        return None

    candidates = response.candidates
    if not candidates:
        print("  [ERROR] No candidates returned.")
        return None

    raw_text = candidates[0].content.parts[0].text
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        print(f"  [ERROR] JSON parse failed: {exc}\n  Raw: {raw_text[:200]!r}")
        return None

    if not all(k in data and isinstance(data[k], str) and data[k].strip() for k in ("hint1", "hint2", "hint3")):
        print(f"  [ERROR] Unexpected JSON shape: {list(data.keys())}")
        return None

    return {k: data[k].strip() for k in ("hint1", "hint2", "hint3")}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(description="Populate missing hints in mathforces.db via Gemini.")
    parser.add_argument("--db", default=str(repo_root / "server" / "data" / "mathforces.db"),
                        help="Path to mathforces.db (default: server/data/mathforces.db)")
    parser.add_argument("--limit", type=int, default=10,
                        help="Number of problems to process (default: 10)")
    parser.add_argument("--model", default="gemini-2.5-flash",
                        help="Gemini model ID (default: gemini-2.5-flash)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Generate hints but do not write to the database")
    parser.add_argument("--delay-sec", type=float, default=1.0,
                        help="Seconds to sleep between API calls (default: 1.0)")
    args = parser.parse_args()

    load_env_local(repo_root)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is missing. Set it in .env.local or your shell environment.")

    client = genai.Client(api_key=api_key)

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")

    rows = con.execute(
        """
        SELECT id, statement, topic, source_ref, mohs, solution
        FROM problems
        WHERE trim(hint1) = '' AND trim(hint2) = '' AND trim(hint3) = ''
          AND trim(coalesce(solution, '')) != ''
        ORDER BY id ASC
        LIMIT ?
        """,
        (args.limit,),
    ).fetchall()

    if not rows:
        print("No problems found that are missing hints with a non-empty solution.")
        con.close()
        return

    print(f"Found {len(rows)} candidate problem(s).  model={args.model}  dry_run={args.dry_run}\n")

    succeeded = 0
    failed_ids: list[int] = []

    for i, row in enumerate(rows, start=1):
        row_dict = dict(row)
        print(f"[{i}/{len(rows)}] id={row_dict['id']}  topic={row_dict['topic']}  "
              f"mohs={row_dict['mohs']}  stmt={row_dict['statement'][:60]!r}...")

        hints = generate_hints(client, args.model, row_dict)

        if hints is None:
            failed_ids.append(row_dict["id"])
            print("  -> SKIPPED (generation failed)")
        else:
            print(f"  hint1: {hints['hint1'][:80]!r}")
            print(f"  hint2: {hints['hint2'][:80]!r}")
            print(f"  hint3: {hints['hint3'][:80]!r}")

            if not args.dry_run:
                affected = con.execute(
                    """
                    UPDATE problems
                    SET hint1 = ?, hint2 = ?, hint3 = ?
                    WHERE id = ?
                      AND trim(hint1) = '' AND trim(hint2) = '' AND trim(hint3) = ''
                    """,
                    (hints["hint1"], hints["hint2"], hints["hint3"], row_dict["id"]),
                ).rowcount
                con.commit()
                if affected == 1:
                    print("  -> WRITTEN to DB")
                    succeeded += 1
                else:
                    print("  -> SKIPPED write (hints were already populated by another run)")
            else:
                print("  -> dry-run, not written")
                succeeded += 1

        if i < len(rows):
            time.sleep(args.delay_sec)

    con.close()

    print(f"\nDone.  succeeded={succeeded}  failed={len(failed_ids)}")
    if failed_ids:
        print(f"Failed problem ids: {failed_ids}")
    if args.dry_run:
        print("(dry-run mode: no database changes were made)")


if __name__ == "__main__":
    main()
