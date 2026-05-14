"""
Import JBMO, EGMO, and Romania JBMO team-selection style problems from
ShadenA/MathNet into the MathForces SQLite database.

MOHS (per inserted row, uniform random integers in inclusive ranges):
  - JBMO and Romania JBMO TST: -20 .. 15
  - EGMO: 0 .. 25

Usage (from repo root, after `pip install -r data/requirements.txt`):
    python data/import_mathnet_jbmo_egmo_ro_tst.py [--db server/data/mathforces.db]

Idempotent: skips rows whose statement prefix (80 chars) already exists in DB.
"""

from __future__ import annotations

import argparse
import os
import random
import re
import sqlite3
import sys
from collections.abc import Callable
from pathlib import Path

# Reuse mapping from import_mathnet_imo.py
TOPIC_MAP: dict[str, str] = {
    "Algebra": "Algebra",
    "Geometry": "Geometry",
    "Number Theory": "Number Theory",
    "Discrete Mathematics": "Combinatorics",
    "Combinatorics": "Combinatorics",
    "Calculus": "Algebra",
    "Analysis": "Algebra",
    "Probability": "Combinatorics",
    "Statistics": "Combinatorics",
    "Linear Algebra": "Algebra",
    "Abstract Algebra": "Algebra",
}

_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]+\)")
REASON_BASE = "mathnet_jbmo_egmo_ro_tst_import"


def strip_images(text: str, has_images: bool) -> str:
    cleaned = _IMAGE_RE.sub("", text).strip()
    if has_images and _IMAGE_RE.search(text):
        cleaned += "\n\n*(Figure omitted.)*"
    return cleaned


def map_topic(topics_flat: list[str]) -> str | None:
    for path in topics_flat:
        top = path.split(" > ")[0].strip()
        if top in TOPIC_MAP:
            return TOPIC_MAP[top]
    return None


def is_romania_jbmo_tst_row(row: dict) -> bool:
    """Romania config: JBMO-related team selection / TST style contests."""
    comp = (row.get("competition") or "").lower()
    if "jbmo" not in comp and "junior balkan" not in comp:
        return False
    markers = (
        "tst",
        "team selection",
        "selection test",
        "baraj",
        "t.s.t",
        "team-select",
    )
    return any(m in comp for m in markers)


def is_english_row(row: dict) -> bool:
    """MathNet IMO uses 'English'; some configs leave language null — treat as OK."""
    lang = row.get("language")
    if lang is None:
        return True
    return str(lang).strip().lower() == "english"


def load_split(name: str, hf_cache: str | None) -> object:
    repo = Path(__file__).resolve().parent.parent
    root = Path(hf_cache) if hf_cache else (repo / ".hf_import_cache")
    root.mkdir(parents=True, exist_ok=True)
    # Keep all HF locks/downloads inside the repo (CI / sandbox friendly).
    os.environ["HF_HOME"] = str(root / "hf_home")
    os.environ["HF_DATASETS_CACHE"] = str(root / "datasets")

    from datasets import load_dataset  # type: ignore

    print(f"Loading ShadenA/MathNet {name!r} …")
    ds = load_dataset("ShadenA/MathNet", name, split="train")
    print(f"  {len(ds)} rows.")
    return ds


