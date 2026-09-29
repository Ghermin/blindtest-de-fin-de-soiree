#!/usr/bin/env bash
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

REPO="${BLINDTEST_REPO:-https://github.com/Ghermin/blindtest-de-fin-de-soiree.git}"
BRANCH="${BLINDTEST_BRANCH:-main}"
DIR=/opt/blindtest

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : sudo $0" >&2
    exit 1
fi

command -v git >/dev/null 2>&1 || apt-get install -y git

if [ -n "${GITHUB_TOKEN:-}" ]; then
    git config --global credential.helper store
    touch /root/.git-credentials
    chmod 600 /root/.git-credentials
    sed -i '/@github\.com/d' /root/.git-credentials
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com" >> /root/.git-credentials
fi

if ! git ls-remote --exit-code --heads "$REPO" "$BRANCH" >/dev/null 2>&1; then
    echo "Impossible d'accéder au dépôt $REPO (branche $BRANCH)." >&2
    echo "S'il est privé, relance avec un jeton GitHub en lecture seule :" >&2
    echo "  sudo GITHUB_TOKEN=github_pat_xxx bash $0" >&2
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

if [ -t 0 ]; then
    exec bash deploy/setup.sh
fi

systemctl restart blindtest
echo "Blind test (re)démarré. Logs : journalctl -u blindtest -f"
echo "Termine l'installation avec l'assistant : sudo $DIR/deploy/setup.sh"
