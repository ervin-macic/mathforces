"""
Import IMO problems from the ShadenA/MathNet Hugging Face dataset into the
MathForces SQLite database.

Usage (from repo root):
    python data/import_mathnet_imo.py [--db server/data/mathforces.db]

The script is fully idempotent: it deduplicates by the first 80 characters of
the problem statement, matching the logic in server/src/db/seed.ts.

Requirements:
    pip install -r data/requirements.txt
"""

import argparse
import os
import re
import sqlite3
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Topic mapping: MathNet top-level domain → MathForces topic enum
# ---------------------------------------------------------------------------
TOPIC_MAP: dict[str, str] = {
    "Algebra": "Algebra",
    "Geometry": "Geometry",
    "Number Theory": "Number Theory",
    # MathNet uses "Discrete Mathematics" for combinatorics-type problems
    "Discrete Mathematics": "Combinatorics",
    # Fallbacks for anything else in the taxonomy
    "Combinatorics": "Combinatorics",
    "Calculus": "Algebra",
    "Analysis": "Algebra",
    "Probability": "Combinatorics",
    "Statistics": "Combinatorics",
    "Linear Algebra": "Algebra",
    "Abstract Algebra": "Algebra",
}

MOHS_IMPORT = 20
SOURCE_TAG = "IMO"
REASON = "mathnet_imo_import"

# Matches ![alt text](filename) — inline Markdown images from MathNet
_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]+\)")


def strip_images(text: str, has_images: bool) -> str:
    """Remove Markdown image syntax; append a note if figures were present."""
    cleaned = _IMAGE_RE.sub("", text).strip()
    if has_images and _IMAGE_RE.search(text):
        cleaned += "\n\n*(Figure omitted.)*"
    return cleaned


def map_topic(topics_flat: list[str]) -> str | None:
    """Return a MathForces topic string from MathNet's topics_flat list."""
    for path in topics_flat:
        top = path.split(" > ")[0].strip()
        if top in TOPIC_MAP:
            return TOPIC_MAP[top]
    return None


def load_dataset_imo(hf_cache: str | None) -> object:
    """Load the MathNet IMO split, optionally directing the HF cache."""
    env = os.environ.copy()
    if hf_cache:
        env["HF_DATASETS_CACHE"] = hf_cache

    # Apply env override before importing datasets so the cache path is used
    if hf_cache:
        os.environ["HF_DATASETS_CACHE"] = hf_cache

    from datasets import load_dataset  # type: ignore

    print("Downloading ShadenA/MathNet 'IMO' split from Hugging Face…")
    ds = load_dataset("ShadenA/MathNet", "IMO", split="train")
    print(f"  Downloaded {len(ds)} rows.")
    return ds


def run_import(db_path: Path, hf_cache: str | None) -> None:
    ds = load_dataset_imo(hf_cache)

    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")

    # Ensure the solution column exists (mirrors database.ts migration)
    try:
        con.execute("ALTER TABLE problems ADD COLUMN solution TEXT NOT NULL DEFAULT ''")
        con.commit()
    except sqlite3.OperationalError:
        pass  # column already present

    # Build deduplication set from current DB contents
    existing: set[str] = {
        row[0][:80]
        for row in con.execute("SELECT statement FROM problems").fetchall()
    }

    inserted = 0
    skipped_dup = 0
    skipped_lang = 0
    skipped_topic = 0

    rows_to_insert: list[tuple] = []

    for row in ds:
        # English-only filter
        lang = row.get("language")
        if lang != "English":
            skipped_lang += 1
            continue

        statement_raw: str = row.get("problem_markdown") or ""
        has_images: bool = len(row.get("images") or []) > 0
        statement = strip_images(statement_raw, has_images)

        if not statement:
            skipped_topic += 1
            continue

        prefix = statement[:80]
        if prefix in existing:
            skipped_dup += 1
            continue

        topic = map_topic(row.get("topics_flat") or [])
        if topic is None:
            skipped_topic += 1
            print(
                f"  [skip] No mappable topic for: {prefix[:50]!r}  "
                f"(topics_flat={row.get('topics_flat')})"
            )
            continue

        competition: str = row.get("competition") or ""
        country: str = row.get("country") or ""
        mathnet_id: str = row.get("id") or ""
        source_ref = f"{competition} — {country} (MathNet id: {mathnet_id})"

        solutions: list[str] = row.get("solutions_markdown") or []
        solution_raw = solutions[0] if solutions else ""
        solution = strip_images(solution_raw, has_images) if solution_raw else ""

        rows_to_insert.append((
            statement, topic, source_ref, SOURCE_TAG,
            "", "", "",   # hint1, hint2, hint3
            solution,
            MOHS_IMPORT,
        ))
        existing.add(prefix)

    # Insert in a single transaction
    cur = con.cursor()
    for params in rows_to_insert:
        cur.execute(
            """
            INSERT INTO problems
              (statement, topic, source_ref, source_tag,
               hint1, hint2, hint3, solution, mohs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            params,
        )
        problem_id = cur.lastrowid
        cur.execute(
            """
            INSERT INTO problem_difficulty_events
              (problem_id, old_mohs, new_mohs, reason)
            VALUES (?, 0, ?, ?)
            """,
            (problem_id, MOHS_IMPORT, REASON),
        )
        inserted += 1

    con.commit()
    con.close()

    print(
        f"\nImport complete:\n"
        f"  Inserted : {inserted}\n"
        f"  Skipped (duplicate)  : {skipped_dup}\n"
        f"  Skipped (non-English): {skipped_lang}\n"
        f"  Skipped (no topic)   : {skipped_topic}\n"
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    default_db = repo_root / "server" / "data" / "mathforces.db"

    parser = argparse.ArgumentParser(description="Import MathNet IMO problems into MathForces SQLite DB.")
    parser.add_argument(
        "--db",
        type=Path,
        default=default_db,
        help=f"Path to SQLite database (default: {default_db})",
    )
    parser.add_argument(
        "--hf-cache",
        type=str,
        default=None,
        help="Override Hugging Face datasets cache directory (useful in restricted environments).",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"Error: database not found at {args.db}", file=sys.stderr)
        print("Run the server once first so it creates the schema, then re-run this script.", file=sys.stderr)
        sys.exit(1)

    run_import(args.db, args.hf_cache)


if __name__ == "__main__":
    main()
