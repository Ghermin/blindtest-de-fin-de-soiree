#!/usr/bin/env bash
set -euo pipefail

ROOM="${BLINDTEST_ROOM:-MAISON}"
PORT="${BLINDTEST_PORT:-3000}"
NAME="${RASPOTIFY_NAME:-Blind Test TV}"
USER_NAME="${SUDO_USER:-pi}"
HOME_DIR=$(getent passwd "$USER_NAME" | cut -d: -f6)

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : sudo $0" >&2
    exit 1
fi
if [ -z "$HOME_DIR" ] || [ ! -d "$HOME_DIR" ]; then
    echo "Utilisateur de bureau introuvable ($USER_NAME) : lance le script avec sudo depuis ta session" >&2
    exit 1
fi

if ! dpkg -s raspotify >/dev/null 2>&1; then
    curl -sL https://dtcooper.github.io/raspotify/install.sh | sh
fi
if grep -qE '^#?LIBRESPOT_NAME=' /etc/raspotify/conf; then
    sed -i "s|^#\?LIBRESPOT_NAME=.*|LIBRESPOT_NAME=\"$NAME\"|" /etc/raspotify/conf
else
    echo "LIBRESPOT_NAME=\"$NAME\"" >> /etc/raspotify/conf
fi
systemctl enable raspotify >/dev/null 2>&1 || true
systemctl restart raspotify

apt-get install -y chromium-browser >/dev/null 2>&1 || apt-get install -y chromium
BIN=$(command -v chromium-browser || command -v chromium)

AUTOSTART="$HOME_DIR/.config/autostart"
install -d -o "$USER_NAME" -g "$USER_NAME" "$AUTOSTART"
cat > "$AUTOSTART/blindtest-tv.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Blind Test TV
Exec=$BIN --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 http://localhost:$PORT/r/$ROOM/tv
X-GNOME-Autostart-enabled=true
EOF
chown "$USER_NAME:$USER_NAME" "$AUTOSTART/blindtest-tv.desktop"

raspi-config nonint do_blanking 1 >/dev/null 2>&1 || true
raspi-config nonint do_audio 2 >/dev/null 2>&1 || true

echo "Écran TV installé. Au prochain redémarrage :"
echo "  - la TV affiche http://localhost:$PORT/r/$ROOM/tv en plein écran"
echo "  - l'appareil Spotify « $NAME » apparaît dans « Appareils Spotify » du panneau hôte (son par le HDMI)"
echo "Si le son sort par la prise jack : sudo raspi-config → System Options → Audio → HDMI."
