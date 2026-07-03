#!/usr/bin/env python3
"""Normalization contract for the Spanish character n-gram model.

Reads raw UTF-8 text lines on stdin, writes character-exploded lines on stdout:

    Hola, ¿qué tal?  ->  h o l a , ▁ ¿ q u é ▁ t a l ?

The model is ONLY valid for text normalized by this exact script. Ship it
with the model.

Rules:
  - Unicode NFC, lowercase
  - Curly quotes/dashes/ellipsis normalized to ASCII equivalents
  - Spanish letters (incl. á é í ó ú ü ñ) kept as first-class symbols
  - Digits collapsed to '0'
  - Whitespace runs collapsed; space emitted as the explicit token '▁'
  - Any other character becomes the single token '<oth>'
  - Lines with fewer than MIN_CHARS surviving characters are dropped
"""

import sys
import unicodedata

MIN_CHARS = 10

LETTERS = set("abcdefghijklmnopqrstuvwxyzáéíóúüñ")
PUNCT = set(".,;:!?¿¡'\"()-")
SPACE_TOKEN = "▁"
OTHER_TOKEN = "<oth>"

TRANSLATE = str.maketrans({
    "‘": "'", "’": "'", "‚": "'",
    "“": '"', "”": '"', "„": '"',
    "«": '"', "»": '"',
    "–": "-", "—": "-", "−": "-",
    "…": "...",
})


def normalize(line: str) -> str:
    """Raw line -> canonical character string (spaces still literal)."""
    line = unicodedata.normalize("NFC", line).lower().translate(TRANSLATE)
    return " ".join(line.split())


def explode(line: str) -> list[str]:
    """Canonical string -> list of character tokens."""
    tokens = []
    for ch in line:
        if ch == " ":
            tokens.append(SPACE_TOKEN)
        elif ch in LETTERS or ch in PUNCT:
            tokens.append(ch)
        elif ch.isdigit():
            tokens.append("0")
        else:
            tokens.append(OTHER_TOKEN)
    return tokens


def main() -> None:
    for raw in sys.stdin:
        tokens = explode(normalize(raw))
        if len(tokens) >= MIN_CHARS:
            sys.stdout.write(" ".join(tokens) + "\n")


if __name__ == "__main__":
    main()
