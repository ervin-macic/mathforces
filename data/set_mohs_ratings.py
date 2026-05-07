#!/usr/bin/env python3
"""
Recompute `mohs` for all problems in server/data/mathforces.db.

MOHS is stored in steps of 5 in [0, 60] (per user request: 0 ≈ below IMO level,
60 ≈ beyond typical IMO).

- Problems 1–17: hand-judged (seed problems have no official solution text in DB).
- Identified past IMO exam problems: values from data/imo_mohs.csv.
- IMO shortlist imports: quantiles of official solution length within each shortlist
  cohort (MathNet ordering); explicit IMO overrides win when present.

Usage:
  python3 data/set_mohs_ratings.py
"""

from __future__ import annotations

import csv
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/mathforces.db"
CSV = ROOT / "data/imo_mohs.csv"

MOHS_STEP = 5
MOHS_MIN, MOHS_MAX = 0, 60


def q5(x: float) -> int:
    v = round(x / MOHS_STEP) * MOHS_STEP
    return max(MOHS_MIN, min(MOHS_MAX, int(v)))


def load_imo_csv() -> dict[tuple[str, int], int]:
    out: dict[tuple[str, int], int] = {}
    with CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = row["Year"].strip()
            for i, key in enumerate(["P1", "P2", "P3", "P4", "P5", "P6"], start=1):
                cell = row[key].strip().strip('"')
                m = re.match(r"\([A-Z],\s*(\d+)\)", cell)
                if m:
                    out[(year, i)] = int(m.group(1))
    return out


IMO = load_imo_csv()


def cohort(pid: int, source_ref: str | None) -> str:
    """Partition problems so percentile difficulty is computed within comparable sets."""
    if pid <= 17:
        return "seed"
    ref = source_ref or ""
    if "2006" in ref and "Shortlist" in ref:
        return "SL06"
    if "2007" in ref and "Vietnam" in ref:
        return "SL07"
    if "Spain" in ref and "49th" in ref:
        return "SL08"
    # e.g. "International Mathematical Olympiad Shortlisted Problems" (2011 import batch)
    if "International Mathematical Olympiad Shortlisted Problems" in ref:
        return "SL11"
    if "IMO Problem Shortlist" in ref:
        return "SL09"
    if "51st IMO Shortlisted" in ref:
        return "SL10"
    if "56th International Mathematical Olympiad Shortlisted" in ref:
        return "SL15"
    if "IMO 2016 Shortlisted" in ref:
        return "SL16"
    if "2019" in ref and "Shortlist" in ref:
        return "SL19"
    if "IMO2024" in ref or "2024 Shortlist" in ref:
        return "SL24"
    if "International Mathematical Olympiad — IMO" in ref and "Shortlist" not in ref:
        if 178 <= pid <= 198:
            return "EXAM_A"
        if 230 <= pid <= 249:
            return "EXAM_B"
        return "EXAM_MISC"
    return "UNK"


# Seed pack (no long official solution in DB)
CURATED: dict[int, int] = {
    1: 20,
    2: 5,
    3: 15,
    4: 30,
    5: 30,
    6: 10,
    7: 15,
    8: 20,
    9: 30,
    10: 40,
    11: 40,
    12: 35,
    13: 40,
    14: 50,
    15: 5,
    16: 30,
    17: 40,
}

# High-confidence official IMO papers (see statements / competition folklore).
EXPLICIT: dict[int, int] = {
    # IMO 2018
    178: IMO[("IMO 2018", 1)],
    179: IMO[("IMO 2018", 2)],
    180: IMO[("IMO 2018", 3)],
    181: IMO[("IMO 2018", 4)],
    182: IMO[("IMO 2018", 5)],
    183: IMO[("IMO 2018", 6)],
    # IMO 2019
    189: IMO[("IMO 2019", 1)],
    188: IMO[("IMO 2019", 2)],
    187: IMO[("IMO 2019", 3)],
    186: IMO[("IMO 2019", 4)],
    184: IMO[("IMO 2019", 5)],
    185: IMO[("IMO 2019", 6)],
    # IMO 2016 (geometry)
    191: IMO[("IMO 2016", 3)],
    192: IMO[("IMO 2016", 4)],
    # Synthetic hexagon configuration — IMO-level but not taken from csv row
    190: 35,
    # IMO 2017
    197: IMO[("IMO 2017", 1)],
    198: IMO[("IMO 2017", 2)],
    194: IMO[("IMO 2017", 3)],
    195: IMO[("IMO 2017", 4)],
    196: IMO[("IMO 2017", 5)],
    193: IMO[("IMO 2017", 6)],
    # IMO 2022 (matched by statement)
    235: IMO[("IMO 2022", 1)],
    231: IMO[("IMO 2022", 2)],
    230: IMO[("IMO 2022", 3)],
    240: IMO[("IMO 2022", 4)],
    238: IMO[("IMO 2022", 5)],
    237: IMO[("IMO 2022", 6)],
    # IMO 2024 problem 2 — bijection on Z_{\ge 0}^2
    239: IMO[("IMO 2024", 2)],
}


def percentile_mohs(lengths: dict[int, int]) -> dict[int, int]:
    if not lengths:
        return {}
    items = sorted(lengths.items(), key=lambda x: x[1])
    n = len(items)
    out: dict[int, int] = {}
    for i, (pid, _) in enumerate(items):
        rank = i / max(1, n - 1) if n > 1 else 0.5
        out[pid] = q5(15 + rank * 35)
    return out


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, topic, source_ref, length(solution) FROM problems ORDER BY id"
    )
    rows = cur.fetchall()

    by_cohort: dict[str, dict[int, int]] = {}
    for pid, _topic, ref, sol_len in rows:
        by_cohort.setdefault(cohort(pid, ref), {})[pid] = sol_len

    mohs: dict[int, int] = {}
    for ck, lens in by_cohort.items():
        if ck == "seed":
            continue
        mohs.update(percentile_mohs(lens))

    mohs.update(CURATED)
    mohs.update(EXPLICIT)

    for pid, _t, _r, _s in rows:
        mohs.setdefault(pid, 30)

    for pid, _t, _r, _s in rows:
        v = mohs[pid]
        assert MOHS_MIN <= v <= MOHS_MAX, (pid, v)
        assert v % MOHS_STEP == 0, (pid, v)

    cur.executemany(
        "UPDATE problems SET mohs = ? WHERE id = ?",
        [(mohs[pid], pid) for pid, _, _, _ in rows],
    )
    conn.commit()
    conn.close()
    print(f"Updated {len(rows)} problems in {DB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
