#!/usr/bin/env python3
"""
Import IMO problems from ShadenA/MathNet (HF dataset) into mathforces.db.

Usage (from repo root, with .venv active):
    python3 data/import_mathnet_imo.py [--dry-run]

Strategy for problem ordering within a year:
  1. Try to parse "Problem N" (N=1..6) from the first 300 chars of problem_markdown.
  2. Fall back: stable alphabetical sort of the HF row `id` field within the year.
  Prints a warning table when any year does not contain exactly 6 problems;
  aborts the insert for that year so MOHS mapping is never silently wrong.

MOHS + topic:
  - Years 2000–2025: from data/imo_mohs.csv (topic + MOHS per P1–P6).
  - Years before 2000: mohs=20, topic inferred from topics_flat top-level domain.
  Both: mohs_locked=1 to prevent user-rating drift.

Figures: ![](attached_image_N.png) patterns are stripped from problem_markdown
  and "(Diagram omitted.)" is appended when at least one was removed.

Hints: three empty strings ('') — the schema default, acceptable since there are
  no hints in MathNet v0.

Deduplication: skips any row whose source_ref ("IMO YYYY Problem N") already
  exists in the database.  Run again safely after adding new years.
"""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH   = REPO_ROOT / "server" / "data" / "mathforces.db"
CSV_PATH  = REPO_ROOT / "data" / "imo_mohs.csv"

# ── Topic mapping ────────────────────────────────────────────────────────────

LETTER_TO_TOPIC: dict[str, str] = {
    "G": "Geometry",
    "A": "Algebra",
    "C": "Combinatorics",
    "N": "Number Theory",
}

FLAT_TO_TOPIC: dict[str, str] = {
    "geometry":      "Geometry",
    "algebra":       "Algebra",
    "combinatorics": "Combinatorics",
    "number theory": "Number Theory",
}

DEFAULT_TOPIC    = "Algebra"
DEFAULT_MOHS     = 20
MOHS_STEP        = 5


def _quantise(v: int) -> int:
    return round(v / MOHS_STEP) * MOHS_STEP


# ── MOHS CSV ─────────────────────────────────────────────────────────────────

def load_mohs_table(csv_path: Path) -> dict[tuple[int, int], tuple[str, int]]:
    """Return {(year, p_num): (topic, mohs)} from imo_mohs.csv."""
    table: dict[tuple[int, int], tuple[str, int]] = {}
    with csv_path.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Year column: "IMO 2023" → 2023
            year = int(row["Year"].replace("IMO ", "").strip())
            for p in range(1, 7):
                cell = row[f"P{p}"].strip()
                # cell format: "(G, 10)"
                m = re.match(r"\(\s*([GACN])\s*,\s*(\d+)\s*\)", cell)
                if not m:
                    raise ValueError(f"Unexpected MOHS cell {cell!r} for IMO {year} P{p}")
                topic = LETTER_TO_TOPIC[m.group(1)]
                mohs  = _quantise(int(m.group(2)))
                table[(year, p)] = (topic, mohs)
    return table


# ── Topic inference from topics_flat (pre-2000 fallback) ─────────────────────

def infer_topic(topics_flat: list[str]) -> str:
    """Extract the closest of our 4 DB topics from a MathNet topics_flat list."""
    for path in topics_flat:
        top = path.split(">")[0].strip().lower()
        if top in FLAT_TO_TOPIC:
            return FLAT_TO_TOPIC[top]
        # partial keyword sweep for unusual capitalisation
        for key, val in FLAT_TO_TOPIC.items():
            if key in top:
                return val
    return DEFAULT_TOPIC


# ── Figure stripping ──────────────────────────────────────────────────────────

_IMG_PATTERN = re.compile(r"!\[.*?\]\(attached_image_\d+\.png\)")

