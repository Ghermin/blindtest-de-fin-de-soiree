#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

REPO="${BLINDTEST_REPO:-https://github.com/Ghermin/blindtest-de-fin-de-soiree.git}"
BRANCH="${BLINDTEST_BRANCH:-main}"
DIR="$HOME/blindtest"
BIN="$PREFIX/bin/blindtest"

if [ -z "${PREFIX:-}" ] || [ ! -d "/data/data/com.termux" ]; then
    echo "Ce script s'exécute dans Termux, sur un téléphone Android." >&2
    exit 1
fi

echo "🎧 Blind Test — installation sur ce téléphone (Termux)"
rm -f "$PREFIX/etc/termux/chosen_mirrors"
printf 'deb https://packages.termux.dev/apt/termux-main stable main\n' > "$PREFIX/etc/apt/sources.list"
APT_OPTS="-o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 -o Acquire::Retries=2"
echo "→ Téléchargement de Node et Git…"
apt-get update -qq $APT_OPTS
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $APT_OPTS nodejs-lts git termux-tools

TOKEN_FILE="$HOME/storage/downloads/github-token.txt"
if [ -z "${GITHUB_TOKEN:-}" ] && [ ! -d "$HOME/storage/downloads" ]; then
    termux-setup-storage >/dev/null 2>&1 || true
    echo "→ Autorise l'accès au stockage dans la fenêtre Android (pour lire le jeton déposé dans Téléchargements)…"
    for _ in $(seq 1 90); do
        [ -d "$HOME/storage/downloads" ] && break
        sleep 1
    done
fi
if [ -z "${GITHUB_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
    GITHUB_TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
fi
if [ -z "${GITHUB_TOKEN:-}" ]; then
    read -r -p "Jeton GitHub (github_pat_…, lecture seule sur le dépôt) : " GITHUB_TOKEN
fi

if [ -n "${GITHUB_TOKEN:-}" ]; then
    git config --global credential.helper store
    touch "$HOME/.git-credentials"
    chmod 600 "$HOME/.git-credentials"
    sed -i '/@github\.com/d' "$HOME/.git-credentials"
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com" >> "$HOME/.git-credentials"
fi
if ! git ls-remote --exit-code --heads "$REPO" "$BRANCH" >/dev/null 2>&1; then
    echo "Impossible d'accéder au dépôt. S'il est privé : GITHUB_TOKEN=github_pat_xxx bash $0" >&2
    exit 1
fi

if [ -d "$DIR/.git" ]; then
    git -C "$DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$DIR" reset --hard "origin/$BRANCH"
else
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
npm ci --omit=dev --no-audit --no-fund >/dev/null
[ -f .env ] || cp .env.example .env
chmod 600 .env

getenv() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
setenv() {
    local value=${2//&/\\&}
    if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$value|" .env; else echo "$1=$2" >> .env; fi
}

DEFAULT_PIN=$(getenv BLINDTEST_HOST_PIN)
DEFAULT_PIN="${DEFAULT_PIN:-$((RANDOM % 9000 + 1000))}"
read -r -p "Code hôte (chiffres à taper sur ton téléphone pour prendre la main) [$DEFAULT_PIN] : " PIN
setenv BLINDTEST_HOST_PIN "${PIN:-$DEFAULT_PIN}"
read -r -p "Client ID Spotify (Entrée pour passer, les playlists Deezer suffisent) [$(getenv SPOTIFY_CLIENT_ID)] : " CLIENT_ID
if [ -n "$CLIENT_ID" ]; then
    read -r -s -p "Client secret Spotify : " CLIENT_SECRET
    echo
    setenv SPOTIFY_CLIENT_ID "$CLIENT_ID"
    setenv SPOTIFY_CLIENT_SECRET "$CLIENT_SECRET"
fi

printf '#!/data/data/com.termux/files/usr/bin/bash\nexec bash "$HOME/blindtest/deploy/launch.sh"\n' > "$BIN"
chmod +x "$BIN"
chmod +x "$DIR/deploy/launch.sh"

mkdir -p "$HOME/.shortcuts"
printf '#!/data/data/com.termux/files/usr/bin/bash\nblindtest\n' > "$HOME/.shortcuts/Blind Test"
chmod +x "$HOME/.shortcuts/Blind Test"
rm -f "$TOKEN_FILE"

echo
echo "✅ Installé. Pour lancer une soirée : le widget « Blind Test » sur l'écran d'accueil (appli Termux:Widget), ou tape  blindtest  dans Termux."
echo "Pense à désactiver l'optimisation de batterie pour Termux (Paramètres → Applications → Termux → Batterie → Non restreinte)."
