#!/data/data/com.termux/files/usr/bin/bash
DIR="$HOME/blindtest"
cd "$DIR" || exit 1
export GIT_TERMINAL_PROMPT=0
termux-wake-lock 2>/dev/null || true

getenv() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2-; }
before=$(git rev-parse HEAD 2>/dev/null)
if git pull --ff-only --quiet 2>/dev/null; then
    after=$(git rev-parse HEAD 2>/dev/null)
    if [ "$before" != "$after" ]; then
        npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1 || true
        echo "⬆ Mise à jour appliquée (${after:0:7})"
    fi
else
    echo "ℹ Pas de mise à jour (hors ligne ?), on continue"
fi

ICON="$HOME/.shortcuts/icons/Blind Test.png"
if [ ! -f "$ICON" ] || [ public/shortcut-icon.png -nt "$ICON" ]; then
    mkdir -p "$HOME/.shortcuts/icons"
    cp public/shortcut-icon.png "$ICON" 2>/dev/null || true
fi

URL=$(node scripts/lan-url.js)
ROOM=$(getenv BLINDTEST_HOME_ROOM)
ROOM="${ROOM:-MAISON}"
PIN=$(getenv BLINDTEST_HOST_PIN)

clear
echo "🎧 Blind Test — ce téléphone est le serveur"
echo
echo "  Salle        : $URL/r/$ROOM"
echo "  Écran TV     : $URL/r/$ROOM/tv"
echo "  Code hôte    : $PIN"
echo
node scripts/qr-terminal.js "$URL/r/$ROOM"
echo
echo "Chrome s'ouvre sur ta salle, déjà en mode hôte, dans 3 s. Laisse Termux tourner en arrière-plan. Ctrl+C pour arrêter."
( sleep 3; termux-open-url "$URL/r/$ROOM#host=$PIN" 2>/dev/null ) &
exec node index.js
