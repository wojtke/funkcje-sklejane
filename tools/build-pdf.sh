#!/usr/bin/env bash
# Eksport prezentacji do PDF (reveal.js ?print-pdf) przez Chrome headless.
# Drukuje dopiero po rozłożeniu slajdów (DevTools Protocol, Node ≥ 22) — zob. tools/build-pdf.mjs.
# Użycie: tools/build-pdf.sh [plik-wyjściowy.pdf]
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build-pdf.mjs "${1:-funkcje-sklejane.pdf}"
