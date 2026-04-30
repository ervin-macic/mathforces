"""
MathNet (Hugging Face) helpers.

Example from the dataset card:

    from datasets import load_dataset

    # Default config (union of all bodies)
    ds = load_dataset("ShadenA/MathNet", split="train")

    # Or a specific country / competition-body config
    arg = load_dataset("ShadenA/MathNet", "Argentina", split="train")
    apmo = load_dataset("ShadenA/MathNet", "Asia_Pacific_Mathematics_Olympiad_APMO", split="train")

    row = ds[0]
    print(row["competition"], row["country"])
    print(row["problem_markdown"])
    for img in row["images"]:
        img.show()  # Pillow required

For scripts that only need text fields, use ``load_mathnet_text_only(...)`` to drop the
image column and avoid installing Pillow.
"""

from __future__ import annotations

import os
from pathlib import Path

from datasets import Dataset, get_dataset_config_names, load_dataset

_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_HF_HOME = _REPO_ROOT / ".hf_cache"


def _ensure_hf_cache() -> None:
    """Point Hugging Face caches at the repo so CLI tools work in restricted environments."""
    if os.environ.get("HF_HOME"):
        return
    _DEFAULT_HF_HOME.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(_DEFAULT_HF_HOME))


def list_mathnet_configs() -> list[str]:
    """Return named dataset configs (countries, regional bodies, ``all``, ``IMO``, etc.)."""
    _ensure_hf_cache()
    return get_dataset_config_names("ShadenA/MathNet")


def load_mathnet(
    name: str | None = None,
    *,
    split: str = "train",
) -> Dataset:
    """
    Load MathNet. With ``name=None``, uses the Hub default config (full union).
    With ``name="IMO"`` (or any body), loads that subset only.
    """
    _ensure_hf_cache()
    if name is None:
        return load_dataset("ShadenA/MathNet", split=split)
    return load_dataset("ShadenA/MathNet", name, split=split)


def load_mathnet_text_only(
    name: str | None = None,
    *,
    split: str = "train",
) -> Dataset:
    """
    Same as ``load_mathnet`` but removes ``images`` and ``solutions_markdown`` so
    iteration never decodes PIL images (no Pillow needed for typical imports).
    """
    ds = load_mathnet(name, split=split)
    drop: list[str] = []
    if "images" in ds.column_names:
        drop.append("images")
    if "solutions_markdown" in ds.column_names:
        drop.append("solutions_markdown")
    return ds.remove_columns(drop) if drop else ds


if __name__ == "__main__":
    _ensure_hf_cache()
    print("Configs (first 15):", list_mathnet_configs()[:15], "...")
    ds = load_mathnet_text_only()
    row = ds[0]
    print(row["competition"], row["country"])
    print(row["problem_markdown"][:500], "...")
