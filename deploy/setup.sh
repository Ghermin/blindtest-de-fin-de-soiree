#!/usr/bin/env bash
set -euo pipefail

DIR=/opt/blindtest
ENV_FILE="$DIR/.env"

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : sudo $0" >&2
    exit 1
fi
if [ ! -t 0 ]; then
    echo "Cet assistant est interactif : lance-le dans un terminal avec  sudo $0" >&2
    exit 1
fi

cd "$DIR"
[ -f "$ENV_FILE" ] || cp .env.example "$ENV_FILE"
chmod 600 "$ENV_FILE"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { echo; bold "── $* "; }
getenv() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }
setenv() {
    local value=${2//&/\\&}
    if grep -qE "^$1=" "$ENV_FILE"; then
        sed -i "s|^$1=.*|$1=$value|" "$ENV_FILE"
    else
        echo "$1=$2" >> "$ENV_FILE"
    fi
}
ask() {
    local answer
    read -r -p "$1${2:+ [$2]} : " answer
    echo "${answer:-$2}"
}
ask_secret() {
    local answer
    read -r -s -p "$1 : " answer
    echo >&2
    echo "$answer"
}
yesno() {
    local answer
    read -r -p "$1 (o/N) : " answer
    [[ "$answer" =~ ^[oOyY] ]]
}

echo
bold "🎧 Blind Test de fin de soirée — assistant d'installation"
echo "Réponds aux questions, Entrée garde la valeur entre crochets. Tu peux relancer cet assistant à tout moment."

step "1/5 Identifiants de ton app Spotify"
echo "Ils sont sur https://developer.spotify.com/dashboard → ton app → Settings."
CLIENT_ID=$(ask "Client ID" "$(getenv SPOTIFY_CLIENT_ID)")
while [ -z "$CLIENT_ID" ]; do CLIENT_ID=$(ask "Client ID (obligatoire)"); done
CURRENT_SECRET=$(getenv SPOTIFY_CLIENT_SECRET)
if [ -n "$CURRENT_SECRET" ]; then
    CLIENT_SECRET=$(ask_secret "Client secret (Entrée pour garder l'actuel)")
    CLIENT_SECRET="${CLIENT_SECRET:-$CURRENT_SECRET}"
else
    CLIENT_SECRET=$(ask_secret "Client secret (invisible à la frappe)")
    while [ -z "$CLIENT_SECRET" ]; do CLIENT_SECRET=$(ask_secret "Client secret (obligatoire)"); done
fi
setenv SPOTIFY_CLIENT_ID "$CLIENT_ID"
setenv SPOTIFY_CLIENT_SECRET "$CLIENT_SECRET"

step "2/5 Ta salle"
DEFAULT_PIN=$(getenv BLINDTEST_HOST_PIN)
DEFAULT_PIN="${DEFAULT_PIN:-$((RANDOM % 9000 + 1000))}"
PIN=$(ask "Code hôte (les chiffres que tu taperas sur ton téléphone pour prendre la main)" "$DEFAULT_PIN")
setenv BLINDTEST_HOST_PIN "$PIN"
DEVICE=$(ask "Nom (même partiel) de l'enceinte ou de la TV Spotify préférée, vide pour choisir à chaque fois" "$(getenv SPOTIFY_DEVICE_NAME)")
setenv SPOTIFY_DEVICE_NAME "$DEVICE"

step "3/5 Connexion de ton compte Spotify Premium"
if [ -n "$(getenv SPOTIFY_REFRESH_TOKEN)" ] && ! yesno "Un compte est déjà connecté. Le reconnecter ?"; then
    echo "Compte conservé."
else
    node scripts/auth.js --manual --write
fi

step "4/5 Options"
if yesno "Ouvrir le jeu à la famille via un tunnel Cloudflare (il faut un domaine chez Cloudflare) ?"; then
    DOMAIN=$(ask "Nom de domaine complet à utiliser (ex. blindtest.ton-domaine.fr)" "$(getenv BLINDTEST_PUBLIC_URL | sed 's|^https://||')")
    if [ -n "$DOMAIN" ]; then
        bash deploy/tunnel-setup.sh "$DOMAIN"
    fi
    echo
    echo "Bouton « Caster sur la TV » depuis un téléphone Android : il faut un récepteur Cast enregistré chez Google (5 \$ une fois)."
    echo "  https://cast.google.com/publish → Add new application → Custom Receiver → URL https://${DOMAIN:-ton-domaine}/cast → note l'Application ID → Publish"
    CAST=$(ask "Application ID Cast (vide si tu ne l'as pas encore, tu pourras relancer l'assistant)" "$(getenv BLINDTEST_CAST_APP_ID)")
    setenv BLINDTEST_CAST_APP_ID "$CAST"
fi
if yesno "Le Pi est-il branché en HDMI sur une TV, avec le bureau Raspberry Pi OS (écran TV automatique) ?"; then
    bash deploy/tv-setup.sh
fi

step "5/5 Démarrage"
install -d -m 700 data
chown -R blindtest:blindtest "$DIR"
systemctl enable blindtest >/dev/null 2>&1 || true
systemctl restart blindtest
sleep 2
PORT=$(getenv BLINDTEST_PORT)
PORT="${PORT:-3000}"
if ! curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "⚠ Le service ne répond pas encore. Regarde : journalctl -u blindtest -n 30"
    exit 1
fi
IP=$(hostname -I | awk '{print $1}')
ROOM=$(getenv BLINDTEST_HOME_ROOM)
ROOM="${ROOM:-MAISON}"
PUBLIC=$(getenv BLINDTEST_PUBLIC_URL)
LOCAL_URL="http://$IP:$PORT"

echo
bold "✅ C'est prêt !"
echo
echo "  Adresse à la maison      : $LOCAL_URL"
echo "  Ta salle                 : $LOCAL_URL/r/$ROOM"
echo "  Écran TV (navigateur)    : $LOCAL_URL/r/$ROOM/tv"
[ -n "$PUBLIC" ] && echo "  Adresse pour la famille  : $PUBLIC"
echo "  Ton code hôte            : $PIN"
echo
echo "Scanne ce QR code avec ton téléphone pour entrer dans ta salle :"
echo
node scripts/qr-terminal.js "$LOCAL_URL/r/$ROOM"
echo
echo "Ensuite : pseudo → « Je suis l'hôte » → code $PIN → manette 🎛️ → playlist → appareil → ▶ Lancer."
echo "Logs : journalctl -u blindtest -f   ·   Relancer cet assistant : sudo $DIR/deploy/setup.sh"
