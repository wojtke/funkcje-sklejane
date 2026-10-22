#!/usr/bin/env bash
# Publikacja na GitHub Pages. Źródłem prawdy jest ten folder (Google Drive, bez gita):
# skrypt klonuje repozytorium do katalogu tymczasowego, podmienia pliki, commituje i wypycha.
# Użycie: tools/deploy.sh ["opis zmian"]
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-wojtke/funkcje-sklejane}"
MSG="${1:-Aktualizacja prezentacji}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# HTTPS z tokenem gh (działa bez klucza SSH i bez zmian w globalnej konfiguracji gita)
GIT=(git -c credential.helper= -c 'credential.helper=!gh auth git-credential')
"${GIT[@]}" clone --quiet "https://github.com/$REPO.git" "$TMP/repo" 2>/dev/null
rsync -a --delete --exclude '.git' --exclude '.DS_Store' --exclude '*.tmp' ./ "$TMP/repo/"
cd "$TMP/repo"
git checkout -q -B main
git add -A
if git diff --cached --quiet; then
  echo "Brak zmian do opublikowania."
  exit 0
fi
git commit -q -m "$MSG"
"${GIT[@]}" push -q origin main
echo "Opublikowano: https://${REPO%%/*}.github.io/${REPO##*/}/"
