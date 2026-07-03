#!/usr/bin/env bash
# Download and extract Spanish Wikipedia for the real (non-pilot) training run.
# Requires normal network access to dumps.wikimedia.org and PyPI (wikiextractor).
#
# Usage: download_wiki.sh [OUTDIR]   (default: data/)
set -euo pipefail

OUTDIR="${1:-data}"
DUMP="eswiki-latest-pages-articles.xml.bz2"
URL="https://dumps.wikimedia.org/eswiki/latest/${DUMP}"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f "$DUMP" ] || curl -L -O "$URL"

pip install --quiet wikiextractor
python -m wikiextractor.WikiExtractor "$DUMP" \
    --no-templates --json -b 100M -o extracted

# Flatten JSON to one document text per line -> raw.txt
python - <<'EOF'
import glob, json, io
with io.open("raw.txt", "w", encoding="utf-8") as out:
    for path in sorted(glob.glob("extracted/*/wiki_*")):
        with io.open(path, encoding="utf-8") as fh:
            for line in fh:
                text = json.loads(line).get("text", "")
                for para in text.split("\n"):
                    if para.strip():
                        out.write(para.strip() + "\n")
EOF

echo "Wrote $OUTDIR/raw.txt"
