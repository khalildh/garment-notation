#!/usr/bin/env python3
"""Compute bits per character of a KenLM char model on an exploded test file.

Usage: eval_bpc.py MODEL.(arpa|bin) EXPLODED_TEXT [LABEL]

The test file must already be normalized + exploded by normalize.py.
Scores full sentences (including </s>); bpc = -log2 P(corpus) / total tokens,
where total tokens counts one </s> per line.
"""

import math
import sys

import kenlm


def main() -> None:
    model_path, text_path = sys.argv[1], sys.argv[2]
    label = sys.argv[3] if len(sys.argv) > 3 else text_path

    model = kenlm.Model(model_path)
    log10_total = 0.0
    tokens = 0
    with open(text_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            log10_total += model.score(line, bos=True, eos=True)
            tokens += len(line.split()) + 1  # +1 for </s>

    bpc = -log10_total * math.log2(10) / tokens
    ppl = 2 ** bpc
    print(f"{label}\torder={model.order}\ttokens={tokens}\tbpc={bpc:.4f}\tchar_ppl={ppl:.3f}")


if __name__ == "__main__":
    main()
