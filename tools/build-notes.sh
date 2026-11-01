#!/usr/bin/env bash
# Notatki prelegenta do druku (PDF) z <aside class="notes"> w index.html.
# Użycie: tools/build-notes.sh [plik-wyjściowy.pdf]   (domyślnie ../notatki-prelegenta.pdf, poza folderem publikowanym)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../notatki-prelegenta.pdf}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FONTS="file://$(python3 -c 'import urllib.parse, os; print(urllib.parse.quote(os.path.abspath("vendor/fonts")))')"
python3 tools/notes_handout.py index.html "$TMP/notatki.html" "$FONTS"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")" "file://$TMP/notatki.html" 2>/dev/null
echo "Zapisano: $OUT"
