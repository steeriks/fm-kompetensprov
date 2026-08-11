#!/usr/bin/env bash
#
# Publicerar dist/ till det publika repot som GitHub Pages serverar.
# Källan bor privat; bara den färdiga appen blir publik.
#
#   ./publicera.sh              bygger om och publicerar
#   ./publicera.sh -m "text"    med eget commit-meddelande
set -euo pipefail

PUBLIKT="${PUBLIKT_REPO:-$HOME/Documents/kompetensprov-publik}"
FJARR="git@github.com:steeriks/kompetensprov.git"
HAR="$(cd "$(dirname "$0")" && pwd)"
meddelande="Uppdatera appen"
[ "${1:-}" = "-m" ] && meddelande="${2:?-m kräver text}"

python3 "$HAR/bygg.py"

if [ ! -d "$PUBLIKT/.git" ]; then
  echo "==> klonar $FJARR"
  git clone -q "$FJARR" "$PUBLIKT"
fi

cd "$PUBLIKT"
git pull -q --ff-only origin main 2>/dev/null || true
cp "$HAR"/dist/* .
cp "$HAR/LICENSE" .          # licensen ska följa med det som faktiskt sprids
# .nojekyll: utan den hoppar Pages över filer som börjar med understreck.
touch .nojekyll
git add -A
if git diff --cached --quiet; then
  echo "==> inget nytt att publicera"
  exit 0
fi
git commit -q -m "$meddelande"
git push -q origin main
echo "==> publicerat: https://steeriks.github.io/kompetensprov/"
