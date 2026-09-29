#!/usr/bin/env bash
set -euo pipefail

REPO="${BLINDTEST_REPO:-https://github.com/Ghermin/blindtest-de-fin-de-soiree.git}"
BRANCH="${BLINDTEST_BRANCH:-main}"
DIR=/opt/blindtest

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : sudo $0" >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

id -u blindtest >/dev/null 2>&1 || useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin blindtest

if [ -d "$DIR/.git" ]; then
    git -C "$DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$DIR" reset --hard "origin/$BRANCH"
else
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi

cd "$DIR"
npm ci --omit=dev --no-audit --no-fund
[ -f .env ] || cp .env.example .env
install -d -m 700 data
chmod +x deploy/*.sh
chmod 600 .env
chown -R blindtest:blindtest "$DIR"
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$DIR" || git config --system --add safe.directory "$DIR"

for unit in blindtest.service blindtest-update.service blindtest-update.timer; do
    install -m 644 "deploy/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable blindtest
systemctl enable --now blindtest-update.timer

if grep -qE '^SPOTIFY_CLIENT_ID=.+' .env; then
    systemctl restart blindtest
    echo "Blind test (re)démarré. Logs : journalctl -u blindtest -f"
else
    echo "Renseigne $DIR/.env (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, puis npm run auth pour la salle de la maison) et : sudo systemctl start blindtest"
fi
echo "Jeu : http://$(hostname).local:${BLINDTEST_PORT:-3000} (réseau local)"
echo "Écran TV : sudo deploy/tv-setup.sh — Accès famille : sudo deploy/tunnel-setup.sh"
