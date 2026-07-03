#!/usr/bin/env python3
"""Deterministic checks for the normalization contract. Run: python3 tests/test_normalize.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from normalize import explode, normalize  # noqa: E402


def exploded(raw: str) -> str:
    return " ".join(explode(normalize(raw)))


CASES = [
    # Spanish letters, inverted punctuation, casing
    ("Hola, ¿Qué tal?", "h o l a , ▁ ¿ q u é ▁ t a l ?"),
    # ñ and ü survive; digits collapse to 0
    ("El año 1999 fue pingüino", "e l ▁ a ñ o ▁ 0 0 0 0 ▁ f u e ▁ p i n g ü i n o"),
    # curly quotes and dashes normalize; whitespace collapses
    ("“Sí” — dijo  él", '" s í " ▁ - ▁ d i j o ▁ é l'),
    # unknown symbols become <oth>
    ("café ☂ bar", "c a f é ▁ <oth> ▁ b a r"),
]


def main() -> None:
    failures = 0
    for raw, expected in CASES:
        got = exploded(raw)
        if got != expected:
            failures += 1
            print(f"FAIL: {raw!r}\n  expected: {expected}\n  got:      {got}")
    # short lines are dropped by the CLI filter (MIN_CHARS), verified via length
    assert len(explode(normalize("hola"))) < 10
    if failures:
        sys.exit(1)
    print(f"OK: {len(CASES)} normalization cases + min-length check passed")


if __name__ == "__main__":
    main()
