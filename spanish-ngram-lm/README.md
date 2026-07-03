# Spanish Character N-gram Language Model

Smoothed (modified Kneser–Ney) character-level 4-gram and 5-gram language models
for Spanish, trained with [KenLM](https://github.com/kpu/kenlm).

See [PLAN.md](PLAN.md) for the full plan, including the survey of existing
models (word-level KenLM models exist off the shelf; no usable smoothed
character-level Spanish model does) and [results/pilot.md](results/pilot.md)
for pilot numbers.

## Quick start

```sh
make test    # normalization contract tests (no dependencies)
make pilot   # offline pilot: wordfreq-synthesized corpus -> 4&5-gram -> bpc report
make corpus  # real run: download + extract Spanish Wikipedia (needs network)
```

Requires: Python 3.10+, `pip install kenlm wordfreq`, and KenLM's `lmplz` /
`build_binary` (build from source; set `KENLM_BIN` if not on PATH).

## The normalization contract

`scripts/normalize.py` defines the model's input contract — NFC, lowercase,
Spanish diacritics kept, digits→`0`, space as explicit `▁` token, one character
per token. **Text must pass through this exact script both at training and at
query time.** The script ships with the model.
