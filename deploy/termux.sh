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
pkg update -y >/dev/null
pkg install -y nodejs-lts git termux-tools >/dev/null

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

cat > "$BIN" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
DIR="$HOME/blindtest"
cd "$DIR" || exit 1
termux-wake-lock 2>/dev/null || true
git pull --ff-only --quiet 2>/dev/null && npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1 || true
URL=$(node scripts/lan-url.js)
ROOM=$(grep -E '^BLINDTEST_HOME_ROOM=' .env | cut -d= -f2)
ROOM="${ROOM:-MAISON}"
PIN=$(grep -E '^BLINDTEST_HOST_PIN=' .env | cut -d= -f2)
clear
echo "🎧 Blind Test — ce téléphone est le serveur"
echo
echo "  Salle        : $URL/r/$ROOM"
echo "  Écran TV     : $URL/r/$ROOM/tv"
echo "  Code hôte    : $PIN"
echo
echo "Autres adresses possibles :"
node scripts/lan-url.js --all | sed 's/^/  /'
echo
node scripts/qr-terminal.js "$URL/r/$ROOM"
echo
echo "Laisse cette fenêtre ouverte. Ctrl+C pour arrêter."
exec env BLINDTEST_PUBLIC_URL="$URL" node index.js
EOF
chmod +x "$BIN"

mkdir -p "$HOME/.shortcuts"
printf '#!/data/data/com.termux/files/usr/bin/bash\nblindtest\n' > "$HOME/.shortcuts/Blind Test"
chmod +x "$HOME/.shortcuts/Blind Test"

echo
echo "✅ Installé. Pour lancer une soirée : tape  blindtest  dans Termux (ou le widget « Blind Test » avec l'appli Termux:Widget)."
echo "Pense à désactiver l'optimisation de batterie pour Termux (Paramètres → Applications → Termux → Batterie → Non restreinte)."