def strip_figures(text: str) -> str:
    cleaned, n = _IMG_PATTERN.subn("", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if n:
        cleaned += "\n\n(Diagram omitted.)"
    return cleaned


# ── Problem-number parsing ─────────────────────────────────────────────────────

_PROB_NUM_RE = re.compile(
    r"""
    (?:
        \bProblem\b[\s\W]*([1-6])\b   # "Problem 3", "Problem. 3", etc.
      | \bP\s*([1-6])\b               # "P3", "P 3"
      | ^([1-6])[.\)]\s               # "3." or "3)" at line start
    )
    """,
    re.VERBOSE | re.MULTILINE | re.IGNORECASE,
)

def parse_problem_number(markdown: str) -> int | None:
    """Return problem number 1–6 if clearly detectable in the first 300 chars."""
    snippet = markdown[:300]
    m = _PROB_NUM_RE.search(snippet)
    if m:
        val = m.group(1) or m.group(2) or m.group(3)
        n = int(val)
        if 1 <= n <= 6:
            return n
    return None


# ── Year-group ordering ──────────────────────────────────────────────────────

def assign_problem_numbers(
    rows: list[dict],
    year: int,
) -> list[tuple[int, dict]] | None:
    """
    Return [(p_num, row), ...] sorted P1–P6 for `rows` (all from the same year),
    or None if the assignment is ambiguous / count ≠ 6.
    """
    if len(rows) != 6:
        return None

    parsed: dict[int, list[dict]] = {}
    unparsed: list[dict] = []

    for row in rows:
        n = parse_problem_number(row["problem_markdown"])
        if n is not None:
            parsed.setdefault(n, []).append(row)
        else:
            unparsed.append(row)

    # Clean path: all 6 parsed with no collisions
    if not unparsed and len(parsed) == 6 and all(len(v) == 1 for v in parsed.values()):
        return sorted((n, v[0]) for n, v in parsed.items())

    # Partial parse: some parsed, some not — fall back to stable sort entirely
    # Use the HF row `id` field (4-char base36) which is stable across rebuilds
    stable = sorted(rows, key=lambda r: r["id"])
    return list(enumerate(stable, start=1))


# ── Hints placeholder ─────────────────────────────────────────────────────────

HINT_PLACEHOLDER = ""   # schema allows empty string default


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False) -> None:
    # Lazy import so users see a clean error if not installed
    try:
        from data.mathnet_problems import load_mathnet_text_only
    except ImportError:
        sys.path.insert(0, str(REPO_ROOT))
        from data.mathnet_problems import load_mathnet_text_only

    print("Loading MOHS table …")
    mohs_table = load_mohs_table(CSV_PATH)
    covered_years = {y for y, _ in mohs_table}

    print("Downloading/caching MathNet IMO config …")
    ds = load_mathnet_text_only("IMO")
    print(f"  {len(ds):,} rows loaded from HF.")

    # ── Group rows by year ────────────────────────────────────────────────────
    by_year: dict[int, list[dict]] = {}
    skipped_parse = 0
    for row in ds:
        comp = row.get("competition", "")
        m = re.search(r"\b(\d{4})\b", comp)
        if not m:
            print(f"  [WARN] Cannot parse year from competition={comp!r} — skipping row")
            skipped_parse += 1
            continue
        year = int(m.group(1))
        by_year.setdefault(year, []).append(row)

    # ── Validate counts ───────────────────────────────────────────────────────
    bad_years = {y: len(v) for y, v in by_year.items() if len(v) != 6}
    if bad_years:
        print("\n[WARN] The following years do NOT have exactly 6 problems in the IMO config:")
        print(f"  {'Year':<8} {'Count'}")
        for y, c in sorted(bad_years.items()):
            print(f"  {y:<8} {c}")
        print("  These years will be SKIPPED to avoid wrong P-number → MOHS mapping.")

    print(f"\nYears found: {sorted(by_year)} ({len(by_year)} total)\n")

    # ── Open DB ───────────────────────────────────────────────────────────────
    if not DB_PATH.exists():
        print(f"[ERROR] Database not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    con = sqlite3.connect(str(DB_PATH))
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()

    existing = {
        row[0]
        for row in cur.execute("SELECT source_ref FROM problems WHERE source_ref IS NOT NULL")
    }
    print(f"Existing problems with source_ref: {len(existing)}")

    # ── Insert ────────────────────────────────────────────────────────────────
    inserted = 0
    skipped_dup = 0
    skipped_bad_year = 0

    for year in sorted(by_year):
        rows = by_year[year]

        if year in bad_years:
            skipped_bad_year += len(rows)
            continue

        assignments = assign_problem_numbers(rows, year)
        if assignments is None:
            print(f"  [WARN] {year}: could not assign P1–P6 — skipping year")
            skipped_bad_year += len(rows)
            continue

        for p_num, row in assignments:
            source_ref = f"IMO {year} Problem {p_num}"
            source_tag = f"IMO_P{p_num}"

            if source_ref in existing:
                skipped_dup += 1
                continue

            # MOHS + topic
            if year in covered_years:
                topic, mohs = mohs_table[(year, p_num)]
            else:
                topic = infer_topic(row.get("topics_flat") or [])
                mohs  = _quantise(DEFAULT_MOHS)

            # Statement
            statement = strip_figures(row["problem_markdown"])

            if dry_run:
                print(
                    f"  [DRY-RUN] {source_ref}  topic={topic:<14} mohs={mohs:>3}"
                    f"  chars={len(statement)}"
                )
                inserted += 1
                continue

            cur.execute(
                """
                INSERT INTO problems
                  (statement, topic, source_ref, source_tag,
                   hint1, hint2, hint3, mohs, mohs_locked)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    statement, topic, source_ref, source_tag,
                    HINT_PLACEHOLDER, HINT_PLACEHOLDER, HINT_PLACEHOLDER,
                    mohs,
                ),
            )
            problem_id = cur.lastrowid
            cur.execute(
                """
                INSERT INTO problem_difficulty_events
                  (problem_id, old_mohs, new_mohs, reason)
                VALUES (?, 0, ?, 'mathnet_imo_import')
                """,
                (problem_id, mohs),
            )
            existing.add(source_ref)
            inserted += 1

    if not dry_run:
        con.commit()
    con.close()

    print(
        f"\n{'[DRY-RUN] ' if dry_run else ''}Done — "
        f"inserted: {inserted}, "
        f"skipped (duplicate): {skipped_dup}, "
        f"skipped (bad year / parse): {skipped_bad_year + skipped_parse}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print what would be inserted without writing to DB")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