def insert_rows(
    con: sqlite3.Connection,
    cur: sqlite3.Cursor,
    rows_iter,
    *,
    source_tag: str,
    mohs_min: int,
    mohs_max: int,
    reason_suffix: str,
    existing: set[str],
    row_filter: Callable[[dict], bool] | None = None,
) -> tuple[int, int, int, int, int]:
    inserted = skipped_dup = skipped_lang = skipped_topic = skipped_filter = 0
    reason = f"{REASON_BASE}:{reason_suffix}"

    for row in rows_iter:
        if row_filter is not None and not row_filter(row):
            skipped_filter += 1
            continue

        if not is_english_row(row):
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
            continue

        competition: str = row.get("competition") or ""
        country: str = row.get("country") or ""
        mathnet_id: str = row.get("id") or ""
        source_ref = f"{competition} — {country} (MathNet id: {mathnet_id})"

        solutions: list[str] = row.get("solutions_markdown") or []
        solution_raw = solutions[0] if solutions else ""
        solution = strip_images(solution_raw, has_images) if solution_raw else ""

        mohs = random.randint(mohs_min, mohs_max)

        cur.execute(
            """
            INSERT INTO problems
              (statement, topic, source_ref, source_tag,
               hint1, hint2, hint3, solution, mohs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                statement,
                topic,
                source_ref,
                source_tag,
                "",
                "",
                "",
                solution,
                mohs,
            ),
        )
        problem_id = cur.lastrowid
        cur.execute(
            """
            INSERT INTO problem_difficulty_events
              (problem_id, old_mohs, new_mohs, reason)
            VALUES (?, 0, ?, ?)
            """,
            (problem_id, mohs, reason),
        )
        existing.add(prefix)
        inserted += 1

    return inserted, skipped_dup, skipped_lang, skipped_topic, skipped_filter


def run_import(db_path: Path, hf_cache: str | None) -> None:
    jbmo_ds = load_split("JBMO", hf_cache)
    egmo_ds = load_split("European_Girls'_Mathematical_Olympiad_EGMO", hf_cache)
    romania_ds = load_split("Romania", hf_cache)

    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")

    try:
        con.execute("ALTER TABLE problems ADD COLUMN solution TEXT NOT NULL DEFAULT ''")
        con.commit()
    except sqlite3.OperationalError:
        pass

    existing: set[str] = {
        row[0][:80] for row in con.execute("SELECT statement FROM problems").fetchall()
    }

    cur = con.cursor()
    totals = {"inserted": 0, "dup": 0, "lang": 0, "topic": 0, "filter": 0}

    def run_batch(ds, **kwargs):
        nonlocal totals
        ins, dup, lang, top, flt = insert_rows(con, cur, ds, existing=existing, **kwargs)
        totals["inserted"] += ins
        totals["dup"] += dup
        totals["lang"] += lang
        totals["topic"] += top
        totals["filter"] += flt

    run_batch(
        jbmo_ds,
        source_tag="JBMO",
        mohs_min=-20,
        mohs_max=15,
        reason_suffix="jbmo",
        row_filter=None,
    )
    run_batch(
        egmo_ds,
        source_tag="EGMO",
        mohs_min=0,
        mohs_max=25,
        reason_suffix="egmo",
        row_filter=None,
    )
    run_batch(
        romania_ds,
        source_tag="JBMO_TST_RO",
        mohs_min=-20,
        mohs_max=15,
        reason_suffix="romania_jbmo_tst",
        row_filter=is_romania_jbmo_tst_row,
    )

    con.commit()
    con.close()

    print(
        "\nImport complete:\n"
        f"  Inserted             : {totals['inserted']}\n"
        f"  Skipped (duplicate)  : {totals['dup']}\n"
        f"  Skipped (non-English): {totals['lang']}\n"
        f"  Skipped (no topic)   : {totals['topic']}\n"
        f"  Skipped (row filter) : {totals['filter']}\n"
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    default_db = repo_root / "server" / "data" / "mathforces.db"

    parser = argparse.ArgumentParser(
        description="Import MathNet JBMO, EGMO, and Romania JBMO TST problems.",
    )
    parser.add_argument("--db", type=Path, default=default_db, help="SQLite database path")
    parser.add_argument(
        "--hf-cache",
        type=str,
        default=None,
        help="Hugging Face datasets cache directory override.",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"Error: database not found at {args.db}", file=sys.stderr)
        sys.exit(1)

    run_import(args.db, args.hf_cache)


if __name__ == "__main__":
    main()
