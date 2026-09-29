#!/usr/bin/env bash
set -euo pipefail

DIR=/opt/blindtest
BRANCH="${BLINDTEST_BRANCH:-main}"

cd "$DIR"
PORT=$(grep -E '^BLINDTEST_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
PORT="${PORT:-3000}"

git fetch --quiet --depth 1 origin "$BRANCH"
current=$(git rev-parse HEAD)
latest=$(git rev-parse "origin/$BRANCH")
if [ "$current" = "$latest" ]; then
    echo "Blind test déjà à jour (${current:0:7})"
    exit 0
fi

if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"busy":true'; then
    echo "Partie en cours, mise à jour ${latest:0:7} reportée au prochain passage"
    exit 0
fi

git reset --hard --quiet "origin/$BRANCH"
npm ci --omit=dev --no-audit --no-fund
install -d -m 700 -o blindtest -g blindtest data
chown -R blindtest:blindtest "$DIR"
systemctl restart blindtest
echo "Blind test mis à jour ${current:0:7} -> ${latest:0:7}"
