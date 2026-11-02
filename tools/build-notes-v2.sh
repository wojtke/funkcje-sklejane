#!/usr/bin/env bash
# Notatki prelegenta wersji 2 do druku: v2/index.html → ../notatki-prelegenta-v2.pdf
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../notatki-prelegenta-v2.pdf}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FONTS="file://$(python3 -c 'import urllib.parse, os; print(urllib.parse.quote(os.path.abspath("vendor/fonts")))')"
python3 tools/notes_handout.py v2/index.html "$TMP/notatki.html" "$FONTS" " (wersja 2)"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")" "file://$TMP/notatki.html" 2>/dev/null
echo "Zapisano: $OUT"
