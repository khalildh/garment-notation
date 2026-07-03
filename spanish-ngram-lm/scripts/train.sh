#!/usr/bin/env bash
# Train smoothed (modified Kneser-Ney) char n-gram models from exploded text.
#
# Usage: train.sh EXPLODED_TRAIN OUTDIR [ORDERS...]   (default orders: 4 5)
# Requires lmplz and build_binary on PATH, or set KENLM_BIN=/path/to/kenlm/bin
set -euo pipefail

TRAIN="$1"
OUTDIR="$2"
shift 2
ORDERS=("${@:-4 5}")
[ $# -eq 0 ] && ORDERS=(4 5)

BIN="${KENLM_BIN:-}"
LMPLZ="${BIN:+$BIN/}lmplz"
BUILD_BINARY="${BIN:+$BIN/}build_binary"

mkdir -p "$OUTDIR"
for ORDER in "${ORDERS[@]}"; do
    ARPA="$OUTDIR/es-char-${ORDER}gram.arpa"
    "$LMPLZ" -o "$ORDER" --discount_fallback < "$TRAIN" > "$ARPA"
    "$BUILD_BINARY" trie "$ARPA" "$OUTDIR/es-char-${ORDER}gram.bin"
done
ls -lh "$OUTDIR"
