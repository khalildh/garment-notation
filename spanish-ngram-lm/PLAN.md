# Plan: Smoothed Spanish Character N-gram Model (4-gram / 5-gram)

Goal: obtain a smoothed character-level Spanish n-gram model (orders 4 and 5) —
either by adopting an existing model or by training one with Kneser–Ney smoothing.

## 1. Existing models — survey (as of 2026-07)

### Word-level (ready-made, high quality — but NOT character-level)
| Model | Source | Notes |
|---|---|---|
| kensho/5gram-spanish-kenLM | [Hugging Face](https://huggingface.co/kensho/5gram-spanish-kenLM) | KenLM 5-gram for ASR decoding (pyctcdecode-compatible) |
| cc_net Spanish LM | `wget http://dl.fbaipublicfiles.com/cc_net/lm/es.arpa.bin` | Meta's Wikipedia-trained 5-gram Kneser–Ney; used for CCNet/LLaMA corpus filtering |
| edugp/kenlm | [Hugging Face](https://huggingface.co/edugp/kenlm) | Wikipedia + OSCAR KenLM models incl. Spanish (used by BERTIN) |
| philschmid/kenlm, ocisd4/kenlm | Hugging Face | cc_net-style collections incl. Spanish |
| Google Books Ngrams (es) | Google | Raw 1–5-gram *counts*, word-level, unsmoothed |

### Character-level (what we actually need)
| Resource | What it is | Verdict |
|---|---|---|
| An Crúbadán (Kevin Scannell) | Char *trigram* counts for 2000+ languages incl. es | Order too low (3), counts only, unsmoothed |
| practicalcryptography.com Spanish quadgram stats | Char 4-gram log-frequency tables (cryptanalysis) | Unsmoothed counts, uppercase-A–Z only (accents stripped) — unusable as a proper LM |
| [Urvika-gola/Character-Level-N-gram…](https://github.com/Urvika-gola/Character-Level-N-gram-Language-Model-for-Language-Detection), [chiragdaryani/language-model-from-scratch](https://github.com/chiragdaryani/language-model-from-scratch) | Educational char-LM code (add-one / interpolation) | Toy scale; add-one smoothing is poor; useful as reference only |

**Conclusion: no ready-made smoothed Spanish char 4/5-gram model exists.
Train our own — at character level this is cheap (minutes, not hours; MBs, not GBs).**

## 2. Why character-level changes the economics

- **Vocabulary ≈ 100 symbols** (lowercase letters incl. á é í ó ú ü ñ, digits or a
  `<num>` placeholder, basic punctuation incl. ¿ ¡, space marker) vs ~500k words.
- A 5-gram char model has at most a few million distinct n-grams → **binary model
  in the tens of MB**, no pruning needed.
- Char n-gram statistics saturate with ~100M–1B characters. **Spanish Wikipedia
  alone (~4–5B chars) is more than sufficient. No OSCAR, no terabyte run.**
- Total compute: laptop-class. Full pipeline < 1 hour.

## 3. Training plan (KenLM at character level)

### 3.1 Corpus
- Spanish Wikipedia dump (`eswiki-latest-pages-articles`), extracted with wikiextractor.
- Optional second register: OpenSubtitles es (conversational) — decide after eval.
- Hold out ~10k articles for dev/test before any counting.

### 3.2 Normalization (small, but defines the model's contract)
1. Unicode NFC; strip control chars; normalize quote/dash variants
2. Lowercase (halves symbol inventory; keep a cased variant only if the task needs it)
3. Keep Spanish diacritics and ñ, ¿, ¡ as first-class symbols — do NOT ASCII-fold
4. Map digits → `0` (or `<num>`); map rare symbols (emoji, foreign scripts) → `<other>`
5. Represent space explicitly as `▁` so cross-word char context is modeled
6. Explode each line into space-separated characters:
   `hola mundo` → `h o l a ▁ m u n d o`

### 3.3 Train
```sh
lmplz -o 4 --discount_fallback < train.chars.txt > es-char-4gram.arpa
lmplz -o 5 --discount_fallback < train.chars.txt > es-char-5gram.arpa
build_binary trie es-char-5gram.arpa es-char-5gram.bin
```
- Modified Kneser–Ney smoothing (KenLM default) — the "smoothed" requirement
- `--discount_fallback` needed: char data's count-of-count profile often breaks
  KN discount estimation
- No pruning (`--prune` unnecessary at this scale)

Fallback if a zero-dependency artifact is preferred: NLTK `KneserNeyInterpolated`
or a small custom implementation, validated against KenLM's perplexities.
KenLM remains the recommendation (exact modified-KN, fast C++ query API,
Python bindings via `pip install kenlm`).

### 3.4 Evaluate
- **Bits per character** (= log2 perplexity per char) on held-out Wikipedia and on
  one out-of-domain sample (subtitles); compare order 4 vs 5
- Expect ~2.0–2.4 bpc at order 5; order 5 should beat order 4 by a clear margin
  (char models gain more from +1 order than word models do)
- Sanity checks: Spanish text should score far better than English/Portuguese
  (validates use for language ID / gibberish detection); sample generations should
  look Spanish-like

### 3.5 Package
- Artifacts: `es-char-4gram.{arpa,bin}`, `es-char-5gram.{arpa,bin}` + a
  `normalize.py` that ships WITH the model (the model is only valid for text
  normalized the same way) + model card (corpus, normalization contract, bpc table)
- Small enough for git via LFS, or attach to a GitHub Release

## 4. Repository layout

```
spanish-ngram-lm/
├── README.md            # survey table above, results, usage examples
├── Makefile             # make corpus normalize train eval
├── scripts/
│   ├── download_wiki.sh
│   ├── normalize.py     # the normalization contract (shipped with model)
│   ├── explode_chars.py
│   └── eval_bpc.py
├── tests/               # fixture text → deterministic normalization + bpc smoke test
└── results/             # bpc tables, model checksums
```

## 5. Milestones

1. **Pipeline + pilot**: 100MB Wikipedia slice → 4-gram → bpc number (validates everything)
2. **Full models**: complete eswiki, orders 4 and 5, ARPA + binary
3. **Eval report**: bpc table (order × domain), es-vs-en/pt separation check
4. **Package**: model card, normalization script, release upload
```
