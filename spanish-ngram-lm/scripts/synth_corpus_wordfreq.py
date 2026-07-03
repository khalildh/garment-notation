#!/usr/bin/env python3
"""PILOT-ONLY corpus synthesizer for network-restricted environments.

Samples words i.i.d. from the `wordfreq` Spanish frequency list (real Spanish
vocabulary with real relative frequencies) and joins them into pseudo-sentences.

This preserves within-word character statistics and word-boundary transitions
under a unigram approximation, but NOT true word-order context. It exists to
validate the pipeline end to end where Wikipedia cannot be downloaded.
The final model must be trained on real running text (see download_wiki.sh).

Usage: synth_corpus_wordfreq.py NUM_LINES [SEED] > raw.txt
"""

import random
import sys

from wordfreq import get_frequency_dict

WORDS_PER_LINE = 12
VOCAB_LIMIT = 200_000


def main() -> None:
    num_lines = int(sys.argv[1])
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 42

    freq = get_frequency_dict("es")
    items = sorted(freq.items(), key=lambda kv: -kv[1])[:VOCAB_LIMIT]
    words = [w for w, _ in items]
    weights = [f for _, f in items]

    rng = random.Random(seed)
    for _ in range(num_lines):
        print(" ".join(rng.choices(words, weights=weights, k=WORDS_PER_LINE)))


if __name__ == "__main__":
    main()
