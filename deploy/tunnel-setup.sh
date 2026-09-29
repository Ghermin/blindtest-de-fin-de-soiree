#!/usr/bin/env bash
set -euo pipefail

PORT="${BLINDTEST_PORT:-3000}"
TUNNEL="${TUNNEL_NAME:-blindtest}"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : sudo $0 blindtest.ton-domaine.fr" >&2
    exit 1
fi
if [ -z "$DOMAIN" ]; then
    echo "Usage : sudo $0 blindtest.ton-domaine.fr   (un domaine géré par Cloudflare)" >&2
    exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
    ARCH=$(dpkg --print-architecture)
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb" -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
fi

if [ ! -f /root/.cloudflared/cert.pem ]; then
    echo "1) Connexion à Cloudflare : ouvre l'URL affichée dans ton navigateur et choisis le domaine."
    cloudflared tunnel login
fi

if ! cloudflared tunnel list 2>/dev/null | grep -q " $TUNNEL "; then
    cloudflared tunnel create "$TUNNEL"
fi
ID=$(cloudflared tunnel list 2>/dev/null | awk -v name="$TUNNEL" '$2 == name { print $1 }')

install -d /etc/cloudflared
cat > /etc/cloudflared/config.yml <<EOF
tunnel: $ID
credentials-file: /root/.cloudflared/$ID.json
ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:$PORT
  - service: http_status:404
EOF

cloudflared tunnel route dns "$TUNNEL" "$DOMAIN" || true
cloudflared service install >/dev/null 2>&1 || true
systemctl enable --now cloudflared
systemctl restart cloudflared

if grep -qE '^BLINDTEST_PUBLIC_URL=' /opt/blindtest/.env; then
    sed -i "s|^BLINDTEST_PUBLIC_URL=.*|BLINDTEST_PUBLIC_URL=https://$DOMAIN|" /opt/blindtest/.env
else
    echo "BLINDTEST_PUBLIC_URL=https://$DOMAIN" >> /opt/blindtest/.env
fi
if grep -qE '^BLINDTEST_TRUST_PROXY=' /opt/blindtest/.env; then
    sed -i "s|^BLINDTEST_TRUST_PROXY=.*|BLINDTEST_TRUST_PROXY=1|" /opt/blindtest/.env
else
    echo "BLINDTEST_TRUST_PROXY=1" >> /opt/blindtest/.env
fi
systemctl restart blindtest

echo
echo "Tunnel prêt : https://$DOMAIN"
echo "Reste à faire, une seule fois :"
echo "  2) Spotify : https://developer.spotify.com/dashboard → ton app → Settings → Redirect URIs → ajoute"
echo "       https://$DOMAIN/auth/spotify/callback"
echo "     puis User Management → ajoute l'e-mail Spotify de chaque hôte de la famille (25 max)."
echo "  3) Pour réserver le jeu à la famille : https://one.dash.cloudflare.com → Access → Applications →"
echo "     Self-hosted, domaine $DOMAIN, politique « Allow » avec les e-mails de la famille (code à usage unique par e-mail)."
