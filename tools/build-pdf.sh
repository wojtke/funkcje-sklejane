#!/usr/bin/env bash
# Eksport prezentacji do PDF przez Chrome w trybie headless (reveal.js ?print-pdf).
# Użycie: tools/build-pdf.sh [plik-wyjściowy.pdf]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-funkcje-sklejane.pdf}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$(python3 -c 'import urllib.parse, os; print(urllib.parse.quote(os.path.abspath("index.html")))')?print-pdf"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw \
  --virtual-time-budget=30000 --print-to-pdf="$OUT" "$URL" 2>/dev/null
echo "Zapisano: $OUT"
